// registration-processing.component.ts
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { take } from 'rxjs/operators';
import { Auth, signInWithCustomToken } from '@angular/fire/auth';
import { browserLocalPersistence } from 'firebase/auth';

@Component({
  selector: 'app-registration-processing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './registration-processing.component.html',
  styleUrls: ['./registration-processing.component.css'],
})
export class RegistrationProcessingComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly afAuth = inject(Auth);

  // UI state
  showProcessingSpinner = signal<boolean>(true);
  showSuccessMessage = signal<boolean>(false);
  showErrorMessage = signal<boolean>(false);
  processingMessage = signal<string>('');

  // Context from Stripe return
  email = signal<string | null>(null);
  role = signal<'lender' | 'originator' | null>(null);
  uid = signal<string | null>(null);

  // internal timer used only for legacy success screen with redirect home
  private redirectTimerId: number | null = null;

  // -------------------------------------------------
  // lifecycle
  // -------------------------------------------------
  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;

    // pull context from query params
    this.email.set((qp.get('email') || '').toLowerCase().trim() || null);

    const r = qp.get('role');
    this.role.set(r === 'lender' || r === 'originator' ? r : null);

    this.uid.set(qp.get('uid'));

    const paymentStatus = qp.get('payment');    // "success" | "cancel" | null
    const sessionId = qp.get('session_id');     // present on Stripe success flow
    const isStripeReturn = sessionId !== null || paymentStatus !== null;

    if (isStripeReturn) {
      // User just returned from Stripe Checkout

      if (paymentStatus === 'cancel') {
        // They bailed out at Stripe. No subscription.
        this.processingMessage.set(
          'Payment was canceled. Your subscription is not active.'
        );
        this.showProcessingSpinner.set(false);
        this.showErrorMessage.set(true);
        this.showSuccessMessage.set(false);
        return;
      }

      // Success path from Stripe
      this.handlePostPaymentProcessing();
      return;
    }

    // Not coming from Stripe. This is pre-payment "check your email for OTP" path.
    this.showCheckEmailScreen();
  }

  ngOnDestroy(): void {
    this.clearRedirectTimer();
  }

  // -------------------------------------------------
  // Step 1: Normal pre-payment path
  // -------------------------------------------------
  private showCheckEmailScreen(): void {
    this.processingMessage.set(
      'Check your email for a verification code to continue registration.'
    );
    this.showProcessingSpinner.set(false);
    this.showSuccessMessage.set(true);
    this.showErrorMessage.set(false);
    // No auto-redirect. User stays here until they enter OTP.
  }

  // -------------------------------------------------
  private handlePostPaymentProcessing(): void {
    this.clearRedirectTimer();

    this.processingMessage.set('Processing your payment…');
    this.showProcessingSpinner.set(true);
    this.showErrorMessage.set(false);
    this.showSuccessMessage.set(false);

    const qp = this.route.snapshot.queryParamMap;
    const token = qp.get('token'); // custom token you added to Stripe success_url
    const emailParam =
      (qp.get('email') || '').toLowerCase().trim() || null;

    // First check if we're already authenticated (edge case, page reload after success)
    this.authService
      .getCurrentFirebaseUser()
      .pipe(take(1))
      .subscribe({
        next: (user) => {
          if (user?.email) {
            // Already logged in. Go straight to activation polling logic.
            this.processingMessage.set('Finalizing your account…');
            this.pollForAccountActivation(
              user.email.toLowerCase().trim(),
              0
            );
            return;
          }

          // Not logged in yet. Try the custom token-based auto-login.
          this.attemptAutoLoginWithToken(token, emailParam);
        },
        error: (err) => {
          console.error('Error checking auth:', err);
          // Even if we can't read auth state, still try token login
          this.attemptAutoLoginWithToken(token, emailParam);
        },
      });
  }

  // -------------------------------------------------
  // Step 2a: Attempt auto-login using custom token
  // -------------------------------------------------
  private attemptAutoLoginWithToken(
    token: string | null,
    emailForAfterAuth: string | null
  ): void {
    if (!token) {
      this.showProcessingSpinner.set(false);
      this.showErrorMessage.set(false);
      this.showSuccessMessage.set(true);
      this.processingMessage.set(
        'Registration complete. Please sign in to access your dashboard.'
      );
      return;
    }

    console.log('🎟️ Using custom token from Stripe return:', token.slice(0, 12) + '...');

    this.processingMessage.set('Creating your account…');
    this.showProcessingSpinner.set(true);
    this.showErrorMessage.set(false);
    this.showSuccessMessage.set(false);

    signInWithCustomToken(this.afAuth, token)
      .then(async (credential) => {
        const user = credential.user;
        console.log('✅ Firebase sign-in success:', user?.uid);

        // Confirm persistence
        await this.afAuth.setPersistence(browserLocalPersistence);

        const effectiveEmail =
          emailForAfterAuth || this.email() || user?.email || '';

        if (!effectiveEmail) {
          console.warn('⚠️ No email found after sign-in, routing to dashboard.');
          this.router.navigate(['/dashboard']);
          return;
        }

        this.processingMessage.set('Finalizing your account…');
        this.pollForAccountActivation(effectiveEmail, 0);
      })
      .catch((err) => {
        console.error('❌ Sign-in with custom token failed:', err);
        this.showProcessingSpinner.set(false);
        this.showErrorMessage.set(true);
        this.showSuccessMessage.set(false);
        this.processingMessage.set(
          'Sign-in failed after payment. Please log in manually.'
        );
      });
  }

 private pollForAccountActivation(
  email: string,
  attemptCount: number
): void {

  this.authService.getUserProfile()
    .pipe(take(1))
    .subscribe({
      next: (profile) => {
        // We got a Firestore doc for the signed-in UID
        if (profile) {
          console.log('✅ User profile detected during poll:', profile);

          const subActive =
            profile.subscriptionStatus === 'active' ||
            profile.subscriptionStatus === 'grandfathered';

          const paid =
            profile.paymentStatus === 'paid' ||
            profile.paymentStatus === 'trialing';

          if (subActive || paid) {
            // Account is active / trialing. Go now.
            this.finishAndRouteToDashboard();
            return;
          }

          // Not flipped to active yet
          if (attemptCount >= 2) {
            console.warn('⚠️ Subscription still pending but routing anyway.');
            this.finishAndRouteToDashboard();
            return;
          }
        }

        // No profile yet OR still pending and attemptCount < 2.
        const MAX_ATTEMPTS = 20;
        const POLL_INTERVAL = 3000;

        if (attemptCount >= MAX_ATTEMPTS) {
          this.processingMessage.set(
            'Account setup is taking longer than expected. Please refresh the page or contact support.'
          );
          this.showErrorMessage.set(true);
          this.showProcessingSpinner.set(false);
          this.showSuccessMessage.set(false);
          return;
        }

        if (attemptCount % 3 === 0) {
          this.processingMessage.set(
            'Setting up your account… Please wait…'
          );
        }

        setTimeout(() => {
          this.pollForAccountActivation(email, attemptCount + 1);
        }, POLL_INTERVAL);
      },

      error: () => {
        // If profile lookup fails twice, stop blocking UI and route anyway
        if (attemptCount >= 2) {
          console.warn('⚠️ Error reading profile. Routing anyway.');
          this.finishAndRouteToDashboard();
          return;
        }

        setTimeout(() => {
          this.pollForAccountActivation(email, attemptCount + 1);
        }, 2000);
      }
    });
}


  // -------------------------------------------------
  // helpers
  // -------------------------------------------------
  private clearRedirectTimer(): void {
    if (this.redirectTimerId !== null) {
      clearTimeout(this.redirectTimerId);
      this.redirectTimerId = null;
    }
  }
  // New helper: confirm user doc by UID once, then go to dashboard
  private finishAndRouteToDashboard(): void {
    this.processingMessage.set('Account ready. Redirecting to dashboard…');
    this.showProcessingSpinner.set(true);
    this.showErrorMessage.set(false);
    this.showSuccessMessage.set(false);

    // small delay so UI can update
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
      try { localStorage.removeItem('postLoginNext'); } catch {}
    }, 300);
  }


  // template helpers
  goToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  refreshPage(): void {
    this.router
      .navigateByUrl('/', { skipLocationChange: true })
      .then(() => {
        this.router.navigate(['/registration-processing'], {
          queryParams: this.route.snapshot.queryParams,
        });
      });
  }
}
