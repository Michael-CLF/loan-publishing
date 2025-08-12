import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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
  showSuccessMessage    = signal<boolean>(false);
  showErrorMessage      = signal<boolean>(false);
  processingMessage     = signal<string>('');

  // Extra context from Stripe success/cancel return
  email = signal<string | null>(null);
  role  = signal<'lender' | 'originator' | null>(null);
  uid   = signal<string | null>(null);

  ngOnInit(): void {
  const qp = this.route.snapshot.queryParamMap;

  // capture context for UI / resend, etc.
  this.email.set((qp.get('email') || '').toLowerCase().trim() || null);
  const r = qp.get('role');
  this.role.set(r === 'lender' || r === 'originator' ? r : null);
  this.uid.set(qp.get('uid'));

  // ⬇️ NEW: if this is a magic-link landing, finish sign-in right here
  const url = window.location.href;
  const isMagicLinkVisit =
    url.includes('oobCode=') || url.includes('mode=signIn') || qp.get('ml') === '1';

  if (isMagicLinkVisit) {
    // show brief "processing" feel; finish sign-in then go dashboard
    this.processingMessage.set('Logging you in...');
    this.showSuccessMessage.set(false);
    this.showErrorMessage.set(false);
    this.showProcessingSpinner.set(true);

       setTimeout(async () => {
      try {
        // Use your existing AuthService method that completes the email link sign-in.
        await this.authService.handleEmailLinkAuthentication();
        await this.router.navigate(['/dashboard']);
      } catch (e) {
        this.processingMessage.set('Authentication failed. Please request a new link.');
        this.showErrorMessage.set(true);
        this.showProcessingSpinner.set(false);
      }
    }, 0);

    return; // prevent dropping into paymentStatus logic below
  }

  const paymentStatus = qp.get('payment');


    if (paymentStatus === 'success') {
      // Payment successful - tell user to check email for magic link
      this.showSuccessMessage.set(true);
      this.processingMessage.set('Registration Successful!');
      // keep spinner visible briefly for "processing" feel, then hide
      setTimeout(() => this.showProcessingSpinner.set(false), 400);

      // optional soft redirect after a short delay (you had 8s before)
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 8000);

    } else if (paymentStatus === 'cancel') {
      // Payment cancelled
      this.showErrorMessage.set(true);
      this.processingMessage.set('Payment was cancelled. Please try again.');
      setTimeout(() => this.showProcessingSpinner.set(false), 0);

      // Redirect back to pricing after 5 seconds
      setTimeout(() => {
        this.router.navigate(['/pricing']);
      }, 5000);

    } else {
      // Unknown status
      this.showErrorMessage.set(true);
      this.processingMessage.set('Something went wrong. Please contact support.');
      setTimeout(() => this.showProcessingSpinner.set(false), 0);
    }
  }

  goToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
