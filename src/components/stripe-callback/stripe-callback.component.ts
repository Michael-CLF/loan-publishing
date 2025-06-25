import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ResolveFn } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';
import { take } from 'rxjs/operators';
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

  public isLoading = signal(true);
  public showSuccessModal = signal(false);
  public hasError = signal(false);

  // ✅ CRITICAL FIX: Prevent duplicate processing
  private static processingInProgress = false;
  private static processedEmails = new Set<string>();

  ngOnInit(): void {
    // ✅ CRITICAL FIX: Check if already processing
    if (StripeCallbackComponent.processingInProgress) {
      console.log('Payment processing already in progress, skipping duplicate');
      return;
    }

    const showModal = localStorage.getItem('showRegistrationModal');
    const rawLenderData = localStorage.getItem('completeLenderData');

    // Check if this is a successful payment
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');

    if (paymentStatus !== 'success') {
      this.hasError.set(true);
      this.router.navigate(['/']);
      return;
    }

    // ORIGINATOR FLOW: User is already registered, update subscription status
    if (showModal === 'true' && !rawLenderData) {
      this.handleOriginatorPaymentSuccess();
      return;
    }

    // LENDER FLOW: Need to complete registration after payment
    if (showModal === 'true' && rawLenderData) {
      this.handleLenderPaymentSuccess(rawLenderData);
      return;
    }

    // If neither condition is met, something went wrong
    console.error('Invalid payment callback state');
    this.hasError.set(true);
    this.router.navigate(['/']);
  }

  private handleOriginatorPaymentSuccess(): void {
    console.log('Processing originator payment success');

    // ✅ CRITICAL FIX: Set processing flag
    StripeCallbackComponent.processingInProgress = true;

    this.authService.getCurrentUser().pipe(take(1)).subscribe(async (user) => {
      if (user && user.uid) {
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

          console.log('Updated originator subscription status to active');

          // Show modal and redirect
          this.authService.setRegistrationSuccess(true);
          localStorage.removeItem('showRegistrationModal');
          this.router.navigate(['/dashboard']);

        } catch (error) {
          console.error('Error updating originator subscription status:', error);
          this.hasError.set(true);
          this.router.navigate(['/']);
        } finally {
          // ✅ CRITICAL FIX: Clear processing flag
          StripeCallbackComponent.processingInProgress = false;
        }
      }
    });
  }

  private async handleLenderPaymentSuccess(rawLenderData: string): Promise<void> {
    console.log('Processing lender payment success');
    
    // ✅ CRITICAL FIX: Set processing flag
    StripeCallbackComponent.processingInProgress = true;

    try {
      const lenderData = JSON.parse(rawLenderData);
      const email = lenderData?.contactInfo?.contactEmail;

      if (!email) {
        this.hasError.set(true);
        this.router.navigate(['/register/lender']);
        return;
      }

      // ✅ CRITICAL FIX: Check if email was already processed
      if (StripeCallbackComponent.processedEmails.has(email)) {
        console.log(`Email ${email} already processed, redirecting to dashboard`);
        this.authService.setRegistrationSuccess(true);
        this.router.navigate(['/dashboard']);
        return;
      }

      // ✅ CRITICAL FIX: Check if user already exists in Firebase Auth
      const signInMethods = await fetchSignInMethodsForEmail(this.auth, email);
      
      if (signInMethods.length > 0) {
        console.log(`User with email ${email} already exists, updating existing account`);
        await this.updateExistingLenderAccount(email, lenderData);
        return;
      }

      // ✅ CRITICAL FIX: Add email to processed set
      StripeCallbackComponent.processedEmails.add(email);

      // User doesn't exist, create new account
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
        .pipe(take(1))
        .subscribe({
          next: async () => {
            try {
              const currentUser = await this.authService.getCurrentUser().pipe(take(1)).toPromise();
              if (currentUser && currentUser.uid) {
                const userRef = doc(this.firestore, `lenders/${currentUser.uid}`);
                await updateDoc(userRef, {
                  paidAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                console.log('Updated lender subscription status to active');
              }

              this.authService.setRegistrationSuccess(true);
              this.cleanupAndRedirect();

            } catch (error) {
              console.error('Error updating lender subscription status:', error);
              this.hasError.set(true);
              this.router.navigate(['/register/lender']);
            }
          },
          error: (err) => {
            console.error('Lender registration after payment failed:', err);
            this.hasError.set(true);
            this.router.navigate(['/register/lender']);
          },
        });

    } catch (error) {
      console.error('Error in handleLenderPaymentSuccess:', error);
      this.hasError.set(true);
      this.router.navigate(['/register/lender']);
    } finally {
      // ✅ CRITICAL FIX: Clear processing flag
      StripeCallbackComponent.processingInProgress = false;
    }
  }

  // ✅ NEW METHOD: Handle existing user case
  private async updateExistingLenderAccount(email: string, lenderData: any): Promise<void> {
    try {
      // Try to find existing user document by email
      const collections = ['lenders', 'originators'];
      
      for (const collection of collections) {
        // Search for user by email in each collection
        const userDocRef = doc(this.firestore, `${collection}/${email.replace('@', '_').replace('.', '_')}`);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          // Found existing user, update their subscription
          await updateDoc(userDocRef, {
            subscriptionStatus: 'active',
            registrationCompleted: true,
            paymentPending: false,
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            // Update with new lender data if it's a lender
            ...(collection === 'lenders' && {
              contactInfo: lenderData.contactInfo,
              productInfo: lenderData.productInfo,
              footprintInfo: lenderData.footprintInfo,
            })
          });

          console.log(`Updated existing ${collection} account subscription to active`);
          this.authService.setRegistrationSuccess(true);
          this.cleanupAndRedirect();
          return;
        }
      }

      // If no document found, the auth user exists but no Firestore doc
      // This shouldn't happen, but handle gracefully
      console.warn('Firebase Auth user exists but no Firestore document found');
      this.hasError.set(true);
      this.router.navigate(['/register/lender']);

    } catch (error) {
      console.error('Error updating existing lender account:', error);
      this.hasError.set(true);
      this.router.navigate(['/register/lender']);
    }
  }

  // ✅ NEW METHOD: Centralized cleanup
  private cleanupAndRedirect(): void {
    localStorage.removeItem('showRegistrationModal');
    localStorage.removeItem('completeLenderData');
    this.router.navigate(['/dashboard']);
  }

  // ✅ NEW METHOD: Clear static flags when component is destroyed
  ngOnDestroy(): void {
    // Clear flags when component is destroyed (optional cleanup)
    // Don't clear processingInProgress here as it might still be needed
  }
}