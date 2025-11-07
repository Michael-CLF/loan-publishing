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
import { AuthService } from '../../services/auth.service';
import { LocationService } from 'src/services/location.service';
import { PromotionService } from '../../services/promotion.service';
import { PaymentService } from '../../services/payment.service';
import { UserService, RegistrationData } from '../../services/user.service';
import { OTPService } from '../../services/otp.service';
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

type RegistrationStep = 'form' | 'otp' | 'verifying';

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
  private userService = inject(UserService);
  private otpService = inject(OTPService);
  private paymentService = inject(PaymentService);
  private emailValidator = inject(EmailExistsValidator);
  private validatedPromoResult: any = null;


  private destroy$ = new Subject<void>();

  // form state
  userForm!: FormGroup;
  states: StateOption[] = [];

  // flow state
  currentStep: RegistrationStep = 'form'; // 'form' -> 'otp' -> 'verifying'
  registeredEmail = '';
  registeredUserId = '';

  // ui state
  isLoading = false;          // form submit / register button spinner
  isSubmitting = false;       // you already had this, leaving it conceptually
  errorMessage = '';          // form-level error before we get to OTP

  // coupon state (keep this logic from your existing version)
  couponApplied = false;
  appliedCouponDetails: AppliedCouponDetails | null = null;
  isValidatingCoupon = false;
  private isResettingCoupon = false;

  // OTP view state (mirrors login component style)
  // Instead of 6 separate template refs, we keep an array
  codeDigits: string[] = ['', '', '', '', '', ''];
  otpErrorMessage = '';
  otpIsLoading = false; // verifying / resending state

  // expose timer text like login
  get timeRemaining(): string {
    return this.otpService.formatTimeRemaining();
  }

  ngOnInit(): void {
    console.log('🚀 UserFormComponent init');

    // load state options
    const footprintLocations = this.locationService.getFootprintLocations();
    this.states = footprintLocations.map(location => ({
      value: location.value,
      name: location.name
    }));

    // build registration form
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

    // if coupon changes, clear coupon error state
    this.userForm.get('promotion_code')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // you can clear coupon form errors here if you want
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========== REGISTRATION SUBMIT (STEP 1 -> STEP 2) ==========
  onSubmit(): void {
    console.log('📝 Registration form submitted');

    if (this.userForm.invalid) {
      this.markAllTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const formData = this.userForm.value;
    const email = formData.email.toLowerCase().trim();

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
      },
      promotionCode: this.couponApplied ? formData.promotion_code?.trim().toUpperCase() : undefined,
      interval: formData.interval || 'monthly'
    };

    console.log('📤 createPendingUser payload:', registrationData);

    this.userService.registerUser(registrationData, this.validatedPromoResult)

      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.isLoading = false; })
      )
      .subscribe({
        next: (response: any) => {
          console.log('✅ Registration response:', response);

          if (response.success && response.userId) {
            // store persisted identity
            this.registeredEmail = email;
            this.registeredUserId = response.userId;

            // switch UI to OTP step
            this.currentStep = 'otp';

            // send the OTP email now
            this.sendOTPToRegisteredEmail();
          } else {
            this.errorMessage = response.message || 'Registration failed. Please try again.';
          }
        },
        error: (err: any) => {
          console.error('❌ Registration error:', err);
          this.errorMessage = err.message || 'Registration failed. Please try again.';
        }
      });
  }

  formatPhoneNumber(): void {
    const control = this.userForm.get('phone');
    let phone = control?.value || '';

    // strip non-digits and limit to 10 digits
    phone = phone.replace(/\D/g, '').slice(0, 10);

    // build formatted string
    let formatted = phone;
    if (phone.length >= 6) {
      formatted = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
    } else if (phone.length >= 3) {
      formatted = `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
    }

    control?.setValue(formatted, { emitEvent: false });
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    // update the form control
    this.userForm.patchValue({ interval });

    // revalidate coupon for the new plan if one is applied
    if (this.couponApplied && this.userForm.get('promotion_code')?.value) {
      this.validateCoupon();
    }
  }

  validateCoupon(): void {
    if (this.isResettingCoupon) return;

    const rawCode = this.userForm.get('promotion_code')?.value?.trim();
    if (!rawCode) {
      // nothing entered: clear state and exit
      this.resetCouponState();
      return;
    }

    // avoid parallel calls
    if (this.isValidatingCoupon) return;

    // figure out which plan the user selected
    const interval: 'monthly' | 'annually' =
      this.userForm.get('interval')?.value === 'annually' ? 'annually' : 'monthly';

    this.isValidatingCoupon = true;
    console.log('🔍 Applying coupon', {
      rawCode,
      role: 'originator',
      interval
    });
    this.promotionService
      .validatePromotionCode(rawCode, 'originator', interval)
      .pipe(finalize(() => { this.isValidatingCoupon = false; }))

      .subscribe({
        next: (response: any) => {
          console.log('✅ validatePromotionCode response:', response);

          // success case: valid promo returned
          if (response?.valid && response?.promo) {
            const promo = response.promo;

            this.validatedPromoResult = response; // keep full server payload
            this.couponApplied = true;

            // build what the UI shows in the summary box
            this.appliedCouponDetails = {
              code: promo.code,
              displayCode: promo.code,
              discount: promo.percentOff || 0,
              discountType: promo.promoType, // 'percentage' | 'fixed'
              description: promo.code,  
            };

            this.clearCouponErrors();
            return;
          }

          // fallback: invalid promo
          this.resetCouponState();
          this.setCouponError(response?.error || 'Invalid promotion code');
        },

        error: (err: any) => {
          console.error('❌ validatePromotionCode error:', err);
          this.resetCouponState();
          this.setCouponError('Failed to validate promotion code. Please try again.');
        }
      });
  }
  
  private setCouponError(msg: string): void {
    const ctrl = this.userForm.get('promotion_code');
    if (!ctrl) return;
    // store error on the control so you can show red styling if you want
    ctrl.setErrors({ couponError: msg });
  }

  private clearCouponErrors(): void {
    const ctrl = this.userForm.get('promotion_code');
    if (!ctrl) return;
    ctrl.setErrors(null);
  }

  private resetCouponState(): void {
    this.isResettingCoupon = true;

    this.couponApplied = false;
    this.appliedCouponDetails = null;

    // clear coupon field UI, but don't emit valueChanges to spam validation
    this.userForm.get('promotion_code')?.setValue('', { emitEvent: false });
    this.clearCouponErrors();

    // release after short delay so blur handler won't instantly re-run
    setTimeout(() => {
      this.isResettingCoupon = false;
    }, 100);
  }

 proceedToPayment(): void {
  // after OTP success
  const intervalValue: 'monthly' | 'annually' =
    this.userForm.get('interval')?.value === 'annually' ? 'annually' : 'monthly';

  const promoRaw = this.userForm.get('promotion_code')?.value?.trim();
  const promotionCode = this.couponApplied && promoRaw ? promoRaw.toUpperCase() : undefined;
  const rawPhone = (this.userForm.get('phone')?.value || '').replace(/\D/g, '');
  const email = this.registeredEmail;
  const userId = this.registeredUserId;

  if (!email || !userId) {
    console.error('Missing email or userId for Stripe checkout', { email, userId });
    return;
  }

  this.otpIsLoading = true;

  const role: 'originator' = 'originator';

  this.paymentService
    .createCheckoutSession(email, role, intervalValue, userId, promotionCode, rawPhone)
    .pipe(finalize(() => { this.otpIsLoading = false; }))
    .subscribe({
      next: (resp: any) => {
        if (resp && resp.url && !resp.error) {
          this.paymentService.redirectToCheckout(resp.url);
        } else {
          const msg = resp?.error || 'Failed to create checkout session';
          console.error('Checkout error:', msg);
          this.otpErrorMessage = msg;
        }
      },
      error: (err: any) => {
        console.error('Checkout request failed:', err);
        this.otpErrorMessage = err?.message || 'Payment setup failed. Please try again.';
      }
    });
}
  private markAllTouched(): void {
    Object.keys(this.userForm.controls).forEach(key => {
      this.userForm.get(key)?.markAsTouched();
    });
  }

  // ========== OTP FLOW (STEP 2) ==========

  private sendOTPToRegisteredEmail(): void {
    if (!this.registeredEmail) {
      this.otpErrorMessage = 'Missing email for verification.';
      return;
    }

    this.otpErrorMessage = '';
    this.otpIsLoading = true;

    this.otpService.sendOTP(this.registeredEmail).subscribe({
      next: () => {
        console.log('✅ OTP sent to', this.registeredEmail);
        this.otpIsLoading = false;

        // focus first box
        const first = document.getElementById('code-0') as HTMLInputElement | null;
        first?.focus();
      },
      error: (err) => {
        console.error('❌ OTP send error:', err);
        this.otpIsLoading = false;
        this.otpErrorMessage = 'Failed to send code. Please try again.';
      }
    });
  }

  // user types in a code box
  onCodeDigitInput(index: number, event: any): void {
    const raw = event.target.value ?? '';
    const val = raw.replace(/\D/g, '').slice(0, 1); // only one numeric char

    this.codeDigits[index] = val;
    event.target.value = val;

    // auto-advance
    if (val && index < 5) {
      const next = document.getElementById(`code-${index + 1}`) as HTMLInputElement | null;
      next?.focus();
      next?.select();
    }

    // if last digit filled, try verify
    if (index === 5 && val) {
      this.verifyOTPCode();
    }
  }

  // handle backspace nav
  onCodeDigitKeydown(index: number, e: KeyboardEvent): void {
    if (e.key === 'Backspace') {
      e.preventDefault();

      if (this.codeDigits[index]) {
        // clear current box
        this.codeDigits[index] = '';
        const el = document.getElementById(`code-${index}`) as HTMLInputElement | null;
        if (el) {
          el.value = '';
          el.focus();
          el.select();
        }
      } else if (index > 0) {
        // clear previous
        this.codeDigits[index - 1] = '';
        const prev = document.getElementById(`code-${index - 1}`) as HTMLInputElement | null;
        if (prev) {
          prev.value = '';
          prev.focus();
          prev.select();
        }
      }
    }
  }

  // allow paste of full code
  onCodePaste(e: ClipboardEvent): void {
    e.preventDefault();
    const pasted = e.clipboardData?.getData('text') || '';
    const cleaned = pasted.replace(/\D/g, '').slice(0, 6);
    if (!cleaned) return;

    const chars = cleaned.split('');
    for (let i = 0; i < 6; i++) {
      this.codeDigits[i] = chars[i] || '';
      const box = document.getElementById(`code-${i}`) as HTMLInputElement | null;
      if (box) {
        box.value = this.codeDigits[i];
      }
    }

    if (cleaned.length === 6) {
      this.verifyOTPCode();
    } else {
      const firstEmpty = this.codeDigits.findIndex(d => d === '');
      const focusIndex = firstEmpty === -1 ? 5 : firstEmpty;
      const focusEl = document.getElementById(`code-${focusIndex}`) as HTMLInputElement | null;
      focusEl?.focus();
      focusEl?.select();
    }
  }

  resendOTPCode(): void {
    if (!this.registeredEmail) return;

    this.otpErrorMessage = '';
    this.otpIsLoading = true;

    this.otpService.sendOTP(this.registeredEmail).subscribe({
      next: () => {
        console.log('🔄 OTP resent');
        this.otpIsLoading = false;
        this.codeDigits = ['', '', '', '', '', ''];

        const first = document.getElementById('code-0') as HTMLInputElement | null;
        first?.focus();
      },
      error: (err) => {
        console.error('❌ Resend error:', err);
        this.otpIsLoading = false;
        this.otpErrorMessage = 'Failed to resend code. Please try again.';
      }
    });
  }

  // user clicks Verify Code or auto-verify triggers
  verifyOTPCode(): void {
    const email = this.registeredEmail;
    const code = this.codeDigits.join('');

    if (!email) {
      this.otpErrorMessage = 'Missing email. Please restart.';
      return;
    }

    if (code.length !== 6 || this.codeDigits.some(d => d === '')) {
      this.otpErrorMessage = 'Please enter all 6 digits';
      return;
    }

    console.log('🔐 Verifying OTP for:', email);

    this.otpErrorMessage = '';
    this.otpIsLoading = true;

    this.otpService.verifyOTP(email, code)
      .pipe(finalize(() => { this.otpIsLoading = false; }))
      .subscribe({
        next: () => {
          console.log('✅ OTP verified, proceeding');
          this.currentStep = 'verifying';

          // call your existing handler chain
          this.onOTPVerified();
        },
        error: (err: any) => {
          console.error('❌ OTP verification error:', err);
          this.otpErrorMessage = err.message || 'Invalid code';

          // clear all boxes, refocus first
          this.codeDigits = ['', '', '', '', '', ''];
          for (let i = 0; i < 6; i++) {
            const box = document.getElementById(`code-${i}`) as HTMLInputElement | null;
            if (box) {
              box.value = '';
            }
          }
          const first = document.getElementById('code-0') as HTMLInputElement | null;
          first?.focus();
          first?.select();
        }
      });
  }

 private onOTPVerified(): void {
  // rely on values captured earlier
  const email = this.registeredEmail;
  const userId = this.registeredUserId;

  if (!email || !userId) {
    console.error('onOTPVerified: missing email or userId', { email, userId });
    this.otpErrorMessage = 'Setup error. Please restart registration.';
    return;
  }

  this.currentStep = 'verifying';
  this.proceedToPayment();  // single source of truth for checkout
}
}