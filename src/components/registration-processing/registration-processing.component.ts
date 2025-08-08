import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserRegSuccessModalComponent } from '../../modals/user-reg-success-modal/user-reg-success-modal.component';
import { LenderRegSuccessModalComponent } from '../../modals/lender-reg-success-modal/lender-reg-success-modal.component';
import { LenderFormService } from '../../services/lender-registration.service';
import { LenderService } from 'src/services/lender.service';

import {
  Firestore,
  doc,
  getDoc,
  serverTimestamp
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
  private readonly lenderFormService = inject(LenderFormService);
  private readonly lenderService = inject(LenderService);

  showProcessingSpinner = signal(true);
  showRegistrationSuccessModal = signal(false);
  showLenderRegistrationSuccessModal = signal(false);
  processingMessage = signal('Setting up your account...');
  hasError = signal(false);

  private userRole: 'originator' | 'lender' | undefined = undefined;

  // Prevent duplicate processing
  private static processingInProgress = false;
  private static processedEmails = new Set<string>();

  constructor() {
    console.log('RegistrationProcessingComponent created');
    this.showProcessingSpinner.set(true);
    this.processingMessage.set('Loading...');
  }

  async ngOnInit(): Promise<void> {
    console.log('📥 Registration Processing Component 🟡 Starting...');

    RegistrationProcessingComponent.processingInProgress = false;

    console.log('🎯 Initial spinner state:', this.showProcessingSpinner());
    console.log('🎯 Query params:', this.route.snapshot.queryParams);
    console.log('🎯 localStorage showRegistrationModal:', localStorage.getItem('showRegistrationModal'));

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
   * Stripe success handler – polls the Firestore doc keyed by the REAL Firebase Auth UID
   */
  private handleStripeCallback(): void {
    console.log('💳 Processing Stripe payment callback');
    this.processingMessage.set('Verifying your payment...');

    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    if (!sessionId) {
      console.error('❌ No session ID found in URL – retrying...');
      this.processingMessage.set('Waiting for payment session...');
      return;
    }

    const uid = this.auth.currentUser ? this.auth.currentUser.uid : null;
    if (!uid) {
      console.error('❌ No authenticated Firebase UID found');
      this.hasError.set(true);
      this.showProcessingSpinner.set(false);
      this.processingMessage.set('Authentication error. Please log in.');
      this.router.navigate(['/login']);
      return;
    }

    let attempts = 0;
    const maxAttempts = 40;      // 2 minutes
    const intervalTime = 3000;   // 3s

    const interval = setInterval(async () => {
      attempts++;
      console.log(`⏳ Polling attempt #${attempts}`);

      for (const collectionName of ['originators', 'lenders']) {
        try {
          const docRef = doc(this.firestore, collectionName, uid);
          const snap = await getDoc(docRef);
          console.log(`📦 Checked ${collectionName}, document exists:`, snap.exists());

          if (snap.exists()) {
            const data = snap.data() as any;
            const userEmail = data?.email;
            const status = data?.subscriptionStatus;

            if (status === 'active') {
              console.log('✅ Stripe verified. Subscription active for:', userEmail);
              clearInterval(interval);

              this.userRole = (data?.role as 'originator' | 'lender') || (collectionName === 'lenders' ? 'lender' : 'originator');

              this.processingMessage.set('Success! Redirecting to dashboard...');
              setTimeout(() => {
                this.showProcessingSpinner.set(false);
                this.showModalBasedOnRole();
              }, 1500);

              // Clean localStorage remnants from legacy flow
              localStorage.removeItem('pendingLenderId');
              return;
            }
          }
        } catch (err) {
          console.error(`⚠️ Error checking ${collectionName} collection:`, err);
        }
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        this.hasError.set(true);
        this.showProcessingSpinner.set(false);
        this.processingMessage.set('Payment verification timeout. Please contact support.');
        console.error('❌ Stripe verification timeout after 2 minutes');
        this.router.navigate(['/dashboard']); // Optional fallback
      }
    }, intervalTime);
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
      console.log('🔄 Hiding spinner, showing modal...');
      this.showProcessingSpinner.set(false);
      this.showModalBasedOnRole();
    }, 1500);
  }

  private async loadUserRole(): Promise<void> {
    try {
      const pendingUserId = localStorage.getItem('pendingUserId');
      if (pendingUserId) {
        this.userRole = 'originator';
      } else {
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

      setTimeout(() => {
        this.clearRegistrationFlags();
      }, 100);
    }, 200);
  }

  closeRegistrationSuccessModal(): void {
    console.log('✅ Originator modal closed - redirecting to dashboard');
    this.showRegistrationSuccessModal.set(false);
    setTimeout(() => {
      this.redirectToDashboard('originator');
    }, 100);
  }

  closeLenderRegistrationSuccessModal(): void {
    console.log('✅ Lender modal closed - redirecting to dashboard');
    this.showLenderRegistrationSuccessModal.set(false);
    setTimeout(() => {
      this.redirectToDashboard('lender');
    }, 100);
  }

  private clearRegistrationFlags(): void {
    console.log('🧹 Clearing registration success flags');
    this.authService.clearRegistrationSuccess();
    localStorage.removeItem('showRegistrationModal');
    localStorage.removeItem('completeLenderData');
    localStorage.removeItem('completeOriginatorData');
  }

  private redirectToDashboard(role?: string): void {
    console.log('🎯 Redirecting to dashboard for role:', role || this.userRole);
    try {
      this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('❌ Error navigating to dashboard:', error);
      window.location.href = '/dashboard';
    }
  }

  ngOnDestroy(): void {
    if (!RegistrationProcessingComponent.processingInProgress) {
      RegistrationProcessingComponent.processedEmails.clear();
    }
  }
}
