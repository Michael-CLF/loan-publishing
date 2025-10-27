import { Component, OnInit, inject, NgZone, signal, computed } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { OTPService } from '../services/otp.service';
import { CommonModule } from '@angular/common';
import { ModalService } from '../services/modal.service';
import { User } from '@angular/fire/auth';

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

  loginForm: FormGroup;
  
  // Signals for reactive state management (Angular 18 best practice)
  currentStep = signal<'email' | 'code' | 'verifying'>('email');
  errorMessage = signal<string>('');
  otpCode = signal<string>('');
  
  // Computed signals
  isLoading = computed(() => this.otpService.isLoading());
  otpSent = computed(() => this.otpService.otpSent());
  timeRemaining = computed(() => this.otpService.formatTimeRemaining());
  attemptsRemaining = computed(() => this.otpService.attemptsRemaining());
  
  // 6-digit code input boxes
  codeDigits = signal<string[]>(['', '', '', '', '', '']);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    console.log('✅ OTP Email login component initializing...');
    // Component is ready - user can enter email to request OTP
  }

  get emailControl() {
    return this.loginForm.get('email');
  }

  /**
   * Sends OTP code to user's email
   * Changes view from email entry to code entry
   */
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

  /**
   * Handles input in the 6-digit code boxes
   * Automatically advances to next box
   */
  onCodeDigitInput(index: number, event: any): void {
    const value = event.target.value;
    
    // Only allow single digit
    if (value.length > 1) {
      event.target.value = value.charAt(0);
      return;
    }

    // Update the digit
    const digits = this.codeDigits();
    digits[index] = value;
    this.codeDigits.set([...digits]);

    // Auto-advance to next box if digit entered
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`) as HTMLInputElement;
      nextInput?.focus();
    }

    // Auto-submit if all 6 digits filled
    if (index === 5 && value) {
      const fullCode = this.codeDigits().join('');
      if (fullCode.length === 6) {
        this.verifyOTPCode();
      }
    }
  }

  /**
   * Handles backspace in code boxes
   * Moves to previous box when current is empty
   */
  onCodeDigitKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const digits = this.codeDigits();
      
      if (!digits[index] && index > 0) {
        // Current box empty, move to previous
        const prevInput = document.getElementById(`code-${index - 1}`) as HTMLInputElement;
        prevInput?.focus();
      } else {
        // Clear current box
        digits[index] = '';
        this.codeDigits.set([...digits]);
      }
    }
  }

  /**
   * Handles paste event - allows pasting full 6-digit code
   */
  onCodePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const digits = pastedText.replace(/\D/g, '').slice(0, 6).split('');
    
    if (digits.length === 6) {
      this.codeDigits.set(digits);
      // Focus last box
      const lastInput = document.getElementById('code-5') as HTMLInputElement;
      lastInput?.focus();
      // Auto-submit
      this.verifyOTPCode();
    }
  }

 /**
 * Verifies the OTP code entered by user
 * FIXED: Now actually signs in with the customToken
 */
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
    next: (response: any) => {
      console.log('✅ OTP verification response:', response);
      
      // Check if we got a customToken
      if (!response.success || !response.customToken) {
        this.currentStep.set('code');
        this.errorMessage.set(response.message || 'Verification failed. Please try again.');
        return;
      }

      console.log('🎫 Got customToken, signing in with Firebase Auth...');

      // Sign in with the customToken
      this.authService.signInWithCustomToken(response.customToken).subscribe({
        next: () => {
          console.log('✅ Signed in with customToken successfully');

          // Now check account exists and has proper access
          this.authService.checkAccountExists(email).subscribe({
            next: (accountInfo) => {
              if (!accountInfo.exists) {
                this.currentStep.set('code');
                this.errorMessage.set('Account not found. Please contact support.');
                return;
              }

              if (accountInfo.needsPayment) {
                this.currentStep.set('code');
                this.errorMessage.set('Payment required to access your account.');
                return;
              }

              // Success! Navigate to dashboard
              this.ngZone.run(() => {
                localStorage.setItem('isLoggedIn', 'true');
                const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
                console.log('🔄 Redirecting to:', redirectUrl);
                
                this.router.navigate([redirectUrl]).then(() => {
                  localStorage.removeItem('redirectUrl');
                  console.log('✅ Navigation completed successfully');
                });
              });
            },
            error: (error) => {
              console.error('❌ Error validating account:', error);
              this.currentStep.set('code');
              this.errorMessage.set('Unable to verify account. Please try again.');
            }
          });
        },
        error: (error) => {
          console.error('❌ Error signing in with customToken:', error);
          this.currentStep.set('code');
          this.errorMessage.set('Sign-in failed. Please try again.');
        }
      });
    },
    error: (error) => {
      console.error('❌ OTP verification failed:', error);
      this.currentStep.set('code');
      this.errorMessage.set(error.message || 'Invalid code. Please try again.');
      
      // Clear the code boxes for retry
      this.codeDigits.set(['', '', '', '', '', '']);
      const firstInput = document.getElementById('code-0') as HTMLInputElement;
      firstInput?.focus();
    }
  });
}

  /**
   * Goes back to email entry screen
   * Keeps email filled but hides Google button
   */
  goBackToEmail(): void {
    console.log('🔙 Going back to email entry');
    this.currentStep.set('email');
    this.errorMessage.set('');
    this.codeDigits.set(['', '', '', '', '', '']);
    this.otpService.resetOTPState();
  }

  /**
   * Resends OTP code to same email
   */
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

  /**
   * Clears error message
   */
  clearError(): void {
    this.errorMessage.set('');
    this.otpService.clearError();
  }

  /**
   * Google OAuth login
   * Only shown in initial email entry view
   */
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

            console.log('✅ Google account validated, proceeding to dashboard...');
            
            this.ngZone.run(() => {
              localStorage.setItem('isLoggedIn', 'true');
              const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
              this.router.navigate([redirectUrl]);
              localStorage.removeItem('redirectUrl');
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

  /**
   * Opens registration modal
   */
  openRoleSelectionModal(): void {
    this.modalService.openRoleSelectionModal();
  }
}