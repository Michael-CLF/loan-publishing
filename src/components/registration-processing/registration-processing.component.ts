import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

import { Firestore, doc, getDoc } from '@angular/fire/firestore';

import { AuthService } from '../../services/auth.service';

import { UserRegSuccessModalComponent } from 'src/modals/user-reg-success-modal/user-reg-success-modal.component';
import { LenderRegSuccessModalComponent } from 'src/modals/lender-reg-success-modal/lender-reg-success-modal.component';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { User } from '@angular/fire/auth';


@Component({
  selector: 'app-registration-processing',
  standalone: true,
  imports: [
    CommonModule,
    UserRegSuccessModalComponent,
    LenderRegSuccessModalComponent,
  ],
  templateUrl: './registration-processing.component.html',
  styleUrls: ['./registration-processing.component.css'],
})
export class RegistrationProcessingComponent implements OnInit, OnDestroy {
  // Dependencies
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);

  // UI state
  showProcessingSpinner = signal(true);
  processingMessage = signal('Verifying your payment…');
  hasError = signal(false);

  // Optional modal state (referenced by close methods)
  showRegistrationSuccessModal = signal(false);
  showLenderRegistrationSuccessModal = signal(false);

  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    const user = await firstValueFrom(
  this.authService.getCurrentFirebaseUser().pipe(
    filter((u): u is User => !!u), // narrow to Firebase User
    take(1)
  )
);
const uid = user.uid;


    const qp = this.route.snapshot.queryParamMap;
    const paymentStatus = qp.get('payment'); // 'success' on return from Stripe

    if (paymentStatus === 'success') {
      // Just returned from Stripe — be lenient while webhook flips flags
      localStorage.setItem('showRegistrationModal', 'true');
      this.startPostPaymentWatcher(uid);
      return;
    }

    // Regular entry: just check the user’s profile once and route accordingly
    this.processingMessage.set('Checking your subscription…');
    this.handleSingleCheck(uid);
  }

  ngOnDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    localStorage.removeItem('showRegistrationModal');
  }

  // ----------------- Public (template) helpers -----------------

  closeRegistrationSuccessModal(): void {
    this.showRegistrationSuccessModal.set(false);
    this.navigateToDashboard();
  }

  closeLenderRegistrationSuccessModal(): void {
    this.showLenderRegistrationSuccessModal.set(false);
    this.navigateToDashboard();
  }

  // ----------------- Internal helpers -----------------

  private async handleSingleCheck(uid: string): Promise<void> {
    try {
      const profile = await this.getUserProfileByUid(uid);

      if (!profile) {
        // No profile yet; let the app take them to the right start
        this.processingMessage.set('No profile found. Redirecting…');
        this.navigateToDashboard();
        return;
      }

      if (profile.subscriptionStatus === 'active') {
        this.processingMessage.set('Success! Redirecting to dashboard…');
        this.finishToDashboard();
        return;
      }

      // Not active yet — send to pricing
      this.processingMessage.set('Subscription required. Redirecting…');
      this.router.navigate(['/pricing']);
    } catch (e) {
      console.error('handleSingleCheck error:', e);
      this.hasError.set(true);
      this.showProcessingSpinner.set(false);
    }
  }

  private startPostPaymentWatcher(uid: string): void {
    this.processingMessage.set('Finalizing your account…');

    const maxAttempts = 40; // ~2 minutes @ 3s
    const everyMs = 3000;
    let attempts = 0;

    this.intervalHandle = setInterval(async () => {
      attempts++;

      try {
        const profile = await this.getUserProfileByUid(uid);

        // If not found yet, keep polling — webhook may still be updating.
        if (profile) {
          // Webhook should set: paymentPending=false and subscriptionStatus='active'
          const isActive = profile.subscriptionStatus === 'active';

          if (isActive) {
            this.processingMessage.set('Success! Redirecting to dashboard…');
            if (this.intervalHandle) {
              clearInterval(this.intervalHandle);
              this.intervalHandle = null;
            }
            this.finishToDashboard();
            return;
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        // keep polling; transient errors are OK here
      }

      if (attempts >= maxAttempts) {
        if (this.intervalHandle) {
          clearInterval(this.intervalHandle);
          this.intervalHandle = null;
        }
        this.hasError.set(true);
        this.showProcessingSpinner.set(false);
        this.processingMessage.set(
          'Payment verification timeout. Please contact support.'
        );
        // Optional fallback
        this.navigateToDashboard();
      }
    }, everyMs);
  }

  private async getUserProfileByUid(uid: string): Promise<any | null> {
    // Check lenders first, then originators
    const lenderRef = doc(this.firestore, `lenders/${uid}`);
    const lenderSnap = await getDoc(lenderRef);
    if (lenderSnap.exists()) return lenderSnap.data();

    const originatorRef = doc(this.firestore, `originators/${uid}`);
    const originatorSnap = await getDoc(originatorRef);
    if (originatorSnap.exists()) return originatorSnap.data();

    return null;
  }

  private finishToDashboard(): void {
    this.showProcessingSpinner.set(false);
    setTimeout(() => this.navigateToDashboard(), 700);
  }

  private navigateToDashboard(): void {
    localStorage.removeItem('showRegistrationModal');
    this.router.navigate(['/dashboard']);
  }
}
