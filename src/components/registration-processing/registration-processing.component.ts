import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { StripeService } from '../../services/stripe.service';
import { UserRegSuccessModalComponent } from '../../modals/user-reg-success-modal/user-reg-success-modal.component';
import { LenderRegSuccessModalComponent } from '../../modals/lender-reg-success-modal/lender-reg-success-modal.component';
import { from, of } from 'rxjs';  // ✅ Added 'of' here
import { Auth } from '@angular/fire/auth';
import { ModalService } from '../../services/modal.service';
import { take, finalize, switchMap, tap, catchError } from 'rxjs/operators';  // ✅ Added 'catchError' here
import { FirestoreService } from '../../services/firestore.service';


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
  private readonly firestoreService = inject(FirestoreService);
  private readonly auth = inject(Auth);
  private afAuth = inject(Auth); // AngularFireAuth
  private modalService = inject(ModalService); // Reused for success modal


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

 private handleStripeSuccessCallback(sessionId: string): void {
  console.log('💳 Processing Stripe success callback for session:', sessionId);
  this.processingMessage.set('Verifying payment...');

  // Try to get user role from stored data
  const pendingData = this.getPendingUserData();
  if (pendingData?.role) {
    this.userRole = pendingData.role as 'originator' | 'lender';
  }

  this.stripeService.getSessionDetails(sessionId)
    .pipe(take(1))
    .subscribe({
      next: () => {
        this.authService.setRegistrationSuccess(true);
        this.processingMessage.set('Success! Preparing your dashboard...');
        setTimeout(() => this.showSuccessModalAndRedirect(), 1000);
      },
      error: (error) => {
        console.error('❌ Failed to retrieve session:', error);
        this.handleError('Could not verify your payment. Please contact support if you were charged.');
      }
    });
}

  private showSuccessModalAndRedirect(): void {
    console.log('🎭 Showing success modal for role:', this.userRole);

    // Hide spinner
    this.showProcessingSpinner.set(false);

    // Clear any error state
    this.hasError.set(false);

    // Show appropriate modal based on role
    setTimeout(() => {
      if (this.userRole === 'lender') {
        this.showLenderRegistrationSuccessModal.set(true);
      } else {
        // Default to originator if role not determined
        this.showRegistrationSuccessModal.set(true);
      }

      // Clean up localStorage flags
      this.clearRegistrationFlags();
    }, 200);
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

  closeRegistrationSuccessModal(): void {
    console.log('✅ Originator modal closed - redirecting to dashboard');
    this.showRegistrationSuccessModal.set(false);
    setTimeout(() => {
      // ✅ FIXED: Redirect to dashboard instead of login
      this.router.navigate(['/dashboard']);
    }, 100);
  }

  closeLenderRegistrationSuccessModal(): void {
    console.log('✅ Lender modal closed - redirecting to dashboard');
    this.showLenderRegistrationSuccessModal.set(false);
    setTimeout(() => {
      // ✅ FIXED: Redirect to dashboard instead of login
      this.router.navigate(['/dashboard']);
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