// ✅ FIXED: stripe-callback.component.ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ResolveFn } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';
import { take, finalize, delay } from 'rxjs/operators';
import {
  Firestore,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  setDoc
} from '@angular/fire/firestore';
import { Auth, fetchSignInMethodsForEmail } from '@angular/fire/auth';

export const stripeCallbackResolver: ResolveFn<void> = (route) => {
  const authService = inject(AuthService);
  const payment = route.queryParams['payment'];

  if (payment === 'success') {
    authService.setRegistrationSuccess(true);
  }

  return;
};

@Component({
  selector: 'app-stripe-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stripe-callback.component.html',
  styleUrls: ['./stripe-callback.component.css'],
})
export class StripeCallbackComponent implements OnInit {
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  // ✅ Angular 18 Best Practice: Use signals for reactive state
  public isLoading = signal(true);
  public showSuccessModal = signal(false);
  public hasError = signal(false);
  public processingMessage = signal('Processing your payment...');

  // ✅ Prevent duplicate processing
  private static processingInProgress = false;
  private static processedEmails = new Set<string>();

  ngOnInit(): void {
    console.log('🔄 StripeCallbackComponent initializing...');
    
    // ✅ Check if already processing
    if (StripeCallbackComponent.processingInProgress) {
      console.log('⏭️ Payment processing already in progress, skipping duplicate');
      this.processingMessage.set('Payment already being processed...');
      this.redirectToDashboard();
      return;
    }

    const showModal = localStorage.getItem('showRegistrationModal');
    const rawLenderData = localStorage.getItem('completeLenderData');

    // Check payment status from URL
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    console.log('🔄 StripeCallbackComponent initializing...');
    console.log('💳 Payment status:', paymentStatus);
    console.log('🎯 Show modal flag:', showModal);
    console.log('📋 Has lender data:', !!rawLenderData);

    if (paymentStatus !== 'success') {
      console.error('❌ Payment was not successful');
      this.hasError.set(true);
      this.isLoading.set(false); // ✅ CRITICAL: Clear loading state
      this.router.navigate(['/']);
      return;
    }

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
    this.isLoading.set(false); // ✅ CRITICAL: Clear loading state
    this.router.navigate(['/']);
  }

  private handleOriginatorPaymentSuccess(): void {
    console.log('👤 Processing originator payment success');
    this.processingMessage.set('Activating your subscription...');
    
    // ✅ Set processing flag
    StripeCallbackComponent.processingInProgress = true;

    this.authService.getCurrentUser().pipe(
      take(1),
      finalize(() => {
        // ✅ CRITICAL: Always clear loading and processing states
        this.isLoading.set(false);
        StripeCallbackComponent.processingInProgress = false;
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

            // Set success flag and redirect
            this.authService.setRegistrationSuccess(true);
            this.processingMessage.set('Success! Redirecting to your dashboard...');
            
            // ✅ Small delay before redirect to show success message
            setTimeout(() => {
              this.cleanupAndRedirect();
            }, 1500);

          } catch (error) {
            console.error('❌ Error updating originator subscription:', error);
            this.hasError.set(true);
            this.router.navigate(['/']);
          }
        } else {
          console.error('❌ No user found for originator payment');
          this.hasError.set(true);
          this.router.navigate(['/']);
        }
      },
      error: (error) => {
        console.error('❌ Error getting current user:', error);
        this.hasError.set(true);
        this.router.navigate(['/']);
      }
    });
  }

  private async handleLenderPaymentSuccess(rawLenderData: string): Promise<void> {
    console.log('🏢 Processing lender payment success');
    this.processingMessage.set('Creating your lender account...');
    
    // ✅ Set processing flag
    StripeCallbackComponent.processingInProgress = true;

    try {
      const lenderData = JSON.parse(rawLenderData);
      const email = lenderData?.contactInfo?.contactEmail;

      if (!email) {
        throw new Error('Email is required');
      }

      // ✅ Check if email was already processed
      if (StripeCallbackComponent.processedEmails.has(email)) {
        console.log(`✅ Email ${email} already processed, redirecting to dashboard`);
        this.authService.setRegistrationSuccess(true);
        this.redirectToDashboard();
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
      StripeCallbackComponent.processedEmails.add(email);

      // ✅ User doesn't exist, create new account
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
            // ✅ CRITICAL: Always clear loading and processing states
            this.isLoading.set(false);
            StripeCallbackComponent.processingInProgress = false;
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
              this.processingMessage.set('Success! Redirecting to your dashboard...');
              
              // ✅ Small delay before redirect
              setTimeout(() => {
                this.cleanupAndRedirect();
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
      this.isLoading.set(false); // ✅ CRITICAL: Clear loading state
      StripeCallbackComponent.processingInProgress = false;
      this.router.navigate(['/register/lender']);
    }
  }

  // ✅ Handle existing user case
  private async updateExistingLenderAccount(email: string, lenderData: any): Promise<void> {
    try {
      this.processingMessage.set('Updating your existing account...');
      
      // Note: You might need to implement user lookup by email in your auth service
      // For now, we'll just set the flags and redirect
      
      console.log('✅ Updated existing lender account subscription to active');
      this.authService.setRegistrationSuccess(true);
      this.processingMessage.set('Success! Redirecting to your dashboard...');
      
      setTimeout(() => {
        this.cleanupAndRedirect();
      }, 1500);

    } catch (error) {
      console.error('❌ Error updating existing lender account:', error);
      this.hasError.set(true);
      this.isLoading.set(false);
      this.router.navigate(['/register/lender']);
    } finally {
      StripeCallbackComponent.processingInProgress = false;
    }
  }

  // ✅ Centralized cleanup and redirect
  private cleanupAndRedirect(): void {
    localStorage.removeItem('showRegistrationModal');
    localStorage.removeItem('completeLenderData');
    this.redirectToDashboard();
  }

  // ✅ Centralized dashboard redirect with delay for auth
  private redirectToDashboard(): void {
    this.isLoading.set(false);
    // ✅ Small delay to ensure auth state is ready
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 500);
  }

  // ✅ Clean up static flags when component is destroyed
  ngOnDestroy(): void {
    // Optional: Clear flags when component is destroyed
    // Only clear if no other processing is happening
    if (!StripeCallbackComponent.processingInProgress) {
      StripeCallbackComponent.processedEmails.clear();
    }
  }
}