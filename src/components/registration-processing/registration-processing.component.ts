import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserRegSuccessModalComponent } from '../../modals/user-reg-success-modal/user-reg-success-modal.component';
import { LenderRegSuccessModalComponent } from '../../modals/lender-reg-success-modal/lender-reg-success-modal.component';
import { take, finalize } from 'rxjs/operators';
import {
  Firestore,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-registration-processing',
  templateUrl: './registration-processing.component.html',
  styleUrls: ['./registration-processing.component.css'],
  standalone: true,
  imports: [CommonModule, UserRegSuccessModalComponent, LenderRegSuccessModalComponent],
})
export class RegistrationProcessingComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  // ✅ Angular 18 Best Practice: Use signals for reactive state management
  showProcessingSpinner = signal(true);
  showRegistrationSuccessModal = signal(false);
  showLenderRegistrationSuccessModal = signal(false);
  processingMessage = signal('Setting up your account...');
  hasError = signal(false);

  private userRole: 'originator' | 'lender' | undefined = undefined;

  originatorData: any;


  // ✅ Prevent duplicate processing
  private static processingInProgress = false;
  private static processedEmails = new Set<string>();

  constructor() {
    console.log('RegistrationProcessingComponent created');
    // ✅ Initialize spinner to true immediately to prevent blank screen
    this.showProcessingSpinner.set(true);
    this.processingMessage.set('Loading...');
  }

  ngOnInit(): void {
    console.log('🔄 Registration Processing Component - Starting...');

    // ✅ RESET static flags on fresh component load
    RegistrationProcessingComponent.processingInProgress = false;

    // Add debug logs
    console.log('🎯 Initial spinner state:', this.showProcessingSpinner());
    console.log('🎯 Query params:', this.route.snapshot.queryParams);
    console.log('🎯 localStorage showRegistrationModal:', localStorage.getItem('showRegistrationModal'));

    // ✅ Check URL params to determine if this is a Stripe callback
    const queryParams = this.route.snapshot.queryParams;
    const paymentStatus = queryParams['payment'];

    if (paymentStatus === 'success') {
      console.log('💳 Processing Stripe payment success callback');
      this.handleStripeCallback();
    } else if (paymentStatus === 'cancel') {
      console.log('❌ Payment was cancelled');
      this.hasError.set(true);
      this.showProcessingSpinner.set(false);
      this.router.navigate(['/pricing']);
    } else if (this.shouldShowRegistrationProcessing()) {
      console.log('✅ Registration success detected - starting standard flow');
      this.startStandardRegistrationFlow();
    } else {
      console.log('❌ No valid processing context - redirecting to dashboard');
      this.router.navigate(['/dashboard']);
    }
  }

  private handleStripeCallback(): void {
  console.log('💳 Processing Stripe payment callback');
  this.processingMessage.set('Processing your payment...');

  // ✅ Get user ID from localStorage (saved during registration)
  const pendingUserId = localStorage.getItem('pendingUserId'); 
  
  if (!pendingUserId) {
    console.error('❌ No pending user ID found');
    this.hasError.set(true);
    this.showProcessingSpinner.set(false);
    this.router.navigate(['/register']);
    return;
  }

  console.log('🔍 Checking payment status for user:', pendingUserId);
  
  const checkStatus = () => {
    // ✅ Check both collections
    const collections = ['originators', 'lenders'];
    
    for (const collection of collections) {
      getDoc(doc(this.firestore, `${collection}/${pendingUserId}`)).then((docSnap: any) => {
       if (docSnap.exists()) {
          const userData = docSnap.data();
          console.log('📄 User data:', userData);
          
          if (userData?.['subscriptionStatus'] === 'active' && !userData?.['paymentPending']) {
            // ✅ Payment processed successfully
            console.log('✅ Payment verified - showing success modal');
            this.userRole = userData?.['role'] || 'originator';
            this.showProcessingSpinner.set(false);
            this.showModalBasedOnRole();
            return;
          }
        }
      });
    }
  };

  // ✅ Poll every 2 seconds for up to 2 minutes
  const interval = setInterval(checkStatus, 2000);
  
  // ✅ Timeout after 2 minutes
  setTimeout(() => {
    clearInterval(interval);
    if (this.showProcessingSpinner()) {
      console.error('❌ Payment verification timeout');
      this.hasError.set(true);
      this.showProcessingSpinner.set(false);
      this.processingMessage.set('Payment verification timeout. Please contact support.');
    }
  }, 120000);
  
  // ✅ Start checking immediately
  checkStatus();
}
  

 /**
 * ✅ Handle originator payment success - Just show success modal (webhook handles status update)
 */
private handleOriginatorPaymentSuccess(): void {
  console.log('👤 Processing originator payment success');
  this.processingMessage.set('Payment successful! Finalizing your account...');

  // ✅ Set processing flag
  RegistrationProcessingComponent.processingInProgress = true;

  // ✅ Simple success flow - webhook already updated user status
  this.userRole = 'originator';
  this.authService.setRegistrationSuccess(true);
  
  setTimeout(() => {
    RegistrationProcessingComponent.processingInProgress = false;
    this.showModalBasedOnRole();
  }, 1500);
}

  /**
 * ✅ Handle lender payment success - Just show success modal (webhook handles status update)  
 */
private handleLenderPaymentSuccess(rawLenderData: string): void {
  console.log('🏢 Processing lender payment success');
  this.processingMessage.set('Payment successful! Finalizing your account...');

  try {
    const lenderData = JSON.parse(rawLenderData);
    const email = lenderData?.contactInfo?.contactEmail;

    if (!email) {
      throw new Error('Email is required');
    }

    // ✅ Set processing flag
    RegistrationProcessingComponent.processingInProgress = true;

    // ✅ Simple success flow - webhook already updated user status
    this.userRole = 'lender';
    this.authService.setRegistrationSuccess(true);
    
    setTimeout(() => {
      RegistrationProcessingComponent.processingInProgress = false;
      this.showModalBasedOnRole();
    }, 1500);

  } catch (error) {
    console.error('❌ Error in handleLenderPaymentSuccess:', error);
    this.hasError.set(true);
    this.showProcessingSpinner.set(false);
    RegistrationProcessingComponent.processingInProgress = false;
    this.router.navigate(['/register/lender']);
  }
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

    // Step 1: Load user data and determine role
    this.loadUserRole();

    // Step 2: After 1.5 seconds, hide spinner and show modal
    setTimeout(() => {
      console.log('🔄 Hiding spinner, showing modal...');
      this.showProcessingSpinner.set(false);
      this.showModalBasedOnRole();
    }, 1500);
  }

  private async loadUserRole(): Promise<void> {
  try {
    // ✅ Since backend creates users but doesn't log them in,
    // we'll determine role from localStorage or default to originator
    const pendingUserId = localStorage.getItem('pendingUserId');
    
    if (pendingUserId) {
      // User just registered, assume originator for now
      this.userRole = 'originator';
    } else {
      // Fallback 
      this.userRole = 'originator';
    }
    
    this.authService.setRegistrationSuccess(true);
    this.processingMessage.set('Success! Welcome to your dashboard...');

    setTimeout(() => {
      this.showModalBasedOnRole();
    }, 1500);
  } catch (error) {
    console.error('❌ Error during registration:', error);
    this.processingMessage.set('Failed to create user. Please try again.');
  }
}
  /**
   * ✅ Show appropriate modal based on user role
   */
  private showModalBasedOnRole(): void {
    const role = this.userRole;
    console.log('🎭 Showing modal for role:', role);
    this.showProcessingSpinner.set(false);

    setTimeout(() => {
      if (role === 'originator') {
        console.log('👤 Showing originator registration success modal');
        this.showRegistrationSuccessModal.set(true);
      } else if (role === 'lender') {
        console.log('🏢 Showing lender registration success modal');
        this.showLenderRegistrationSuccessModal.set(true);
      } else {
        console.warn('⚠️ Unknown role, showing default originator modal');
        this.showRegistrationSuccessModal.set(true);
      }

      // ✅ Clean up flags after modal is shown
      setTimeout(() => {
        this.clearRegistrationFlags();
      }, 100);
    }, 200);
  }

  closeRegistrationSuccessModal(): void {
    console.log('✅ Originator modal closed - redirecting to dashboard');

    // ✅ Hide modal first
    this.showRegistrationSuccessModal.set(false);

    // ✅ Small delay before redirect to allow modal close animation
    setTimeout(() => {
      this.redirectToDashboard();
    }, 100);
  }

  closeLenderRegistrationSuccessModal(): void {
    console.log('✅ Lender modal closed - redirecting to dashboard');

    // ✅ Hide modal first
    this.showLenderRegistrationSuccessModal.set(false);

    // ✅ Small delay before redirect to allow modal close animation
    setTimeout(() => {
      this.redirectToDashboard();
    }, 100);
  }

  private clearRegistrationFlags(): void {
    console.log('🧹 Clearing registration success flags');
    this.authService.clearRegistrationSuccess();
    localStorage.removeItem('showRegistrationModal');
    localStorage.removeItem('completeLenderData');
    localStorage.removeItem('completeOriginatorData');
  }

  private redirectToDashboard(): void {
    console.log('🎯 Redirecting to dashboard...');

    try {
      this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('❌ Error navigating to dashboard:', error);
      // ✅ Fallback: try direct navigation
      window.location.href = '/dashboard';
    }
  }

  /**
   * ✅ Clean up static flags when component is destroyed
   */
  ngOnDestroy(): void {
    // Only clear flags if no other processing is happening
    if (!RegistrationProcessingComponent.processingInProgress) {
      RegistrationProcessingComponent.processedEmails.clear();
    }
  }
}