import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { StripeService } from '../../services/stripe.service';
import { UserRegSuccessModalComponent } from '../../modals/user-reg-success-modal/user-reg-success-modal.component';
import { LenderRegSuccessModalComponent } from '../../modals/lender-reg-success-modal/lender-reg-success-modal.component';
import { of } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { ModalService } from '../../services/modal.service';
import { take } from 'rxjs/operators';
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
  private readonly modalService = inject(ModalService);

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
    this.showProcessingSpinner.set(false);
    this.hasError.set(false);

    setTimeout(() => {
      if (this.userRole === 'lender') {
        this.showLenderRegistrationSuccessModal.set(true);
      } else {
        this.showRegistrationSuccessModal.set(true);
      }
      this.clearRegistrationFlags();
    }, 200);
  }

  private getPendingUserData(): any {
    try {
      const pendingData = localStorage.getItem('pendingUserData');
      const completeLenderData = localStorage.getItem('completeLenderData');
      const completeOriginatorData = localStorage.getItem('completeOriginatorData');

      if (pendingData) {
        return JSON.parse(pendingData);
      } else if (completeOriginatorData) {
        return JSON.parse(completeOriginatorData);
      } else if (completeLenderData) {
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

  private handlePaymentCancellation(): void {
    this.hasError.set(true);
    this.showProcessingSpinner.set(false);
    this.processingMessage.set('Payment was cancelled');

    setTimeout(() => {
      this.router.navigate(['/pricing']);
    }, 2000);
  }

  private handleError(message: string): void {
    this.hasError.set(true);
    this.showProcessingSpinner.set(false);
    this.processingMessage.set(message);

    setTimeout(() => {
      this.router.navigate(['/pricing']);
    }, 3000);
  }

  private showSuccessModal(): void {
    console.log('🎭 Showing success modal for role:', this.userRole);
    this.showProcessingSpinner.set(false);
    this.authService.setRegistrationSuccess(true);

    setTimeout(() => {
      if (this.userRole === 'lender') {
        this.showLenderRegistrationSuccessModal.set(true);
      } else {
        this.showRegistrationSuccessModal.set(true);
      }
      this.clearRegistrationFlags();
    }, 200);
  }

  private shouldShowRegistrationProcessing(): boolean {
    return this.authService.getRegistrationSuccess() ||
      localStorage.getItem('showRegistrationModal') === 'true';
  }

  private startStandardRegistrationFlow(): void {
    console.log('🔄 Starting standard registration processing flow...');
    this.processingMessage.set('Setting up your account...');
    this.loadUserRole();
    setTimeout(() => {
      this.showSuccessModal();
    }, 1500);
  }

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
      this.router.navigate(['/dashboard']);
    }, 100);
  }

  closeLenderRegistrationSuccessModal(): void {
    console.log('✅ Lender modal closed - redirecting to dashboard');
    this.showLenderRegistrationSuccessModal.set(false);
    setTimeout(() => {
      this.router.navigate(['/dashboard']);
    }, 100);
  }

  private clearRegistrationFlags(): void {
    console.log('🧹 Clearing registration flags');
    localStorage.removeItem('showRegistrationModal');
    localStorage.removeItem('pendingUserData');
    localStorage.removeItem('completeLenderData');
    localStorage.removeItem('completeOriginatorData');
  }

  ngOnDestroy(): void {
    // Cleanup logic if needed
  }
}