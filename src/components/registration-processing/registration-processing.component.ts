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
              console.log('✅ User authenticated:', user.email);
              
              // Check if this is a new user by checking their subscription status
              this.authService.checkAccountExists(user.email!).subscribe({
                next: (accountInfo) => {
                  if (accountInfo.exists && accountInfo.subscriptionStatus === 'inactive') {
                    console.log('🆕 New user detected - waiting for account activation');
                    this.processingMessage.set('Setting up your account...');
                    
                    // Poll for subscription status to become active
                    this.pollForAccountActivation(user.email!, 0);
                  } else if (accountInfo.exists && !accountInfo.needsPayment) {
                    // Existing active user - redirect immediately
                    console.log('✅ Active user, redirecting to dashboard');
                    this.router.navigate(['/dashboard']);
                  } else {
                    // Unexpected state
                    this.processingMessage.set('Account setup incomplete. Please contact support.');
                    this.showErrorMessage.set(true);
                    this.showProcessingSpinner.set(false);
                  }
                },
                error: (error) => {
                  console.error('❌ Error checking account status:', error);
                  this.processingMessage.set('Error verifying account. Please try again.');
                  this.showErrorMessage.set(true);
                  this.showProcessingSpinner.set(false);
                }
              });
            } else {
              // Authentication failed or not complete yet, try manual auth
              console.log('⚠️ User not authenticated yet, attempting redirect');
              
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
      }, 600); 
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
  } // <-- This closes ngOnInit

  // This method is OUTSIDE ngOnInit, as a separate class method
  private pollForAccountActivation(email: string, attemptCount: number): void {
    const MAX_ATTEMPTS = 20; // Poll for up to 60 seconds (20 * 3 seconds)
    const POLL_INTERVAL = 3000; // Check every 3 seconds
    
    if (attemptCount >= MAX_ATTEMPTS) {
      console.error('❌ Account activation timeout');
      this.processingMessage.set('Account setup is taking longer than expected. Please try refreshing the page or contact support.');
      this.showErrorMessage.set(true);
      this.showProcessingSpinner.set(false);
      return;
    }
    
    // Check account status
    this.authService.checkAccountExists(email).subscribe({
      next: (accountInfo) => {
        console.log(`🔄 Polling attempt ${attemptCount + 1}: Status = ${accountInfo.subscriptionStatus}`);
        
        if (accountInfo.subscriptionStatus === 'active' || accountInfo.subscriptionStatus === 'grandfathered') {
          // Success! Account is now active
          console.log('✅ Account activated successfully!');
          this.processingMessage.set('Account ready! Redirecting to dashboard...');
          
          // Small delay for user to see the success message
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1000);
        } else if (accountInfo.subscriptionStatus === 'inactive') {
          // Still waiting for webhook to complete
          console.log('⏳ Still waiting for account activation...');
          
          // Update message every few attempts to show progress
          if (attemptCount % 3 === 0) {
            this.processingMessage.set('Setting up your account... Please wait...');
          }
          
          // Continue polling
          setTimeout(() => {
            this.pollForAccountActivation(email, attemptCount + 1);
          }, POLL_INTERVAL);
        } else {
          // Unexpected status
          console.error('❌ Unexpected subscription status:', accountInfo.subscriptionStatus);
          this.processingMessage.set('Account setup error. Please contact support.');
          this.showErrorMessage.set(true);
          this.showProcessingSpinner.set(false);
        }
      },
      error: (error) => {
        console.error('❌ Error polling account status:', error);
        
        // Retry on error up to max attempts
        if (attemptCount < MAX_ATTEMPTS - 1) {
          setTimeout(() => {
            this.pollForAccountActivation(email, attemptCount + 1);
          }, POLL_INTERVAL);
        } else {
          this.processingMessage.set('Unable to verify account status. Please refresh the page.');
          this.showErrorMessage.set(true);
          this.showProcessingSpinner.set(false);
        }
      }
    });
  }

  goToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
  
  refreshPage(): void {
  // Navigate to current route to trigger a clean reload
  this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
    this.router.navigate(['/registration-processing'], { 
      queryParams: this.route.snapshot.queryParams 
    });
  });
}
}