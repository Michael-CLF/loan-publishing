// user-form.component.ts - CORRECTED (NO SIGNALS)
import {
  Component,
  OnInit,
  OnDestroy,
  inject
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { LocationService } from 'src/services/location.service';
import { PromotionService } from '../services/promotion.service';
import { PaymentService } from '../services/payment.service';
import { OriginatorService, RegistrationData } from '../services/originator.service';
import { OTPService } from '../services/otp.service';
import { EmailExistsValidator } from 'src/services/email-exists.validator';

export interface StateOption {
  value: string;
  name: string;
}

interface AppliedCouponDetails {
  code: string;
  displayCode?: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  description?: string;
}

type RegistrationStep = 'form' | 'otp' | 'payment';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css']
})
export class UserFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private locationService = inject(LocationService);
  private promotionService = inject(PromotionService);
  private originatorService = inject(OriginatorService);
  private otpService = inject(OTPService);
  private paymentService = inject(PaymentService);
  private emailValidator = inject(EmailExistsValidator);

  private destroy$ = new Subject<void>();

  // Form state
  userForm!: FormGroup;
  otpForm!: FormGroup;
  states: StateOption[] = [];
  
  // Registration flow state (NO SIGNALS - regular properties)
  currentStep: RegistrationStep = 'form';
  registeredEmail = '';
  registeredUserId = '';
  
  // Loading states
  isSubmitting = false;
  isVerifyingOTP = false;
  isCreatingCheckout = false;
  isLoading = false;
  
  // Error states
  errorMessage = '';
  otpError = '';
  
  // Coupon state
  isValidatingCoupon = false;
  couponApplied = false;
  appliedCouponDetails: AppliedCouponDetails | null = null;
  private isResettingCoupon = false;
  
  // Success message
  successMessage = '';

  ngOnInit(): void {
    console.log('🚀 UserFormComponent initialized');
    
    // Load states
    const footprintLocations = this.locationService.getFootprintLocations();
    this.states = footprintLocations.map(location => ({
      value: location.value,
      name: location.name
    }));

    // Initialize registration form
    this.userForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      company: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z0-9 ]+$/)]],
      email: ['', [Validators.required, Validators.email], [this.emailValidator.validate.bind(this.emailValidator)]],
      phone: ['', [Validators.required, Validators.pattern(/^[\d\(\)\-\+\s]*$/), Validators.minLength(14)]],
      city: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      state: ['', [Validators.required]],
      tos: [false, [Validators.requiredTrue]],
      interval: ['monthly', [Validators.required]],
      promotion_code: ['']
    });

    // Initialize OTP form
    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });

    // Clear coupon errors when user starts typing
    this.userForm.get('promotion_code')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.userForm.get('promotion_code')?.errors) {
          this.clearCouponErrors();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==========================================
  // STEP 1: REGISTRATION FORM
  // ==========================================

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.userForm.patchValue({ interval });

    // If a coupon is applied, revalidate it for the new plan
    if (this.couponApplied && this.userForm.get('promotion_code')?.value) {
      this.validateCoupon();
    }
  }

  formatPhoneNumber(): void {
    let phone = this.userForm.get('phone')?.value;
    if (phone) {
      phone = phone.replace(/\D/g, '').slice(0, 10);
      let formatted = phone;
      if (phone.length >= 6) {
        formatted = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
      } else if (phone.length >= 3) {
        formatted = `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
      }
      this.userForm.get('phone')?.setValue(formatted, { emitEvent: false });
    }
  }

  validateCoupon(): void {
    if (this.isResettingCoupon) return;

    const promotion_code = this.userForm.get('promotion_code')?.value?.trim();

    if (!promotion_code) {
      this.resetCouponState();
      return;
    }

    if (this.isValidatingCoupon) return;

    this.isValidatingCoupon = true;

    this.promotionService.validatePromotionCode(
      promotion_code,
      'originator',
      this.userForm.get('interval')?.value || 'monthly'
    )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isValidatingCoupon = false)
      )
      .subscribe({
        next: (response: any) => this.handleCouponValidationResponse(response),
        error: (error: any) => {
          console.error('Coupon validation error:', error);
          this.setCouponError('Unable to validate coupon. Please try again.');
        }
      });
  }

  private handleCouponValidationResponse(response: any): void {
    if (response.valid && response.promotion_code) {
      this.couponApplied = true;

      const coupon = response.promotion_code.coupon;
      this.appliedCouponDetails = {
        code: response.promotion_code.code,
        displayCode: response.promotion_code.code,
        discount: coupon.percent_off || coupon.amount_off || 0,
        discountType: coupon.percent_off ? 'percentage' : 'fixed',
        description: coupon.name
      };
      this.clearCouponErrors();
    } else {
      this.resetCouponState();
      this.setCouponError(response.error || 'Invalid coupon code');
    }
  }

  private clearCouponErrors(): void {
    const control = this.userForm.get('promotion_code');
    if (control) {
      control.setErrors(null);
    }
  }

  private resetCouponState(): void {
    this.isResettingCoupon = true;
    this.couponApplied = false;
    this.appliedCouponDetails = null;
    this.clearCouponErrors();
    this.userForm.get('promotion_code')?.setValue('', { emitEvent: false });

    setTimeout(() => {
      this.isResettingCoupon = false;
    }, 100);
  }

  private setCouponError(errorMessage: string): void {
    const control = this.userForm.get('promotion_code');
    if (control) {
      if (errorMessage.includes('not valid for the selected plan')) {
        control.setErrors({ planMismatchError: true });
      } else {
        control.setErrors({ couponError: errorMessage });
      }
    }
  }

  /**
   * STEP 1: Submit registration form
   * Calls createPendingUser Cloud Function
   */
  onSubmit(): void {
    console.log('📝 Registration form submitted');

    if (this.userForm.invalid) {
      console.log('❌ Form is invalid');
      Object.keys(this.userForm.controls).forEach((key) => {
        const control = this.userForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const formData = this.userForm.value;
    const email = formData.email.toLowerCase().trim();

    // Build registration data
    const registrationData: RegistrationData = {
      email,
      role: 'originator',
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      city: formData.city,
      state: formData.state,
      company: formData.company,
      contactInfo: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        contactEmail: email,
        contactPhone: formData.phone,
        company: formData.company,
        city: formData.city,
        state: formData.state
      }
    };

    console.log('📤 Calling createPendingUser with:', registrationData);

    // Call createPendingUser Cloud Function
    this.originatorService.registerUser(registrationData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSubmitting = false)
      )
      .subscribe({
        next: (response: any) => {
          console.log('✅ Registration successful:', response);
          
          if (response.success && response.userId) {
            this.registeredEmail = email;
            this.registeredUserId = response.userId;
            this.currentStep = 'otp';
            this.successMessage = 'Check your email for a verification code!';
          } else {
            this.errorMessage = response.message || 'Registration failed. Please try again.';
          }
        },
        error: (error: any) => {
          console.error('❌ Registration error:', error);
          this.errorMessage = error.message || 'Registration failed. Please try again.';
        }
      });
  }

  // ==========================================
  // STEP 2: OTP VERIFICATION
  // ==========================================

  /**
   * STEP 2: Verify OTP code
   * Calls verifyOTP Cloud Function
   */
  verifyOTP(): void {
    console.log('🔐 Verifying OTP');

    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }

    const otpCode = this.otpForm.value.otp;
    const email = this.registeredEmail;

    if (!email) {
      this.otpError = 'Email not found. Please start registration again.';
      return;
    }

    this.isVerifyingOTP = true;
    this.otpError = '';

    console.log('📤 Verifying OTP for:', email);

    this.otpService.verifyOTP(email, otpCode)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isVerifyingOTP = false)
      )
      .subscribe({
        next: (response: any) => {
          console.log('✅ OTP verification response:', response);
          
          if (response.success) {
            this.currentStep = 'payment';
            this.successMessage = 'Email verified! Complete your payment to activate your account.';
          } else {
            this.otpError = response.message || 'Invalid verification code. Please try again.';
          }
        },
        error: (error: any) => {
          console.error('❌ OTP verification error:', error);
          this.otpError = error.message || 'Verification failed. Please try again.';
        }
      });
  }

  /**
   * Resend OTP code
   */
  resendOTP(): void {
    const email = this.registeredEmail;
    if (!email) return;

    console.log('📧 Resending OTP to:', email);

    this.otpService.sendOTP(email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.successMessage = 'New code sent! Check your email.';
            this.otpError = '';
          } else {
            this.otpError = 'Failed to resend code. Please try again.';
          }
        },
        error: (error: any) => {
          console.error('❌ Resend OTP error:', error);
          this.otpError = 'Failed to resend code. Please try again.';
        }
      });
  }

  // ==========================================
  // STEP 3: PAYMENT
  // ==========================================

  /**
   * STEP 3: Create checkout session and redirect to Stripe
   */
  proceedToPayment(): void {
    console.log('💳 Proceeding to payment');

    this.isCreatingCheckout = true;
    this.errorMessage = '';

    const interval = this.userForm.value.interval || 'monthly';
    const promotionCode = this.couponApplied && this.appliedCouponDetails
      ? this.appliedCouponDetails.code
      : undefined;

    console.log('📤 Creating checkout session:', { interval, promotionCode });

    this.paymentService.createCheckoutSession(interval, promotionCode)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isCreatingCheckout = false)
      )
      .subscribe({
        next: (response: any) => {
          console.log('✅ Checkout session created:', response);
          
          if (response.success && response.checkoutUrl) {
            console.log('🔄 Redirecting to Stripe checkout');
            this.paymentService.redirectToCheckout(response.checkoutUrl);
          } else {
            this.errorMessage = response.message || 'Failed to create checkout session.';
          }
        },
        error: (error: any) => {
          console.error('❌ Checkout creation error:', error);
          this.errorMessage = error.message || 'Failed to create checkout session. Please try again.';
        }
      });
  }

  /**
   * Go back to form step (if user needs to change info)
   */
  backToForm(): void {
    this.currentStep = 'form';
    this.otpForm.reset();
    this.otpError = '';
  }

  /**
   * Go back to OTP step (if payment fails)
   */
  backToOTP(): void {
    this.currentStep = 'otp';
  }
}