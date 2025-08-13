// registration-processing.component.ts
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { take } from 'rxjs/operators';

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

  // UI state
  showProcessingSpinner = signal<boolean>(true);
  showSuccessMessage   = signal<boolean>(false);
  showErrorMessage     = signal<boolean>(false);
  processingMessage    = signal<string>('');

  // Context from Stripe return (used for UI/resend)
  email = signal<string | null>(null);
  role  = signal<'lender' | 'originator' | null>(null);
  uid   = signal<string | null>(null);

  // Timer used only on the post-Stripe success screen
  private redirectTimerId: number | null = null;
  private clearRedirectTimer(): void {
    if (this.redirectTimerId !== null) {
      clearTimeout(this.redirectTimerId);
      this.redirectTimerId = null;
    }
  }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;

    // capture context for UI / resend, etc.
    this.email.set((qp.get('email') || '').toLowerCase().trim() || null);
    const r = qp.get('role');
    this.role.set(r === 'lender' || r === 'originator' ? r : null);
    this.uid.set(qp.get('uid'));

    // ---- Magic-link handling (handleCodeInApp: true) ----
    const href = window.location.href;
    const isMagicEmailLink = (href.includes('mode=SignIn') || href.includes('mode=signIn')) && href.includes('oobCode=');

    if (isMagicEmailLink) {
      this.clearRedirectTimer();
      this.processingMessage.set('Completing secure sign-in…');
      this.showProcessingSpinner.set(true);

      this.authService.handleEmailLinkAuthentication().pipe(take(1)).subscribe({
        next: ({ success, user, error }) => {
          if (!success) {
            console.error('Magic link not consumed:', error);
            this.processingMessage.set('Authentication link error. Please request a new link.');
            this.showErrorMessage.set(true);
            this.showProcessingSpinner.set(false);
            return;
          }

          const email = (user?.email ?? qp.get('email') ?? '').trim();
          if (!email) {
            this.processingMessage.set('We could not confirm your email. Please open the link from the same device or request a new link.');
            this.showErrorMessage.set(true);
            this.showProcessingSpinner.set(false);
            return;
          }

          this.afterAuth(email);
        },
        error: (err) => {
          console.error('Error handling magic link:', err);
          this.processingMessage.set('Authentication link error. Please request a new link.');
          this.showErrorMessage.set(true);
          this.showProcessingSpinner.set(false);
        }
      });

      return; // stop — rest continues after sign-in
    }

    // ---- Return with ?ml=1 (already signed in) ----
    const isMagicLinkReturn = qp.get('ml') === '1';
    if (isMagicLinkReturn) {
      this.processingMessage.set('Loading your account…');
      this.showProcessingSpinner.set(true);

      this.authService.getCurrentFirebaseUser().pipe(take(1)).subscribe({
        next: (user) => {
          if (user?.email) {
            this.afterAuth(user.email);
          } else {
            this.showCheckEmailScreenWithRedirect();
          }
        },
        error: () => {
          this.processingMessage.set('Unable to verify sign-in. Please try the email link again.');
          this.showProcessingSpinner.set(false);
          this.showErrorMessage.set(true);
        }
      });

      return;
    }

    // ---- Default (post-Stripe success screen prompting for email link) ----
    this.showCheckEmailScreenWithRedirect();
  }

  ngOnDestroy(): void {
    this.clearRedirectTimer();
  }

  // Show the “check your email” screen and schedule a safe redirect to home
  private showCheckEmailScreenWithRedirect(): void {
    this.processingMessage.set('Registration Completed Successfully. Check your email to finish sign-in.');
    this.showProcessingSpinner.set(false);
    this.showSuccessMessage.set(true);

    this.clearRedirectTimer();
    this.redirectTimerId = window.setTimeout(() => {
      // Only redirect if we’re still on this page (prevents pulling user off /dashboard)
      if (this.router.url.startsWith('/registration-processing')) {
        this.router.navigateByUrl('/', { replaceUrl: true }).catch(() => {
          window.location.href = '/';
        });
      }
    }, 6000);
  }

  // After Firebase Auth is true, verify account status and route accordingly.
  private afterAuth(email: string): void {
    this.clearRedirectTimer();
    this.processingMessage.set('Verifying your account…');
    this.showErrorMessage.set(false);
    this.showSuccessMessage.set(false);
    this.showProcessingSpinner.set(true);

    this.authService.checkAccountExists(email).subscribe({
      next: (accountInfo) => {
        if (accountInfo.exists && (accountInfo.subscriptionStatus === 'active'
          || accountInfo.subscriptionStatus === 'grandfathered'
          || !accountInfo.needsPayment)) {
          this.router.navigate(['/dashboard']);
          return;
        }

        if (accountInfo.exists && accountInfo.subscriptionStatus === 'inactive') {
          this.processingMessage.set('Setting up your account. Please wait.');
          this.pollForAccountActivation(email, 0);
          return;
        }

        this.processingMessage.set('Account setup incomplete. Please contact support.');
        this.showErrorMessage.set(true);
        this.showProcessingSpinner.set(false);
      },
      error: (err) => {
        console.error('Error verifying account after auth:', err);
        this.processingMessage.set('Error verifying account. Please try again.');
        this.showErrorMessage.set(true);
        this.showProcessingSpinner.set(false);
      }
    });
  }

  // Poll Firestore for the subscription to become active (webhook delay).
  private pollForAccountActivation(email: string, attemptCount: number): void {
    const MAX_ATTEMPTS = 20;   // ~60s
    const POLL_INTERVAL = 3000;

    if (attemptCount >= MAX_ATTEMPTS) {
      this.processingMessage.set('Account setup is taking longer than expected. Please refresh the page or contact support.');
      this.showErrorMessage.set(true);
      this.showProcessingSpinner.set(false);
      return;
    }

    this.authService.checkAccountExists(email).subscribe({
      next: (accountInfo) => {
        if (accountInfo.subscriptionStatus === 'active' || accountInfo.subscriptionStatus === 'grandfathered') {
          this.processingMessage.set('Account ready! Redirecting to dashboard…');
          this.clearRedirectTimer();
          setTimeout(() => this.router.navigate(['/dashboard']), 800);
          return;
        }

        if (accountInfo.subscriptionStatus === 'inactive') {
          if (attemptCount % 3 === 0) {
            this.processingMessage.set('Setting up your account… Please wait…');
          }
          setTimeout(() => this.pollForAccountActivation(email, attemptCount + 1), POLL_INTERVAL);
          return;
        }

        this.processingMessage.set('Account setup error. Please contact support.');
        this.showErrorMessage.set(true);
        this.showProcessingSpinner.set(false);
      },
      error: () => {
        if (attemptCount < MAX_ATTEMPTS - 1) {
          setTimeout(() => this.pollForAccountActivation(email, attemptCount + 1), POLL_INTERVAL);
        } else {
          this.processingMessage.set('Unable to verify account status. Please refresh the page.');
          this.showErrorMessage.set(true);
          this.showProcessingSpinner.set(false);
        }
      }
    });
  }

  // Utility navigation helpers
  goToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  refreshPage(): void {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/registration-processing'], {
        queryParams: this.route.snapshot.queryParams,
      });
    });
  }
}
