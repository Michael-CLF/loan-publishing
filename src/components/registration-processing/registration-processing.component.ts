import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registration-processing',
  standalone: true,
  imports: [],
  templateUrl: './registration-processing.component.html',
  styleUrls: ['./registration-processing.component.css'],
})
export class RegistrationProcessingComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);

  // UI state
  showProcessingSpinner = signal(true);
  processingMessage = signal('Verifying your payment…');
  hasError = signal(false);

  private intervalHandle: any = null;

  async ngOnInit(): Promise<void> {
    // Always ensure we have an auth session (anonymous if needed)
    const user = await this.authService.ensureSignedIn();
    const uid = user.uid;

    const qp = this.route.snapshot.queryParamMap;
    const paymentStatus = qp.get('payment'); // 'success' when coming back from Stripe

    if (paymentStatus === 'success') {
      // We just returned from Stripe — be lenient while webhook flips flags
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

  // ----------------- Helpers -----------------

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

    const maxAttempts = 40;   // ~2 minutes @ 3s
    const everyMs = 3000;
    let attempts = 0;

    this.intervalHandle = setInterval(async () => {
      attempts++;

      try {
        const profile = await this.getUserProfileByUid(uid);
        // If not found yet, keep polling — webhook may still be updating.
        if (profile) {
          // Expect webhook to set: paymentPending=false and subscriptionStatus='active'
          const isActive = profile.subscriptionStatus === 'active';
          const notPending = profile.paymentPending === false;

          if (isActive || (isActive && notPending)) {
            this.processingMessage.set('Success! Redirecting to dashboard…');
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
            this.finishToDashboard();
            return;
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
        // keep polling; transient errors are OK here
      }

      if (attempts >= maxAttempts) {
        clearInterval(this.intervalHandle);
        this.intervalHandle = null;
        this.hasError.set(true);
        this.showProcessingSpinner.set(false);
        this.processingMessage.set('Payment verification timeout. Please contact support.');
        this.navigateToDashboard(); // optional fallback
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
