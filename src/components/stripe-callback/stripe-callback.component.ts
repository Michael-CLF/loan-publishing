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
} from '@angular/fire/firestore';

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

  public isLoading = signal(true);
  public showSuccessModal = signal(false);
  public hasError = signal(false);

  ngOnInit(): void {
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
          this.showSuccessModal.set(true);
          this.isLoading.set(false);

          localStorage.removeItem('showRegistrationModal');
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 3000);
        } catch (error) {
          console.error('Error updating originator subscription status:', error);
          this.hasError.set(true);
          this.router.navigate(['/']);
        }
      }
    });
  }

  private handleLenderPaymentSuccess(rawLenderData: string): void {
    console.log('Processing lender payment success');
    const lenderData = JSON.parse(rawLenderData);
    const email = lenderData?.contactInfo?.contactEmail;

    if (!email) {
      this.hasError.set(true);
      this.router.navigate(['/register/lender']);
      return;
    }

    const password = 'placeholder-password-not-used';

    this.authService
      .registerUser(email, password, {
        role: 'lender',
        subscriptionStatus: 'active',      // ← Set to active immediately
        registrationCompleted: true,       // ← Set to true immediately
        paymentPending: false,             // ← Payment is complete
        userData: {
          firstName: lenderData.contactInfo.firstName,
          lastName: lenderData.contactInfo.lastName,
          company: lenderData.contactInfo.company,
          phone: lenderData.contactInfo.contactPhone,
          city: lenderData.contactInfo.city,
          state: lenderData.contactInfo.state,
        },
        lenderData: {
          contactInfo: lenderData.contactInfo,
          productInfo: lenderData.productInfo,
          footprintInfo: lenderData.footprintInfo,
        },
      })
      .pipe(take(1))
      .subscribe({
        next: async () => {
          try {
            // Additional update to ensure all fields are set
            const currentUser = await this.authService.getCurrentUser().pipe(take(1)).toPromise();
            if (currentUser && currentUser.uid) {
              const userRef = doc(this.firestore, `lenders/${currentUser.uid}`);
              await updateDoc(userRef, {
                paidAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              console.log('Updated lender subscription status to active');
            }

            localStorage.removeItem('showRegistrationModal');
            localStorage.removeItem('completeLenderData');

            this.modalService.openLenderRegistrationSuccessModal();
            this.showSuccessModal.set(true);
            this.isLoading.set(false);

            setTimeout(() => {
              this.router.navigate(['/dashboard']);
            }, 3000);
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
  }
}