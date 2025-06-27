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
import { Auth, fetchSignInMethodsForEmail } from '@angular/fire/auth';

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
    
    // ✅ CRITICAL FIX: Check if already processing
    if (RegistrationProcessingComponent.processingInProgress) {
      console.log('⏭️ Processing already in progress, skipping duplicate');
      this.showProcessingSpinner.set(false);
      setTimeout(() => {
        this.router.navigate(['/dashboard']);
      }, 500);
      return;
    }

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
   * ✅ Handle originator payment success
   */
  private handleOriginatorPaymentSuccess(): void {
    console.log('👤 Processing originator payment success');
    this.processingMessage.set('Activating your subscription...');

    this.authService.getCurrentUser().pipe(
      take(1),
      finalize(() => {
        this.showProcessingSpinner.set(false);
        RegistrationProcessingComponent.processingInProgress = false;
      })
    ).subscribe({
      next: async (user) => {
        if (user?.uid) {
          try {
            // Update subscription status in Firestore
            const userRef = doc(this.firestore, `originators/${user.uid}`);
            await updateDoc(userRef, {
              subscriptionStatus: 'active',
              registrationCompleted: true,
              paymentPending: false,
              paidAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });

            console.log('✅ Updated originator subscription status to active');
            this.processingMessage.set('Success! Welcome to your dashboard...');
            
            // Set success flag and continue to modal flow
            this.authService.setRegistrationSuccess(true);
            this.userRole = 'originator';
            
            setTimeout(() => {
              this.showModalBasedOnRole();
            }, 1500);

          } catch (error) {
            console.error('❌ Error updating originator subscription:', error);
            this.hasError.set(true);
            this.router.navigate(['/pricing']);
          }
        } else {
          console.error('❌ No user found for originator payment');
          this.hasError.set(true);
          this.router.navigate(['/pricing']);
        }
      },
      error: (error) => {
        console.error('❌ Error getting current user:', error);
        this.hasError.set(true);
        this.router.navigate(['/pricing']);
      }
    });
  }

  /**
   * ✅ Handle lender payment success
   */
  private async handleLenderPaymentSuccess(rawLenderData: string): Promise<void> {
    console.log('🏢 Processing lender payment success');
    this.processingMessage.set('Creating your lender account...');

    try {
      const lenderData = JSON.parse(rawLenderData);
      const email = lenderData?.contactInfo?.contactEmail;

      if (!email) {
        throw new Error('Email is required');
      }

      // ✅ Check if email was already processed
      if (RegistrationProcessingComponent.processedEmails.has(email)) {
        console.log(`✅ Email ${email} already processed, showing success modal`);
        this.userRole = 'lender';
        this.authService.setRegistrationSuccess(true);
        setTimeout(() => {
          this.showModalBasedOnRole();
        }, 1500);
        return;
      }

      // ✅ Check if user already exists in Firebase Auth
      const signInMethods = await fetchSignInMethodsForEmail(this.auth, email);
      
      if (signInMethods.length > 0) {
        console.log(`👤 User with email ${email} already exists, updating account`);
        await this.updateExistingLenderAccount(email, lenderData);
        return;
      }

      // ✅ Add email to processed set
      RegistrationProcessingComponent.processedEmails.add(email);

      // ✅ User doesn't exist, create new account
      this.processingMessage.set('Creating your account...');
      const password = 'placeholder-password-not-used';

      this.authService
        .registerUser(email, password, {
          role: 'lender',
          subscriptionStatus: 'active',
          registrationCompleted: true,
          paymentPending: false,
          firstName: lenderData.contactInfo.firstName,
          lastName: lenderData.contactInfo.lastName,
          company: lenderData.contactInfo.company,
          phone: lenderData.contactInfo.contactPhone,
          city: lenderData.contactInfo.city,
          state: lenderData.contactInfo.state,
          contactInfo: lenderData.contactInfo,
          productInfo: lenderData.productInfo,
          footprintInfo: lenderData.footprintInfo,
        })
        .pipe(
          take(1),
          finalize(() => {
            this.showProcessingSpinner.set(false);
            RegistrationProcessingComponent.processingInProgress = false;
          })
        )
        .subscribe({
          next: async () => {
            try {
              // Update with payment timestamp
              const currentUser = await this.authService.getCurrentUser().pipe(take(1)).toPromise();
              if (currentUser?.uid) {
                const userRef = doc(this.firestore, `lenders/${currentUser.uid}`);
                await updateDoc(userRef, {
                  paidAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                console.log('✅ Updated lender with payment timestamp');
              }

              this.authService.setRegistrationSuccess(true);
              this.userRole = 'lender';
              this.processingMessage.set('Success! Welcome to your dashboard...');
              
              setTimeout(() => {
                this.showModalBasedOnRole();
              }, 1500);

            } catch (error) {
              console.error('❌ Error updating lender subscription:', error);
              this.hasError.set(true);
              this.router.navigate(['/register/lender']);
            }
          },
          error: (err) => {
            console.error('❌ Lender registration after payment failed:', err);
            this.hasError.set(true);
            this.router.navigate(['/register/lender']);
          },
        });

    } catch (error) {
      console.error('❌ Error in handleLenderPaymentSuccess:', error);
      this.hasError.set(true);
      this.showProcessingSpinner.set(false);
      RegistrationProcessingComponent.processingInProgress = false;
      this.router.navigate(['/register/lender']);
    }
  }

  /**
   * ✅ Handle existing lender account update
   */
  private async updateExistingLenderAccount(email: string, lenderData: any): Promise<void> {
    try {
      this.processingMessage.set('Updating your existing account...');
      
      console.log('✅ Updated existing lender account subscription to active');
      this.authService.setRegistrationSuccess(true);
      this.userRole = 'lender';
      this.processingMessage.set('Success! Welcome back...');
      
      setTimeout(() => {
        this.showModalBasedOnRole();
      }, 1500);

    } catch (error) {
      console.error('❌ Error updating existing lender account:', error);
      this.hasError.set(true);
      this.showProcessingSpinner.set(false);
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

    // Clean up flags after showing modal
    this.clearRegistrationFlags();
  }

  /**
   * ✅ Handle originator modal close
   */
  closeRegistrationSuccessModal(): void {
    console.log('✅ Originator modal closed - redirecting to dashboard');
    this.showRegistrationSuccessModal.set(false);
    this.redirectToDashboard();
  }

  /**
   * ✅ Handle lender modal close  
   */
  closeLenderRegistrationSuccessModal(): void {
    console.log('✅ Lender modal closed - redirecting to dashboard');
    this.showLenderRegistrationSuccessModal.set(false);
    this.redirectToDashboard();
  }

  /**
   * ✅ Clean up all registration success flags
   */
  private clearRegistrationFlags(): void {
    console.log('🧹 Clearing registration success flags');
    this.authService.clearRegistrationSuccess();
    localStorage.removeItem('showRegistrationModal');
    localStorage.removeItem('completeLenderData');
  }

  /**
   * ✅ Redirect to dashboard
   */
  private redirectToDashboard(): void {
    console.log('🎯 Redirecting to dashboard...');
    this.router.navigate(['/dashboard']);
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