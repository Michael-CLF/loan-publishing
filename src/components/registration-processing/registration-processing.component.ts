// registration-processing.component.ts
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { take } from 'rxjs/operators';
import { Auth, signInWithCustomToken } from '@angular/fire/auth';

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
  // Step 2: After Stripe success
  //
  // Goal:
  //  - Attempt to sign the user in automatically using a custom token (?token=...)
  //  - If sign-in works, poll Firestore until subscriptionStatus === 'active'
  //  - Then route to /dashboard
  //
  // If auto sign-in fails or there's no token:
  //  - Show friendly success message telling them to sign in.
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
      // No token. We cannot silently sign them in.
      // Show friendly success screen asking them to sign in manually.
      this.showProcessingSpinner.set(false);
      this.showErrorMessage.set(false);
      this.showSuccessMessage.set(true);
      this.processingMessage.set(
        'Registration complete. Please sign in to access your dashboard.'
      );
      return;
    }

    // We have a token. Try automatic login.
    this.processingMessage.set('Creating your account…');
    this.showProcessingSpinner.set(true);
    this.showErrorMessage.set(false);
    this.showSuccessMessage.set(false);

    signInWithCustomToken(this.afAuth, token)
      .then(() => {
        // We are now authenticated in this browser.
        const effectiveEmail =
          emailForAfterAuth ||
          this.email() ||
          ''; // fallback

        if (!effectiveEmail) {
          // No email at all. Just go to dashboard and let guards handle it.
          this.router.navigate(['/dashboard']);
          return;
        }

        // Now that we're signed in, poll Firestore until subscriptionStatus === 'active'
        this.processingMessage.set('Finalizing your account…');
        this.pollForAccountActivation(effectiveEmail, 0);
      })
      .catch((err) => {
        console.error('Auto-login with custom token failed:', err);

        // Graceful fallback: don't scream error, just tell them to sign in.
        this.showProcessingSpinner.set(false);
        this.showErrorMessage.set(false);
        this.showSuccessMessage.set(true);
        this.processingMessage.set(
          'Registration complete. Please sign in to access your dashboard.'
        );
      });
  }

  // -------------------------------------------------
  // Step 3: Poll until subscriptionStatus becomes "active"
  //
  // authService.checkAccountExists(email) must return at least:
  //   { exists: boolean; subscriptionStatus?: string; ... }
  //
  // When subscriptionStatus === 'active', we route to /dashboard.
  // -------------------------------------------------
  private pollForAccountActivation(
    email: string,
    attemptCount: number
  ): void {
    const MAX_ATTEMPTS = 20; // ~60s
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

    this.authService.checkAccountExists(email).subscribe({
      next: (accountInfo) => {
        // Success condition
        if (
          accountInfo?.subscriptionStatus === 'active' ||
          accountInfo?.subscriptionStatus === 'grandfathered' ||
          accountInfo?.needsPayment === false
        ) {
          this.processingMessage.set(
            'Account ready. Redirecting to dashboard…'
          );
          this.showProcessingSpinner.set(true);
          this.showErrorMessage.set(false);
          this.showSuccessMessage.set(false);

          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 800);

          return;
        }

        // Still provisioning
        if (attemptCount % 3 === 0) {
          this.processingMessage.set(
            'Setting up your account… Please wait…'
          );
        }

        setTimeout(
          () =>
            this.pollForAccountActivation(
              email,
              attemptCount + 1
            ),
          POLL_INTERVAL
        );
      },
      error: () => {
        // Network or Firestore read issue
        if (attemptCount < MAX_ATTEMPTS - 1) {
          setTimeout(
            () =>
              this.pollForAccountActivation(
                email,
                attemptCount + 1
              ),
            POLL_INTERVAL
          );
        } else {
          this.processingMessage.set(
            'Unable to verify account status. Please refresh this page.'
          );
          this.showErrorMessage.set(true);
          this.showProcessingSpinner.set(false);
          this.showSuccessMessage.set(false);
        }
      },
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
