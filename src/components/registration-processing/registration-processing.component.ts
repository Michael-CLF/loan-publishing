import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserRegSuccessModalComponent } from '../../modals/user-reg-success-modal/user-reg-success-modal.component';
import { LenderRegSuccessModalComponent } from '../../modals/lender-reg-success-modal/lender-reg-success-modal.component';
import { take, finalize } from 'rxjs/operators';
import { LenderFormService } from '../../services/lender-registration.service';
import { LenderService } from 'src/services/lender.service';
import { firstValueFrom } from 'rxjs';


import {
  Query,
  DocumentData,
  QuerySnapshot,
  QueryDocumentSnapshot
} from 'firebase/firestore';

import {
  Firestore,
  doc,
  query,
  where,
  collection,
  getDocs,
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
  private readonly lenderFormService = inject(LenderFormService);
  private readonly lenderService = inject(LenderService);


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

  async ngOnInit(): Promise<void> {
    console.log('📥 Registration Processing Component 🟡 Starting...');

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
    this.processingMessage.set('Verifying your payment...');

    const sessionId = this.route.snapshot.queryParamMap.get('session_id');

    if (!sessionId) {
      console.error('❌ No session ID found in URL – retrying...');
      this.processingMessage.set('Waiting for payment session...');
      return;
    }

    let attempts = 0;
    const maxAttempts = 40;
    const intervalTime = 3000;

    const interval = setInterval(async () => {
      console.log(`⏳ Polling attempt #${attempts}`);
      attempts++;

      for (const collectionName of ['originators', 'lenders']) {
        try {
          // Get the pending lender ID from localStorage
          const pendingLenderId = localStorage.getItem('pendingLenderId');
          if (!pendingLenderId) {
            console.error('❌ No pending lender ID found for', collectionName);
            continue;
          }

          // Direct document lookup - no complex query needed  
          const docRef = doc(this.firestore, collectionName, pendingLenderId);
          const docSnap = await getDoc(docRef);
          console.log(`📦 Checked collection ${collectionName}, document exists:`, docSnap.exists());
          if (docSnap.exists() && docSnap.data()['subscriptionStatus'] === 'active') {
            const userData = docSnap.data();
            const userEmail = userData?.['email'];

            console.log('✅ Stripe verified. User authenticated:', userEmail);
            clearInterval(interval);
            this.userRole = userData?.['role'] || 'originator';
            this.processingMessage.set('Logging you in...');
            // Clear the pending ID
            localStorage.removeItem('pendingLenderId');

            if (userEmail) {
              console.log('🚀 Calling authenticateNewUser with:', userEmail, sessionId);

              this.authService.authenticateNewUser(userEmail, sessionId).subscribe({
                next: () => {
                  console.log('✅ User authenticated successfully');
                  this.processingMessage.set('Success! Redirecting to dashboard...');

                  setTimeout(() => {
                    this.showProcessingSpinner.set(false);
                    this.showModalBasedOnRole();
                  }, 1500);
                },
                error: (error) => {
                  console.error('❌ Authentication failed:', error);
                  this.hasError.set(true);
                  this.showProcessingSpinner.set(false);
                  this.processingMessage.set('Authentication failed. Please try logging in.');
                  this.router.navigate(['/login']);
                }
              });
            } else {
              console.error('❌ No email in verified user document');
              this.hasError.set(true);
              this.showProcessingSpinner.set(false);
              this.processingMessage.set('Email not found after verification.');
            }
            return;
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
    if (role === 'lender') {
      this.loadAndProcessDraft();
    }
    this.showProcessingSpinner.set(false);

    setTimeout(() => {
      if (role === 'originator') {
        console.log('👤 Showing originator registration success modal');
        this.showRegistrationSuccessModal.set(true);
      } else if (role === 'lender') {
        console.log('🏢 Showing lender registration success modal');
        this.showLenderRegistrationSuccessModal.set(true);
        if (role === 'lender') {
          this.loadAndProcessDraft();
        }
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

  private async loadAndProcessDraft(): Promise<void> {
    const draftId = this.lenderFormService.getCurrentDraftId();

    if (!draftId || this.userRole !== 'lender') {
      return;
    }

    try {
      const user = await firstValueFrom(this.authService.getCurrentFirebaseUser());
      if (!user?.uid) {
        console.warn('No authenticated user for draft processing');
        return;
      }

      const draftData = await firstValueFrom(
        this.lenderFormService.loadDraft(draftId)
      );

      if (draftData) {
        console.log('✅ Processing draft after authentication');
        await this.lenderService.updateLenderFromDraft(user.uid, draftId);
        this.lenderFormService.clearDraft();
      }
    } catch (error) {
      console.error('❌ Error processing draft:', error);
    }
  }

  closeRegistrationSuccessModal(): void {
    console.log('✅ Originator modal closed - redirecting to dashboard');

    // ✅ Hide modal first
    this.showRegistrationSuccessModal.set(false);

    // ✅ Small delay before redirect to allow modal close animation
    setTimeout(() => {
      this.redirectToDashboard('originator'); // Pass role
    }, 100);
  }

  closeLenderRegistrationSuccessModal(): void {
    console.log('✅ Lender modal closed - redirecting to dashboard');

    // ✅ Hide modal first
    this.showLenderRegistrationSuccessModal.set(false);

    // ✅ Small delay before redirect to allow modal close animation
    setTimeout(() => {
      this.redirectToDashboard('lender'); // Pass role
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
      // ✅ Route based on user role
      if (role === 'lender' || this.userRole === 'lender') {
        this.router.navigate(['/dashboard']); // Same route but dashboard component will handle the role
      } else {
        this.router.navigate(['/dashboard']);
      }
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