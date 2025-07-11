import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { StripeService } from '../../services/stripe.service';
import { UserRegSuccessModalComponent } from '../../modals/user-reg-success-modal/user-reg-success-modal.component';
import { LenderRegSuccessModalComponent } from '../../modals/lender-reg-success-modal/lender-reg-success-modal.component';
import { from, of } from 'rxjs';  // ✅ Added 'of' here
import { signInWithCustomToken } from '@angular/fire/auth';
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

    // First, try to get user role from stored data
    const pendingData = this.getPendingUserData();
    if (pendingData?.role) {
      this.userRole = pendingData.role as 'originator' | 'lender';
    }

    // Retry logic for webhook race condition
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    const attemptTokenRetrieval = () => {
      this.stripeService.getSessionDetails(sessionId)
        .pipe(
          take(1),
          tap(() => {
            this.processingMessage.set('Authenticating user...');
          }),
          catchError((error) => {
            console.error(`❌ Attempt ${retryCount + 1} failed:`, error);
            
            if (error.status === 404 && retryCount < maxRetries) {
              retryCount++;
              console.log(`🔄 Webhook may not have completed yet. Retrying in ${retryDelay}ms... (${retryCount}/${maxRetries})`);
              this.processingMessage.set(`Waiting for payment confirmation... (${retryCount}/${maxRetries})`);
              
              // Retry after delay
              setTimeout(() => attemptTokenRetrieval(), retryDelay);
              return of(null); // Return null to prevent error propagation
            }
            
            throw error; // Propagate error if max retries reached
          })
        )
        .subscribe({
          next: async (response) => {
            if (!response) return; // Null response means we're retrying
            
            const firebaseToken = (response as any)?.firebaseToken;
            
            if (!firebaseToken) {
              console.error('❌ No Firebase token in response:', response);
              this.handleError('Authentication token not found. Please try logging in manually.');
              return;
            }

            try {
              console.log('🔐 Signing in with custom token...');
              this.processingMessage.set('Logging you in...');
              
              const userCredential = await signInWithCustomToken(this.auth, firebaseToken);
              
              console.log('✅ Firebase authentication successful:', userCredential.user.email);
              console.log('📧 User email:', userCredential.user.email);
              console.log('🆔 User UID:', userCredential.user.uid);
              
              // Set registration success flag
              this.authService.setRegistrationSuccess(true);
              
              // Update message
              this.processingMessage.set('Success! Preparing your dashboard...');
              
              // Short delay before showing modal
              setTimeout(() => {
                this.showSuccessModalAndRedirect();
              }, 1000);
              
            } catch (authError: any) {
              console.error('❌ Firebase authentication failed:', authError);
              
              // More specific error messages
              if (authError.code === 'auth/invalid-custom-token') {
                this.handleError('Authentication token is invalid. Please contact support.');
              } else if (authError.code === 'auth/network-request-failed') {
                this.handleError('Network error during authentication. Please check your connection.');
              } else {
                this.handleError('Authentication failed. Please try logging in manually.');
              }
            }
          },
          error: (error) => {
            console.error('❌ Failed to retrieve session after all retries:', error);
            
            if (error.status === 404) {
              this.handleError('Payment verification is taking longer than expected. Please check your email for confirmation and try logging in.');
            } else if (error.status === 401) {
              this.handleError('Session expired. Please try registering again.');
            } else {
              this.handleError('Could not verify your payment. Please contact support if you were charged.');
            }
          }
        });
    };

    // Start the token retrieval process
    attemptTokenRetrieval();
  }
  


  /**
   * ✅ NEW: Proper Angular/Firebase authentication using custom token
   */
  private authenticateWithCustomToken(sessionId: string): void {
    this.processingMessage.set('Logging you in...');

    // ✅ Get custom token from Firestore authTokens collection
    this.firestoreService.getDocument(`authTokens/${sessionId}`)
      .pipe(
        take(1),
        switchMap((tokenDoc: any) => {
          if (!tokenDoc?.customToken) {
            throw new Error('Authentication token not found');
          }

          console.log('🔑 Custom token retrieved, authenticating user...');

          // ✅ Use Firebase Auth signInWithCustomToken (proper approach)
          return from(signInWithCustomToken(this.auth, tokenDoc.customToken));
        }),
        tap(() => {
          // ✅ Clean up the temporary token after successful auth
          this.firestoreService.deleteDocument(`authTokens/${sessionId}`)
            .catch((error: any) => console.warn('Could not clean up auth token:', error));
        }),
        finalize(() => {
          console.log('🔄 Custom token authentication process completed');
        })
      )
      .subscribe({
        next: (userCredential: any) => {
          console.log('✅ User properly authenticated via custom token:', userCredential.user.email);
          this.processingMessage.set('Success! Welcome to your dashboard...');

          // ✅ Set registration success through proper AuthService
          this.authService.setRegistrationSuccess(true);

          setTimeout(() => {
            this.showSuccessModalAndRedirectToDashboard();
          }, 1500);
        },
        error: (error: any) => {
          console.error('❌ Custom token authentication failed:', error);
          this.handleError('Registration completed but authentication failed. Please try logging in manually.');
        }
      });
  }

  /**
   * ✅ NEW: Show success modal then redirect to dashboard
   */
  private showSuccessModalAndRedirectToDashboard(): void {
    console.log('🎭 Showing success modal and preparing dashboard redirect');
    this.showProcessingSpinner.set(false);

    setTimeout(() => {
      if (this.userRole === 'lender') {
        this.showLenderRegistrationSuccessModal.set(true);
      } else {
        this.showRegistrationSuccessModal.set(true);
      }
      this.clearRegistrationFlags();
    }, 200);
  }

  /**
   * Show success modal then redirect to dashboard
   * Angular 18 Best Practice: Clear method naming and signal usage
   */
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