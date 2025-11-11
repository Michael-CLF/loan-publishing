// src/app/components/auth/email-login/email-login.component.ts
import { Component, OnInit, inject, NgZone, signal, computed } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../services/auth.service';
import { OTPService } from '../../services/otp.service';
import { ModalService } from '../../services/modal.service';

import { Auth, authState, User } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import { AdminStateService } from 'src/services/admin-state.service';

@Component({
  selector: 'app-email-login',
  templateUrl: './email-login.component.html',
  styleUrls: ['./email-login.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, CommonModule],
})
export class EmailLoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  public otpService: OTPService = inject(OTPService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private modalService = inject(ModalService);
  private route = inject(ActivatedRoute);
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private adminState = inject(AdminStateService);

  loginForm: FormGroup;

  // Signals
  currentStep = signal<'email' | 'code' | 'verifying'>('email');
  errorMessage = signal<string>('');
  otpCode = signal<string>('');

  // Computed
  isLoading = computed(() => this.otpService.isLoading());
  otpSent = computed(() => this.otpService.otpSent());
  timeRemaining = computed(() => this.otpService.formatTimeRemaining());
  attemptsRemaining = computed(() => this.otpService.attemptsRemaining());

  // 6-digit input
  codeDigits = signal<string[]>(['', '', '', '', '', '']);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    console.log('✅ OTP Email login component initializing...');
    firstValueFrom(authState(this.auth)).then((u: User | null) => {
      if (u) this.redirectAfterLogin();
    });
  }

  // ---------- unified post-login routing ----------
  private getNextUrl(): string | null {
    const qp = this.route.snapshot.queryParamMap.get('next');
    if (qp) {
      localStorage.setItem('postLoginNext', qp);
      return qp;
    }
    return localStorage.getItem('postLoginNext');
  }

  private async redirectAfterLogin(): Promise<void> {
    // 1. Get the 'next' URL parameter to honor prior navigation intent
    const nextUrl = this.route.snapshot.queryParams['next'];

    // 2. Perform the authoritative admin check using the dedicated service
    const isAdmin = await this.adminState.checkAuthStatus(); // True if admins/{uid} exists

    if (isAdmin) {
        // 3. ADMIN: Prioritize previous admin intent, otherwise default to Admin Dashboard
        if (nextUrl && nextUrl.startsWith('/admin')) {
            await this.router.navigateByUrl(nextUrl);
        } else {
            await this.router.navigateByUrl('/admin/dashboard');
        }
    } else {
        // 4. LENDER/ORIGINATOR (Non-Admin User):
        // Prioritize previous non-admin intent, otherwise default to User Dashboard
        if (nextUrl && !nextUrl.startsWith('/admin')) {
            await this.router.navigateByUrl(nextUrl);
        } else {
            await this.router.navigateByUrl('/dashboard');
        }
    }
}

  get emailControl() {
    return this.loginForm.get('email');
  }

  sendOTPCode(): void {
    const email = this.loginForm.get('email')?.value?.trim().toLowerCase();
    if (!email || !this.loginForm.valid) {
      this.errorMessage.set('Please enter a valid email address');
      return;
    }

    console.log('📤 Requesting OTP for:', email);

    this.otpService.sendOTP(email).subscribe({
      next: () => {
        console.log('✅ OTP sent, switching to code entry view');
        this.currentStep.set('code');
        this.errorMessage.set('');
      },
      error: (error) => {
        console.error('❌ Error sending OTP:', error);
        this.errorMessage.set(error.message || 'Failed to send code. Please try again.');
      }
    });
  }

  onCodeDigitInput(index: number, event: any): void {
    const value = event.target.value;

    if (value.length > 1) {
      event.target.value = value.charAt(0);
      return;
    }

    const digits = this.codeDigits();
    digits[index] = value;
    this.codeDigits.set([...digits]);

    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`) as HTMLInputElement;
      nextInput?.focus();
    }

    if (index === 5 && value) {
      const fullCode = this.codeDigits().join('');
      if (fullCode.length === 6) this.verifyOTPCode();
    }
  }

  onCodeDigitKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const digits = this.codeDigits();

      if (!digits[index] && index > 0) {
        const prevInput = document.getElementById(`code-${index - 1}`) as HTMLInputElement;
        prevInput?.focus();
      } else {
        digits[index] = '';
        this.codeDigits.set([...digits]);
      }
    }
  }

  onCodePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const digits = pastedText.replace(/\D/g, '').slice(0, 6).split('');

    if (digits.length === 6) {
      this.codeDigits.set(digits);
      const lastInput = document.getElementById('code-5') as HTMLInputElement;
      lastInput?.focus();
      this.verifyOTPCode();
    }
  }

  verifyOTPCode(): void {
    const email = this.loginForm.get('email')?.value?.trim().toLowerCase();
    const code = this.codeDigits().join('');

    if (code.length !== 6) {
      this.errorMessage.set('Please enter all 6 digits');
      return;
    }

    console.log('🔐 Verifying OTP code...');
    this.currentStep.set('verifying');

    this.otpService.verifyOTP(email, code).subscribe({
      next: (_isNewUser: boolean) => {
        console.log('✅ OTP verified and user signed in!');

        setTimeout(() => {
          this.ngZone.run(() => {
            localStorage.setItem('isLoggedIn', 'true');
            this.redirectAfterLogin();
          });
        }, 500);
      },
      error: (error: Error) => {
        console.error('❌ Login failed:', error);
        this.currentStep.set('code');
        this.errorMessage.set(error.message || 'Authentication failed. Please try again.');

        this.codeDigits.set(['', '', '', '', '', '']);
        const firstInput = document.getElementById('code-0') as HTMLInputElement;
        firstInput?.focus();
      }
    });
  }

  goBackToEmail(): void {
    console.log('🔙 Going back to email entry');
    this.currentStep.set('email');
    this.errorMessage.set('');
    this.codeDigits.set(['', '', '', '', '', '']);
    this.otpService.resetOTPState();
  }

  resendOTPCode(): void {
    const email = this.loginForm.get('email')?.value?.trim().toLowerCase();

    console.log('🔄 Resending OTP code');
    this.errorMessage.set('');

    this.otpService.sendOTP(email).subscribe({
      next: () => {
        console.log('✅ OTP code resent');
        this.codeDigits.set(['', '', '', '', '', '']);
        const firstInput = document.getElementById('code-0') as HTMLInputElement;
        firstInput?.focus();
      },
      error: (error) => {
        console.error('❌ Error resending OTP:', error);
        this.errorMessage.set(error.message || 'Failed to resend code. Please try again.');
      }
    });
  }

  clearError(): void {
    this.errorMessage.set('');
    this.otpService.clearError();
  }

  loginWithGoogle(): void {
    console.log('🔍 Attempting Google login...');
    this.clearError();

    this.authService.loginWithGoogle().subscribe({
      next: (user: User | null) => {
        if (!user || !user.email) {
          this.errorMessage.set('Google sign-in failed. Please try again.');
          return;
        }

        console.log('🔍 Google login successful, validating account...');

        this.authService.checkAccountExists(user.email).subscribe({
          next: (accountInfo) => {
            if (!accountInfo.exists) {
              this.errorMessage.set('No account found for this Google email. Please contact support or register first.');
              console.log('❌ Google account not found in system:', user.email);
              return;
            }

            if (accountInfo.needsPayment) {
              this.errorMessage.set('Account found but payment required. Please complete your registration to access your account.');
              console.log('💳 Google account needs payment:', accountInfo);
              return;
            }

            console.log('✅ Google account validated, proceeding...');
            this.ngZone.run(() => {
              localStorage.setItem('isLoggedIn', 'true');
              this.redirectAfterLogin();
            });
          },
          error: (error) => {
            this.errorMessage.set('Unable to verify account status. Please try again.');
            console.error('❌ Error validating Google account:', error);
          }
        });
      },
      error: (err: Error) => {
        console.error('❌ Error during Google login:', err);
        this.errorMessage.set('Google sign-in failed. Please try again.');
      }
    });
  }

  openRoleSelectionModal(): void {
    this.modalService.openRoleSelectionModal();
  }
}
