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

    // Capture context from query params
    this.email.set((qp.get('email') || '').toLowerCase().trim() || null);

    const r = qp.get('role');
    this.role.set(r === 'lender' || r === 'originator' ? r : null);

    this.uid.set(qp.get('uid'));

    const paymentStatus = qp.get('payment');          // "success" | "cancel" | null
    const sessionId = qp.get('session_id');           // present on Stripe success flow

    const isStripeReturn = sessionId !== null || paymentStatus !== null;

    if (isStripeReturn) {
      // Coming back from Stripe
      if (paymentStatus === 'cancel') {
        // User bailed out at Stripe
        this.processingMessage.set('Payment was canceled. Your subscription is not active.');
        this.showProcessingSpinner.set(false);
        this.showErrorMessage.set(true);
        this.showSuccessMessage.set(false);
        return;
      }

      // Otherwise treat as success and continue with post-payment path
      this.handlePostPaymentProcessing();
      return;
    }

    // Not Stripe. Normal pre-payment registration flow.
    this.showCheckEmailScreen();
  }


  /**
   * Show "check your email for OTP code" screen
   */
  private showCheckEmailScreen(): void {
    this.processingMessage.set('Check your email for a verification code to continue registration.');
    this.showProcessingSpinner.set(false);
    this.showSuccessMessage.set(true);

    // No auto-redirect - user stays on this page until they verify OTP
  }

private handlePostPaymentProcessing(): void {
  this.clearRedirectTimer();
  this.processingMessage.set('Finalizing your account…');
  this.showProcessingSpinner.set(true);
  this.showErrorMessage.set(false);
  this.showSuccessMessage.set(false);

  const email = this.email();
  if (!email) {
    this.processingMessage.set('Unable to verify payment. Please contact support.');
    this.showErrorMessage.set(true);
    this.showProcessingSpinner.set(false);
    return;
  }

  // We assume user is already signed in from earlier (custom token after registration)
  this.authService.getCurrentFirebaseUser().pipe(take(1)).subscribe({
    next: (user) => {
      if (user?.email) {
        // Poll Firestore for subscriptionStatus === 'active'
        this.pollForAccountActivation(user.email, 0);
      } else {
        // Not authenticated. This should not normally happen in the new flow.
        // We just show an error and stop.
        this.processingMessage.set('You are not signed in. Please log in to continue.');
        this.showErrorMessage.set(true);
        this.showProcessingSpinner.set(false);
      }
    },
    error: (err) => {
      console.error('Error checking auth:', err);
      this.processingMessage.set('Unable to confirm login session. Please log in and try again.');
      this.showErrorMessage.set(true);
      this.showProcessingSpinner.set(false);
    }
  });
}
  

  ngOnDestroy(): void {
    this.clearRedirectTimer();
  }

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
      // Expect Firestore doc with subscriptionStatus and paymentStatus from webhook
      // We consider success if subscriptionStatus === 'active'
      if (accountInfo?.subscriptionStatus === 'active') {
        this.processingMessage.set('Account ready. Redirecting to dashboard…');
        this.clearRedirectTimer();
        setTimeout(() => this.router.navigate(['/dashboard']), 800);
        return;
      }

      // Still not active. Keep polling.
      if (attemptCount % 3 === 0) {
        this.processingMessage.set('Setting up your account… Please wait…');
      }
      setTimeout(() => this.pollForAccountActivation(email, attemptCount + 1), POLL_INTERVAL);
    },
    error: () => {
      if (attemptCount < MAX_ATTEMPTS - 1) {
        setTimeout(() => this.pollForAccountActivation(email, attemptCount + 1), POLL_INTERVAL);
      } else {
        this.processingMessage.set('Unable to verify account status. Please refresh this page.');
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
