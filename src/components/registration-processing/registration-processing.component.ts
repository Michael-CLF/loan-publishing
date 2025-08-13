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
  showSuccessMessage = signal<boolean>(false);
  showErrorMessage = signal<boolean>(false);
  processingMessage = signal<string>('');

  // Context from Stripe return
  email = signal<string | null>(null);
  role = signal<'lender' | 'originator' | null>(null);
  uid = signal<string | null>(null);

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

    // Capture context (for UI / resend)
    this.email.set((qp.get('email') || '').toLowerCase().trim() || null);
    const r = qp.get('role');
    this.role.set(r === 'lender' || r === 'originator' ? r : null);
    this.uid.set(qp.get('uid'));

    // ---- Direct magic-link URL (contains oobCode) ----
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

      return;
    }

    // ---- Magic-link return (?ml=1) — wait briefly for auth instead of showing success card ----
    const isMagicLinkReturn = qp.get('ml') === '1';
    if (isMagicLinkReturn) {
      this.clearRedirectTimer();
      this.processingMessage.set('Completing sign-in…');
      this.showProcessingSpinner.set(true);

      let attempts = 0;
      const MAX_ATTEMPTS = 8;     // ~5–6s total
      const DELAY_MS = 700;

      const checkAuth = () => {
        attempts++;
        this.authService.refreshCurrentUser().then(() => {
          this.authService.getCurrentFirebaseUser().pipe(take(1)).subscribe({
            next: (user) => {
              if (user?.email) {
                this.afterAuth(user.email);
              } else if (attempts < MAX_ATTEMPTS) {
                setTimeout(checkAuth, DELAY_MS);
              } else {
                // Auth never arrived — fall back to the post-Stripe screen
                this.showCheckEmailScreenWithRedirect();
              }
            },
            error: () => {
              if (attempts < MAX_ATTEMPTS) {
                setTimeout(checkAuth, DELAY_MS);
              } else {
                this.processingMessage.set('Unable to verify sign-in. Please try the email link again.');
                this.showProcessingSpinner.set(false);
                this.showErrorMessage.set(true);
              }
            }
          });
        });
      };

      checkAuth();
      return;
    }

    // ---- Default (post-Stripe success) ----
    this.showCheckEmailScreenWithRedirect();
  }

  ngOnDestroy(): void {
    this.clearRedirectTimer();
  }

  // Shows the post-Stripe “check your email” card and safely redirects to home.
  private showCheckEmailScreenWithRedirect(): void {
    this.processingMessage.set('Registration Completed Successfully. Check your email to finish sign-in.');
    this.showProcessingSpinner.set(false);
    this.showSuccessMessage.set(true);

    this.clearRedirectTimer();
    this.redirectTimerId = window.setTimeout(() => {
      // Only redirect if we’re still on this page (prevents pulling the user off /dashboard)
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
        if (
          accountInfo.exists &&
          (accountInfo.subscriptionStatus === 'active' ||
            accountInfo.subscriptionStatus === 'grandfathered' ||
            !accountInfo.needsPayment)
        ) {
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
    const MAX_ATTEMPTS = 20;     // ~60s
    const POLL_INTERVAL = 3000;

    if (attemptCount >= MAX_ATTEMPTS) {
      this.processingMessage.set('Account setup is taking longer than expected. Please refresh the page or contact support.');
      this.showErrorMessage.set(true);
      this.showProcessingSpinner.set(false);
      return;
    }

    this.authService.checkAccountExists(email).subscribe({
      next: (accountInfo) => {
        // ✅ corrected
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

  // Optional helpers used by the template
  goToPricing(): void { this.router.navigate(['/pricing']); }
  goToLogin(): void { this.router.navigate(['/login']); }
  refreshPage(): void {
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate(['/registration-processing'], {
        queryParams: this.route.snapshot.queryParams,
      });
    });
  }
}
