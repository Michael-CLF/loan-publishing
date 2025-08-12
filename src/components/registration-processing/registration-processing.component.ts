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

    // NEW: Handle Firebase auth action (when Firebase redirects here)
  const url = window.location.href;
  const isFirebaseAuthAction = url.includes('/__/auth/action');
  
  if (isFirebaseAuthAction && url.includes('mode=signIn')) {
    // Firebase will auto-process the auth, just wait and check auth state
    this.processingMessage.set('Completing authentication...');
    this.showProcessingSpinner.set(true);
    
    // Give Firebase a moment to process, then check if user is authenticated
    setTimeout(() => {
      this.authService.getCurrentFirebaseUser()
        .pipe(take(1))
        .subscribe(user => {
          if (user) {
            // User is authenticated, redirect to dashboard immediately
            console.log('✅ User authenticated, redirecting to dashboard');
            this.router.navigate(['/dashboard']);
          } else {
            // Authentication failed or not complete yet, try manual auth
            console.log('⚠️ User not authenticated yet, attempting manual sign-in');
            
            // Extract continueUrl to get to the redirect page
            const urlObj = new URL(url);
            const continueUrl = urlObj.searchParams.get('continueUrl');
            if (continueUrl) {
              // Redirect to the continue URL (registration-processing with ml=1)
              window.location.href = decodeURIComponent(continueUrl);
            } else {
              this.processingMessage.set('Authentication failed. Please request a new link.');
              this.showErrorMessage.set(true);
              this.showProcessingSpinner.set(false);
            }
          }
        });
    }, 500); // Wait 500ms for Firebase to complete auth
    return;
  }

    // capture context for UI / resend, etc.
    this.email.set((qp.get('email') || '').toLowerCase().trim() || null);
    const r = qp.get('role');
    this.role.set(r === 'lender' || r === 'originator' ? r : null);
    this.uid.set(qp.get('uid'));

    // Check if this is a redirect AFTER Firebase has already authenticated
    const isMagicLinkReturn = qp.get('ml') === '1';

    if (isMagicLinkReturn) {
      // User should already be authenticated by Firebase at this point
      this.processingMessage.set('Completing login...');
      this.showSuccessMessage.set(false);
      this.showErrorMessage.set(false);
      this.showProcessingSpinner.set(true);

      // Just check if user is authenticated and redirect
      setTimeout(async () => {
        try {
          // Check if user is already authenticated (Firebase handled it)
          const user = await this.authService.getCurrentFirebaseUser()
            .pipe(take(1))
            .toPromise();

          if (user) {
            // User is authenticated, go to dashboard
            await this.router.navigate(['/dashboard']);
          } else {
            // Not authenticated, something went wrong
            this.processingMessage.set('Authentication failed. Please request a new link.');
            this.showErrorMessage.set(true);
            this.showProcessingSpinner.set(false);
          }
        } catch (e) {
          this.processingMessage.set('Authentication failed. Please request a new link.');
          this.showErrorMessage.set(true);
          this.showProcessingSpinner.set(false);
        }
      }, 100); // Small delay to ensure Firebase auth state is ready

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
