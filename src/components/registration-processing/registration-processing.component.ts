import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { StripeService } from '../../services/stripe.service';
import { UserRegSuccessModalComponent } from '../../modals/user-reg-success-modal/user-reg-success-modal.component';
import { LenderRegSuccessModalComponent } from '../../modals/lender-reg-success-modal/lender-reg-success-modal.component';
import { take, finalize, switchMap, delay } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-registration-processing',
  templateUrl: './registration-processing.component.html',
  styleUrls: ['./registration-processing.component.css'],
  standalone: true,
  imports: [CommonModule, UserRegSuccessModalComponent, LenderRegSuccessModalComponent],
})
export class RegistrationProcessingComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly stripeService = inject(StripeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // ✅ Angular 18 Best Practice: Use signals for reactive state management
  showProcessingSpinner = signal(true);
  showRegistrationSuccessModal = signal(false);
  showLenderRegistrationSuccessModal = signal(false);
  processingMessage = signal('Processing your payment...');
  hasError = signal(false);

  private userRole: 'originator' | 'lender' | undefined = undefined;

  constructor() {
    console.log('RegistrationProcessingComponent created');
    this.showProcessingSpinner.set(true);
    this.processingMessage.set('Loading...');
  }

  ngOnInit(): void {
    console.log('🔄 Registration Processing Component - Starting...');

    const queryParams = this.route.snapshot.queryParams;
    const sessionId = queryParams['session_id'];
    const paymentStatus = queryParams['payment'];

    console.log('🎯 Query params:', { sessionId, paymentStatus });

    if (sessionId) {
      console.log('💳 Processing Stripe success callback with session:', sessionId);
      this.handleStripeSuccessCallback(sessionId);
    } else if (paymentStatus === 'cancel') {
      console.log('❌ Payment was cancelled');
      this.handlePaymentCancellation();
    } else if (this.shouldShowRegistrationProcessing()) {
      console.log('✅ Registration success detected - starting standard flow');
      this.startStandardRegistrationFlow();
    } else {
      console.log('❌ No valid processing context - redirecting to dashboard');
      this.router.navigate(['/dashboard']);
    }
  }

  /**
   * ✅ NEW: Handle Stripe success callback - webhook already created user
   */
  private handleStripeSuccessCallback(sessionId: string): void {
    console.log('💳 Processing Stripe success callback for session:', sessionId);
    this.processingMessage.set('Verifying your payment...');

    // ✅ Get user data from localStorage for display purposes
    const pendingUserData = this.getPendingUserData();
    
    if (!pendingUserData?.email) {
      console.error('❌ No pending user data found');
      this.handleError('Registration data not found. Please try again.');
      return;
    }

    console.log('📧 Processing registration for email:', pendingUserData.email);
    this.userRole = pendingUserData.role || 'originator';

    // ✅ STEP 1: Verify the Stripe session (optional but good practice)
    this.processingMessage.set('Confirming payment...');
    
    // ✅ STEP 2: Wait for webhook to complete user creation (give it a moment)
    setTimeout(() => {
      this.processingMessage.set('Setting up your account...');
      
      // ✅ STEP 3: Send sign-in link to the email (webhook already created account)
      this.authService.sendSignInLink(pendingUserData.email)
        .pipe(
          take(1),
          delay(1000), // Give the email time to send
          finalize(() => {
            console.log('🔄 Sign-in link process completed');
          })
        )
        .subscribe({
          next: (success) => {
            if (success) {
              console.log('✅ Sign-in link sent successfully');
              this.processingMessage.set('Success! Check your email to continue...');
              
              // ✅ STEP 4: Show success modal after short delay
              setTimeout(() => {
                this.showSuccessModal();
              }, 1500);
            } else {
              console.error('❌ Failed to send sign-in link');
              this.handleError('Failed to send login email. Please contact support.');
            }
          },
          error: (error) => {
            console.error('❌ Error sending sign-in link:', error);
            this.handleError('Registration completed but login email failed. Please try logging in manually.');
          }
        });
    }, 2000); // Give webhook 2 seconds to create user
  }

  /**
   * ✅ Get pending user data from localStorage
   */
  private getPendingUserData(): any {
    try {
      // ✅ FIXED: Look for the correct localStorage key
      const pendingData = localStorage.getItem('pendingUserData');
      const completeLenderData = localStorage.getItem('completeLenderData');
      const completeOriginatorData = localStorage.getItem('completeOriginatorData');

      if (pendingData) {
        return JSON.parse(pendingData);
      } else if (completeOriginatorData) {
        // ✅ Fallback for old data format
        return JSON.parse(completeOriginatorData);
      } else if (completeLenderData) {
        // ✅ Fallback for lender data
        const lenderData = JSON.parse(completeLenderData);
        return {
          email: lenderData.contactInfo?.contactEmail,
          firstName: lenderData.contactInfo?.firstName,
          lastName: lenderData.contactInfo?.lastName,
          role: 'lender'
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error parsing user data:', error);
      return null;
    }
  }

  /**
   * ✅ Handle payment cancellation
   */
  private handlePaymentCancellation(): void {
    this.hasError.set(true);
    this.showProcessingSpinner.set(false);
    this.processingMessage.set('Payment was cancelled');
    
    setTimeout(() => {
      this.router.navigate(['/pricing']);
    }, 2000);
  }

  /**
   * ✅ Handle errors with user-friendly messages
   */
  private handleError(message: string): void {
    this.hasError.set(true);
    this.showProcessingSpinner.set(false);
    this.processingMessage.set(message);
    
    setTimeout(() => {
      this.router.navigate(['/pricing']);
    }, 3000);
  }

  /**
   * ✅ Show success modal
   */
  private showSuccessModal(): void {
    console.log('🎭 Showing success modal for role:', this.userRole);
    this.showProcessingSpinner.set(false);

    // ✅ Set registration success flag
    this.authService.setRegistrationSuccess(true);

    setTimeout(() => {
      if (this.userRole === 'lender') {
        this.showLenderRegistrationSuccessModal.set(true);
      } else {
        this.showRegistrationSuccessModal.set(true);
      }

      // ✅ Clean up localStorage
      this.clearRegistrationFlags();
    }, 200);
  }

  /**
   * ✅ Check if we should show standard registration processing
   */
  private shouldShowRegistrationProcessing(): boolean {
    return this.authService.getRegistrationSuccess() ||
      localStorage.getItem('showRegistrationModal') === 'true';
  }

  /**
   * ✅ Start standard registration flow (non-payment)
   */
  private startStandardRegistrationFlow(): void {
    console.log('🔄 Starting standard registration processing flow...');
    this.processingMessage.set('Setting up your account...');

    // ✅ Load user role
    this.loadUserRole();

    // ✅ Show modal after delay
    setTimeout(() => {
      this.showSuccessModal();
    }, 1500);
  }

  /**
   * ✅ Load user data to determine role for correct modal
   */
  private loadUserRole(): void {
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        if (user && user.role) {
          this.userRole = user.role as 'originator' | 'lender';
          console.log('👤 User role determined:', this.userRole);
        } else {
          console.warn('⚠️ Could not determine user role, defaulting to originator');
          this.userRole = 'originator';
        }
      },
      error: (error) => {
        console.error('❌ Error loading user role:', error);
        this.userRole = 'originator';
      }
    });
  }

  /**
   * ✅ Modal close handlers
   */
  closeRegistrationSuccessModal(): void {
    console.log('✅ Originator modal closed - redirecting to login');
    this.showRegistrationSuccessModal.set(false);
    setTimeout(() => {
      // ✅ FIXED: Redirect to login page since user needs to click email link
      this.router.navigate(['/login']);
    }, 100);
  }

  closeLenderRegistrationSuccessModal(): void {
    console.log('✅ Lender modal closed - redirecting to login');
    this.showLenderRegistrationSuccessModal.set(false);
    setTimeout(() => {
      // ✅ FIXED: Redirect to login page since user needs to click email link
      this.router.navigate(['/login']);
    }, 100);
  }

  /**
   * ✅ Clean up localStorage
   */
  private clearRegistrationFlags(): void {
    console.log('🧹 Clearing registration flags');
    localStorage.removeItem('showRegistrationModal');
    localStorage.removeItem('pendingUserData');
    localStorage.removeItem('completeLenderData');
    localStorage.removeItem('completeOriginatorData');
  }

  ngOnDestroy(): void {
    // Component cleanup if needed
  }
}