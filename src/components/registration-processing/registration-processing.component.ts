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

  // ✅ Prevent duplicate processing
  private static processingInProgress = false;
  private static processedEmails = new Set<string>();

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

  /**
   * ✅ NEW: Handle Stripe payment callback
   */
  private handleStripeCallback(): void {
    console.log('💳 Processing Stripe payment callback');
    this.processingMessage.set('Processing your payment...');

    // ✅ Set processing flag
    RegistrationProcessingComponent.processingInProgress = true;

    const showModal = localStorage.getItem('showRegistrationModal');
    const rawLenderData = localStorage.getItem('completeLenderData');

    // ✅ ORIGINATOR FLOW: User is already registered, just update subscription
    if (showModal === 'true' && !rawLenderData) {
      console.log('👤 Processing originator payment success');
      this.handleOriginatorPaymentSuccess();
      return;
    }

    // ✅ LENDER FLOW: Complete registration after payment
    if (showModal === 'true' && rawLenderData) {
      console.log('🏢 Processing lender payment success');
      this.handleLenderPaymentSuccess(rawLenderData);
      return;
    }

    // ✅ Fallback: Neither condition met
    console.error('⚠️ Invalid payment callback state');
    this.hasError.set(true);
    this.showProcessingSpinner.set(false);
    RegistrationProcessingComponent.processingInProgress = false;
    this.router.navigate(['/pricing']);
  }

  /**
  * ✅ Handle originator payment success - CREATE user after payment
  */
  private handleOriginatorPaymentSuccess(): void {
    console.log('👤 Processing originator payment success');
    this.processingMessage.set('Creating your account...');

    const rawOriginatorData = localStorage.getItem('completeOriginatorData');

    if (!rawOriginatorData) {
      console.error('❌ No originator data found in localStorage');
      this.hasError.set(true);
      this.showProcessingSpinner.set(false);
      this.router.navigate(['/register']);
      return;
    }

    try {
      const originatorData = JSON.parse(rawOriginatorData);
      const email = originatorData.email;

      if (!email) {
        throw new Error('Email is required');
      }

      // ✅ Check if email was already processed (prevent double processing)
      if (RegistrationProcessingComponent.processedEmails.has(email)) {
        console.log(`✅ Email ${email} already processed, showing success modal`);
        this.userRole = 'originator';
        this.authService.setRegistrationSuccess(true);
        setTimeout(() => {
          this.showModalBasedOnRole();
        }, 1500);
        return;
      }

      // ✅ Add email to processed set
      RegistrationProcessingComponent.processedEmails.add(email);

      // ✅ NOW create the originator user after successful payment
      console.log('🔄 Creating originator user after payment success');
      this.processingMessage.set('Setting up your account...');

      this.authService.registerUser(email, 'defaultPassword123', {
        firstName: originatorData.firstName,
        lastName: originatorData.lastName,
        company: originatorData.company,
        phone: originatorData.phone,
        city: originatorData.city,
        state: originatorData.state,
        role: 'originator',
        subscriptionStatus: 'active',        // ✅ Set to active immediately
        registrationCompleted: true,         // ✅ Registration is complete
        paymentPending: false,               // ✅ Payment is done
        billingInterval: originatorData.billingInterval,
      })
        .pipe(
          take(1),
          finalize(() => {
            RegistrationProcessingComponent.processingInProgress = false;
          })
        )
        .subscribe({
          next: (user) => {
            console.log('✅ Originator user created successfully:', user);
            this.authService.setRegistrationSuccess(true);
            this.userRole = 'originator';
            this.processingMessage.set('Success! Welcome to your dashboard...');

            setTimeout(() => {
              this.showModalBasedOnRole();
            }, 1500);
          },
          error: (error) => {
            console.error('❌ Error creating originator user:', error);
            this.hasError.set(true);
            this.showProcessingSpinner.set(false);
            this.router.navigate(['/register']);
          }
        });

    } catch (error) {
      console.error('❌ Error parsing originator data:', error);
      this.hasError.set(true);
      this.showProcessingSpinner.set(false);
      RegistrationProcessingComponent.processingInProgress = false;
      this.router.navigate(['/register']);
    }
  }

  /**
  * ✅ Handle lender payment success - Angular Best Practice: Idempotent operation
  */
  private async handleLenderPaymentSuccess(rawLenderData: string): Promise<void> {
    console.log('🏢 Processing lender payment success');
    this.processingMessage.set('Finalizing your lender account...');

    try {
      const lenderData = JSON.parse(rawLenderData);
      const email = lenderData?.contactInfo?.contactEmail;
      const userId = lenderData?.userId;

      if (!email) {
        throw new Error('Email is required');
      }

      // ✅ Check if email was already processed (prevent double processing)
      if (RegistrationProcessingComponent.processedEmails.has(email)) {
        console.log(`✅ Email ${email} already processed, showing success modal`);
        this.userRole = 'lender';
        this.authService.setRegistrationSuccess(true);
        setTimeout(() => {
          this.showModalBasedOnRole();
        }, 1500);
        return;
      }

      // ✅ Add email to processed set
      RegistrationProcessingComponent.processedEmails.add(email);

      // ✅ Angular Best Practice: Idempotent operation - user should already exist from pre-registration
      console.log('✅ Updating existing lender subscription status to active');
      this.processingMessage.set('Activating your subscription...');

      if (userId) {
        // Update the pre-registered user to active status
        const userRef = doc(this.firestore, `lenders/${userId}`);
        await updateDoc(userRef, {
          subscriptionStatus: 'active',
          registrationCompleted: true,
          paymentPending: false,
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        console.log('✅ Updated lender subscription status to active');
        this.authService.setRegistrationSuccess(true);
        this.userRole = 'lender';
        this.processingMessage.set('Success! Welcome to your dashboard...');

        setTimeout(() => {
          this.showModalBasedOnRole();
        }, 1500);

      } else {
        throw new Error('User ID not found in stored data');
      }

    } catch (error) {
      console.error('❌ Error in handleLenderPaymentSuccess:', error);
      this.hasError.set(true);
      this.showProcessingSpinner.set(false);
      RegistrationProcessingComponent.processingInProgress = false;
      this.router.navigate(['/register/lender']);
    } finally {
      RegistrationProcessingComponent.processingInProgress = false;
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
        this.userRole = 'originator'; // Default fallback
      }
    });
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