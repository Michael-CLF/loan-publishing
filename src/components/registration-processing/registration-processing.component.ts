// registration-processing.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
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
export class RegistrationProcessingComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  // UI state
  showProcessingSpinner = signal<boolean>(true);
  showSuccessMessage = signal<boolean>(false);
  showErrorMessage = signal<boolean>(false);
  processingMessage = signal<string>('');

  // Extra context from Stripe success/cancel return
  email = signal<string | null>(null);
  role = signal<'lender' | 'originator' | null>(null);
  uid = signal<string | null>(null);

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;

    // Capture context for UI / resend, etc.
    this.email.set((qp.get('email') || '').toLowerCase().trim() || null);
    const r = qp.get('role');
    this.role.set(r === 'lender' || r === 'originator' ? r : null);
    this.uid.set(qp.get('uid'));

    // 🔐 Magic-link handling (handleCodeInApp: true)
    // If the current URL is a Firebase email sign-in link, consume it here.
    const url = window.location.href;
    const isMagicEmailLink = url.includes('mode=signIn') && url.includes('oobCode=');

    if (isMagicEmailLink) {
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

          // Derive a guaranteed string email (same-device or different-device)
          const email = (user?.email ?? qp.get('email') ?? '').trim();
          if (!email) {
            console.error('Could not determine user email after magic link.');
            this.processingMessage.set(
              'We could not confirm your email. Please open the link from the same device or request a new link.'
            );
            this.showErrorMessage.set(true);
            this.showProcessingSpinner.set(false);
            return;
          }

          // Auth completed — verify account and route
          this.afterAuth(email);
        },
        error: (err) => {
          console.error('Error handling magic link:', err);
          this.processingMessage.set('Authentication link error. Please request a new link.');
          this.showErrorMessage.set(true);
          this.showProcessingSpinner.set(false);

          // Auto-redirect to homepage after a short delay (only if still on this screen)
          const REDIRECT_DELAY_MS = 6000; // 6 seconds
          setTimeout(() => {
            if (this.showSuccessMessage() && !this.showProcessingSpinner()) {
              // SPA navigation (fallback to hard redirect if desired)
              this.router.navigateByUrl('/');
              // Or hard redirect: window.location.href = '/';
              // Or to your env URL: window.location.href = 'https://dailyloanpost.com/';
            }
          }, REDIRECT_DELAY_MS);

        },
      });

      // Stop here so any legacy branches don’t also run
      return;
    }

    // Fallback: page reached with ?ml=1 (not a magic link URL). If the user
    // is already authenticated, finish the flow; otherwise show the normal post-Stripe UI.
    const isMagicLinkReturn = qp.get('ml') === '1';
    if (isMagicLinkReturn) {
      this.processingMessage.set('Loading your account…');
      this.showProcessingSpinner.set(true);

      this.authService.getCurrentFirebaseUser().pipe(take(1)).subscribe({
        next: (user) => {
          if (user?.email) {
            this.afterAuth(user.email);
          } else {
            // Not signed in yet — instruct the user to click the email link
            this.processingMessage.set('Please open the email link we sent to finish signing in.');
            this.showProcessingSpinner.set(false);
            this.showSuccessMessage.set(true);
          }
        },
        error: () => {
          this.processingMessage.set('Unable to verify sign-in. Please try the email link again.');
          this.showProcessingSpinner.set(false);
          this.showErrorMessage.set(true);
        },
      });
      return;
    }

    // Default (post-Stripe success screen prompting for email link)
    this.processingMessage.set('Registration Completed Successfully. Check your email to finish sign-in.');
    this.showProcessingSpinner.set(false);
    this.showSuccessMessage.set(true);
  }

  /**
   * After Firebase Auth is true, verify account status and route accordingly.
   */
  private afterAuth(email: string): void {
    this.processingMessage.set('Verifying your account…');
    this.showErrorMessage.set(false);
    this.showSuccessMessage.set(false);
    this.showProcessingSpinner.set(true);

    this.authService.checkAccountExists(email).subscribe({
      next: (accountInfo) => {
        if (accountInfo.exists && (accountInfo.subscriptionStatus === 'active' || accountInfo.subscriptionStatus === 'grandfathered' || !accountInfo.needsPayment)) {
          // Active → dashboard
          this.router.navigate(['/dashboard']);
          return;
        }

        if (accountInfo.exists && accountInfo.subscriptionStatus === 'inactive') {
          // Newly created but not active yet — poll until webhook flips to active
          this.processingMessage.set('Setting up your account. Please wait.');
          this.pollForAccountActivation(email, 0);
          return;
        }

        // Unexpected state
        this.processingMessage.set('Account setup incomplete. Please contact support.');
        this.showErrorMessage.set(true);
        this.showProcessingSpinner.set(false);
      },
      error: (err) => {
        console.error('Error verifying account after auth:', err);
        this.processingMessage.set('Error verifying account. Please try again.');
        this.showErrorMessage.set(true);
        this.showProcessingSpinner.set(false);
      },
    });
  }

  /**
   * Poll Firestore for the subscription to become active (webhook delay).
   */
  private pollForAccountActivation(email: string, attemptCount: number): void {
    const MAX_ATTEMPTS = 20;   // ~60s (20 * 3s)
    const POLL_INTERVAL = 3000;

    if (attemptCount >= MAX_ATTEMPTS) {
      console.error('Account activation timeout');
      this.processingMessage.set(
        'Account setup is taking longer than expected. Please refresh the page or contact support.'
      );
      this.showErrorMessage.set(true);
      this.showProcessingSpinner.set(false);
      return;
    }

    this.authService.checkAccountExists(email).subscribe({
      next: (accountInfo) => {
        if (accountInfo.subscriptionStatus === 'active' || accountInfo.subscriptionStatus === 'grandfathered') {
          this.processingMessage.set('Account ready! Redirecting to dashboard…');
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

        // Unexpected status
        console.error('Unexpected subscription status:', accountInfo.subscriptionStatus);
        this.processingMessage.set('Account setup error. Please contact support.');
        this.showErrorMessage.set(true);
        this.showProcessingSpinner.set(false);
      },
      error: (error) => {
        console.error('Error polling account status:', error);
        if (attemptCount < MAX_ATTEMPTS - 1) {
          setTimeout(() => this.pollForAccountActivation(email, attemptCount + 1), POLL_INTERVAL);
        } else {
          this.processingMessage.set('Unable to verify account status. Please refresh the page.');
          this.showErrorMessage.set(true);
          this.showProcessingSpinner.set(false);
        }
      },
    });
  }

  // Utility navigation helpers (kept from your version)
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
