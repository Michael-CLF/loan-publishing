// lender-registration.component.ts - REFACTORED PARENT-OWNS-FORM

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ViewChild
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  FormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize, take } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { LocationService } from 'src/services/location.service';
import { LenderFormService } from '../../services/lender-registration.service';
import { OTPService } from '../../services/otp.service';
import { UserService, RegistrationData } from '../../services/user.service';
import { PaymentService } from '../../services/payment.service';


// Child components
import { LenderContactComponent } from '../lender-contact/lender-contact.component';
import { LenderProductComponent } from '../lender-product/lender-product.component';
import { LenderFootprintComponent } from '../lender-footprint/lender-footprint.component';
import { LenderReviewComponent } from '../lender-review/lender-review.component';
import { LenderStripePaymentComponent } from '../lender-stripe-payment/lender-stripe-payment.component';

// Interfaces
export interface StateOption {
  value: string;
  name: string;
  subcategories: any[];
}

export interface LenderTypeOption {
  value: string;
  name: string;
}

export interface LoanTypes {
  value: string;
  name: string;
}

export interface SubCategory {
  value: string;
  name: string;
}

@Component({
  selector: 'app-lender-registration',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LenderContactComponent,
    LenderProductComponent,
    LenderFootprintComponent,
    LenderReviewComponent,
    LenderStripePaymentComponent,
    FormsModule,
  ],
  templateUrl: './lender-registration.component.html',
  styleUrls: ['./lender-registration.component.css'],
})
export class LenderRegistrationComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private locationService = inject(LocationService);
  private lenderFormService = inject(LenderFormService);
  private otpService = inject(OTPService);
  private userService = inject(UserService);
  private paymentService = inject(PaymentService);
  private validatedPromoResult: any = null;

  // [(input)] handler
  onCodeDigitInput(index: number, event: any): void {
    const raw = event.target.value ?? '';
    const val = raw.replace(/\D/g, '').slice(0, 1);
    this.codeDigits[index] = val;
    event.target.value = val;

    if (val && index < 5) {
      const next = document.getElementById(`code-${index + 1}`) as HTMLInputElement | null;
      next?.focus();
      next?.select();
    }
    if (index === 5 && val) this.verifyOTPCode();
  }

  // (keydown) handler for Backspace navigation
  onCodeDigitKeydown(index: number, e: KeyboardEvent): void {
    if (e.key !== 'Backspace') return;
    e.preventDefault();

    if (this.codeDigits[index]) {
      this.codeDigits[index] = '';
      const el = document.getElementById(`code-${index}`) as HTMLInputElement | null;
      if (el) { el.value = ''; el.focus(); el.select(); }
    } else if (index > 0) {
      this.codeDigits[index - 1] = '';
      const prev = document.getElementById(`code-${index - 1}`) as HTMLInputElement | null;
      if (prev) { prev.value = ''; prev.focus(); prev.select(); }
    }
  }

  // (paste) handler to accept all 6 digits at once
  onCodePaste(e: ClipboardEvent): void {
    e.preventDefault();
    const pasted = e.clipboardData?.getData('text') || '';
    const cleaned = pasted.replace(/\D/g, '').slice(0, 6);
    if (!cleaned) return;

    const chars = cleaned.split('');
    for (let i = 0; i < 6; i++) {
      this.codeDigits[i] = chars[i] || '';
      const box = document.getElementById(`code-${i}`) as HTMLInputElement | null;
      if (box) box.value = this.codeDigits[i];
    }
    if (cleaned.length === 6) this.verifyOTPCode();
  }

  // Click handler for “Verify Code” button in template
  verifyOTPCode(): void {
    const code = this.codeDigits.join('');
    if (code.length !== 6 || this.codeDigits.some(d => d === '')) {
      this.otpErrorMessage = 'Please enter all 6 digits';
      return;
    }
    if (!this.registeredEmail) {
      this.otpErrorMessage = 'Missing email for verification.';
      return;
    }

    this.otpErrorMessage = '';
    this.otpIsLoading = true;

    this.otpService.verifyOTP(this.registeredEmail, code)
      .pipe(finalize(() => this.otpIsLoading = false))
      .subscribe({
        next: () => {
          // advance to Stripe step when verified
          this.currentStep = 5;
        },
        error: (err) => {
          this.otpErrorMessage = err?.message || 'Invalid code';
          // clear boxes
          this.codeDigits = ['', '', '', '', '', ''];
          for (let i = 0; i < 6; i++) {
            const box = document.getElementById(`code-${i}`) as HTMLInputElement | null;
            if (box) box.value = '';
          }
          const first = document.getElementById('code-0') as HTMLInputElement | null;
          first?.focus();
          first?.select();
        }
      });
  }

  private destroy$ = new Subject<void>();

  // Master form
  lenderForm!: FormGroup;

  // These properties still exist to satisfy current code
  contactForm!: FormGroup;
  productForm!: FormGroup;
  footprintForm!: FormGroup;

  // Step management
  currentStep = 0;
  totalSteps = 6;

  registeredEmail = '';
  registeredUserId = '';
  codeDigits: string[] = ['', '', '', '', '', ''];
  otpIsLoading = false;
  otpErrorMessage = '';


  // Loading states
  isLoading = false;
  isRegistering = false;

  // Messages
  errorMessage = '';
  successMessage = '';

  // Static data - Initialize immediately to prevent undefined errors
  states: StateOption[] = [];
  lenderTypes: LenderTypeOption[] = [];
  propertyCategories: any[] = [];
  loanTypes: LoanTypes[] = [];

  billingInterval: 'monthly' | 'annually' = 'monthly';
  createdUserId: string | null = null;

  ngOnInit(): void {
    console.log('🚀 LenderRegistrationComponent initialized');

    this.loadStaticData();
    this.initializeForms();

    // Restore form state from sessionStorage if available
    const hasStoredData = this.lenderFormService.loadFromSessionStorage();
    if (hasStoredData) {
      console.log('📂 Restoring form from session');
      this.restoreFormFromService();

      // Restore to the saved step
      const meta = this.lenderFormService.getFormSection('registrationMeta');
      if (meta?.currentStep !== undefined) {
        this.currentStep = meta.currentStep;
        console.log('📍 Restored to step:', this.currentStep);
      }
    }

    setTimeout(() => {
      if (!hasStoredData) {
        this.initializeForms();
      }
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private restoreFormFromService(): void {
    const formData = this.lenderFormService.getFullForm();

    // Restore contact info
    if (formData.contact) {
      this.contactForm.patchValue(formData.contact);
    }

    // Restore product info
    if (formData.product) {
      this.productForm.patchValue(formData.product);
    }

    // Restore footprint info
    if (formData.footprint) {
      this.footprintForm.patchValue(formData.footprint);
    }

    // Restore payment info
    if (formData.payment) {
      this.billingInterval = formData.payment.billingInterval || 'monthly';
    }

    // Restore terms
    if (formData.termsAccepted !== undefined) {
      this.lenderForm.patchValue({ termsAccepted: formData.termsAccepted });
    }

    // Restore registration meta
    const meta = formData.registrationMeta;
    if (meta) {
      this.registeredEmail = meta.email || '';
      this.registeredUserId = meta.userId || '';
      this.createdUserId = meta.userId || null;
    }
  }

  private loadStaticData(): void {
    // Load data synchronously and ensure it's available before form initialization
    const footprintLocations = this.locationService.getFootprintLocations() || [];
    this.states = footprintLocations.map((location: any) => ({
      value: location.value || '',
      name: location.name || '',
      subcategories: location.subcategories || []
    }));

    this.lenderTypes = this.locationService.getLenderTypes() || [];
    this.propertyCategories = this.locationService.getPropertyCategories() || [];
    this.loanTypes = this.locationService.getLoanTypes() || [];

    // Log to verify data is loaded
    console.log('Static data loaded:', {
      lenderTypesCount: this.lenderTypes.length,
      propertyCategoriesCount: this.propertyCategories.length,
      loanTypesCount: this.loanTypes.length
    });
  }

  /**
   * Build one master FormGroup and wire the local aliases
   */
  private initializeForms(): void {
    // Build nested subgroups first so we can reuse the same instances
    this.contactForm = this.fb.group({
      company: ['', [Validators.required, Validators.minLength(2)]],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      contactPhone: ['', [Validators.required, Validators.minLength(14)]],
      city: ['', [Validators.required, Validators.minLength(2)]],
      state: ['', [Validators.required]],
    });

    this.productForm = this.fb.group({
      lenderTypes: this.fb.array([], [Validators.required]),
      propertyCategories: this.fb.array([], [Validators.required]),
      subcategorySelections: this.fb.array([]),  // <-- ADD THIS
      loanTypes: this.fb.array([], [Validators.required]),
      minLoanAmount: ['', [Validators.required]],
      maxLoanAmount: ['', [Validators.required]],
      ficoScore: [620, [Validators.required, Validators.min(300), Validators.max(850)]],
    });

    this.footprintForm = this.fb.group({
      // footprintForm needs to be valid if and only if at least one state
      // is selected. We will enforce that inside the child component by
      // keeping proper controls (states, lendingFootprint) and validators.
      lendingFootprint: [[], [Validators.required, Validators.minLength(1)]],
      states: [{}], // placeholder, child will normalize this into proper FormGroup
    });

    this.lenderForm = this.fb.group({
      contactInfo: this.contactForm,
      productInfo: this.productForm,
      footprintInfo: this.footprintForm,
      termsAccepted: [false, [Validators.requiredTrue]],
      interval: ['monthly', [Validators.required]],
    });
  }


  // -------------------------------------------------
  // Convenience getters for validation in template
  // -------------------------------------------------
  get contactInfoGroup(): FormGroup {
    return this.lenderForm.get('contactInfo') as FormGroup;
  }

  get productInfoGroup(): FormGroup {
    return this.lenderForm.get('productInfo') as FormGroup;
  }

  get footprintInfoGroup(): FormGroup {
    return this.lenderForm.get('footprintInfo') as FormGroup;
  }

  // ==========================================
  // STEP NAVIGATION
  // ==========================================

  nextStep(): void {
    console.log('➡️ Next step clicked, current step:', this.currentStep);

    // Step 0: Contact Info triggers backend + auth
    if (this.currentStep === 0) {
      this.saveSectionData();
      this.currentStep++;
      this.lenderFormService.updateRegistrationMeta({
        currentStep: this.currentStep
      });
      return;
    }

    // Step 1 validation
    if (this.currentStep === 1 && this.productInfoGroup.invalid) {
      this.productInfoGroup.markAllAsTouched();
      return;
    }

    // Step 2 validation
    if (this.currentStep === 2 && this.footprintInfoGroup.invalid) {
      this.footprintInfoGroup.markAllAsTouched();
      return;
    }

    // Step 3 validation (termsAccepted must be true)
    if (this.currentStep === 3) {
      const termsCtrl = this.lenderForm.get('termsAccepted');
      if (!termsCtrl || termsCtrl.invalid) {
        termsCtrl?.markAsTouched();
        return;
      }


      // NOW we have all data - trigger registration before moving to payment
      this.registerLenderWithAllData();
      return;
    }

    // Advance
    // Advance
    if (this.currentStep < this.totalSteps - 1) {
      this.currentStep++;
      this.saveSectionData();

      // Save current step to sessionStorage
      this.lenderFormService.updateRegistrationMeta({
        currentStep: this.currentStep
      });
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;

      // Save current step to sessionStorage
      this.lenderFormService.updateRegistrationMeta({
        currentStep: this.currentStep
      });
    }
  }

  private saveSectionData(): void {
    // Persist partial step info into LenderFormService as before
    if (this.currentStep === 1) {
      this.lenderFormService.setFormSection('contact', this.contactInfoGroup.value);
    } else if (this.currentStep === 2) {
      this.lenderFormService.setFormSection('product', this.productInfoGroup.value);
    } else if (this.currentStep === 3) {
      this.lenderFormService.setFormSection('footprint', this.footprintInfoGroup.value);
    }
  }

  // ==========================================
  // REGISTRATION (After Step 0)
  // ==========================================

  private registerLenderWithAllData(): void {
    console.log('📝 Registering lender with complete data');

    // Validate entire form
    if (this.lenderForm.invalid) {
      this.lenderForm.markAllAsTouched();
      return;
    }

    this.isRegistering = true;
    this.errorMessage = '';

    // Gather ALL form data
    const contactData = this.contactInfoGroup.value;
    const productData = this.productInfoGroup.value;
    const footprintData = this.footprintInfoGroup.value;
    const email = (contactData.contactEmail || '').toLowerCase().trim();

    const registrationData = {
      email,
      role: 'lender' as const,
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      phone: contactData.contactPhone,
      city: contactData.city,
      state: contactData.state,
      company: contactData.company,
      lenderData: {
        contactInfo: contactData,
        productInfo: productData,
        footprintInfo: footprintData
      },
      interval: this.billingInterval || 'monthly',
      promotionCode: this.validatedPromoResult?.code || null,
    } as RegistrationData;

    console.log('📤 Creating pending lender with full data:', registrationData);

    this.userService.registerUser(registrationData, this.validatedPromoResult)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isRegistering = false)
      )
      .subscribe({
        next: async (response: any) => {
          // ...
          if (this.validatedPromoResult?.valid && this.validatedPromoResult?.promo) {
            try {
              await this.userService.applyPromoToPendingUser(
                response.userId,
                'lender',
                {
                  code: this.validatedPromoResult.promo.code,
                  promoInternalId: this.validatedPromoResult.promo.promoInternalId,
                  promoType: this.validatedPromoResult.promo.promoType,
                  percentOff: this.validatedPromoResult.promo.percentOff ?? null,
                  durationType: this.validatedPromoResult.promo.durationType ?? null,
                  durationInMonths: this.validatedPromoResult.promo.durationInMonths ?? null,
                  trialDays: this.validatedPromoResult.promo.trialDays ?? null,
                  onboardingFeeCents: this.validatedPromoResult.promo.onboardingFeeCents ?? null,
                  promoExpiresAt: this.validatedPromoResult.promo.promoExpiresAt ?? null,
                }
              );
            } catch (e) {
              console.error('applyPromoToPendingUser failed', e);
            }
          }


          // Store in service for persistence
          this.lenderFormService.updateRegistrationMeta({
            userId: response.userId,
            email: email,
            currentStep: 4, // Move to OTP step
            otpVerified: false
          });

          // Move to Step 4 (which we'll make the OTP step)
          this.currentStep = 4;

          // Send OTP immediately
          this.sendOTPCode();
        },
        error: (error: any) => {
          console.error('❌ Lender registration error:', error);
          this.errorMessage = error.message || 'Registration failed. Please try again.';
        }
      });
  }
  private sendOTPCode(): void {
    const email = this.registeredEmail || this.lenderFormService.getFormSection('registrationMeta')?.email;

    if (!email) {
      this.errorMessage = 'Email not found. Please restart registration.';
      return;
    }

    console.log('📧 Sending OTP to:', email);

    this.otpService.sendOTP(email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('✅ OTP sent successfully');
          // OTP UI will be shown in step 4
        },
        error: (err) => {
          console.error('❌ Failed to send OTP:', err);
          this.errorMessage = 'Failed to send verification code. Please try again.';
        }
      });
  }

  // ==========================================
  // OTP
  // ==========================================



  resendOTP(): void {
    const email = this.registeredEmail || this.lenderFormService.getFormSection('registrationMeta')?.email;
    if (!email) return;

    console.log('📧 Resending OTP to:', email);
    this.otpIsLoading = true;

    this.otpService.sendOTP(email)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.otpIsLoading = false)
      )
      .subscribe({
        next: () => {
          console.log('✅ OTP resent');
          this.otpErrorMessage = '';
          this.successMessage = 'New code sent! Check your email.';

          // Clear the digit boxes
          this.codeDigits = ['', '', '', '', '', ''];
          for (let i = 0; i < 6; i++) {
            const box = document.getElementById(`code-${i}`) as HTMLInputElement | null;
            if (box) box.value = '';
          }

          // Focus first box
          const first = document.getElementById('code-0') as HTMLInputElement | null;
          first?.focus();
        },
        error: (err) => {
          console.error('❌ Resend OTP error:', err);
          this.otpErrorMessage = 'Failed to resend code. Please try again.';
        }
      });
  }


  // ==========================================
  // PAYMENT (Step 4)
  // ==========================================

  // ... other class code above ...

  submitForm(): void {
    // Basic guard
    if (!this.lenderForm || this.lenderForm.invalid) {
      console.error('Form invalid. Cannot start checkout.');
      return;
    }

    // Local UI state
    this.isLoading = true;
    this.successMessage = '';
    this.paymentService.clearState();

    // 1. Get values from form or service (in case of refresh)
    const meta = this.lenderFormService.getFormSection('registrationMeta');

    const emailCtrl =
      this.contactInfoGroup.get('contactEmail') ??
      this.lenderForm.get('contactInfo.contactEmail');

    const email = meta?.email || String(emailCtrl?.value || '').toLowerCase().trim();
    const userId = meta?.userId || this.createdUserId || this.registeredUserId || undefined;

    console.log('[checkout] Using stored values ->', { email, userId, meta });

    if (!email || !userId) {
      console.error('Missing email or userId for checkout.', { email, userId });
      this.errorMessage = 'Registration data missing. Please restart registration.';
      this.isLoading = false;
      return;
    }

    console.log('checkout email/userId debug =>', {
      email,
      userId: this.createdUserId
    });

    // role is fixed for this component
    const role: 'lender' = 'lender';

    const interval: 'monthly' | 'annually' =
      this.billingInterval === 'annually' ? 'annually' : 'monthly';

    const paymentSection: any = this.lenderFormService.getFormSection('payment');
    const validatedPromotionCode =
      this.validatedPromoResult?.code ||
      paymentSection?.validatedCouponCode ||
      paymentSection?.promotion_code ||
      '';

    console.info('[checkout] about to POST', {
      email, role, interval, userId, validatedPromotionCode
    });

    if (!email || !userId) {
      console.error('Missing email or userId for checkout.', { email, userId });
      this.isLoading = false;
      return;
    }

    // 2. Call PaymentService
    this.paymentService
      .createCheckoutSession(email, role, interval, userId, validatedPromotionCode)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (response) => {
          // response is { url?: string; sessionId?: string; error?: string; }

          console.log('✅ createCheckoutSession response:', response);

          if (response.url && !response.error) {
            // Good path
            this.successMessage = 'Redirecting to payment...';
            console.log('🔄 Redirecting to Stripe:', response.url);

            // Send browser to Stripe-hosted checkout
            this.paymentService.redirectToCheckout(response.url);
          } else {
            // Error path
            const msg =
              response.error ||
              'Failed to create checkout session';

            console.error('❌ Checkout session error:', msg);
            this.successMessage = '';
          }
        },
        error: (err) => {
          // Network / HTTP / thrown errors
          console.error('❌ Checkout request failed:', err);
          this.successMessage = '';
        },
        complete: () => {
          console.log('ℹ️ Checkout flow complete');
        }
      });
  }

  handlePaymentError(result: any): void {
    console.error('❌ Payment error:', result);
    this.errorMessage = result.error || 'Payment failed. Please try again.';
  }

  onCouponValidated(event: any): void {
    console.log('🎫 Coupon validated:', event);
    this.validatedPromoResult = event;
  }

  getLenderData(): any {
    return {
      companyName: this.contactInfoGroup.value.company,
      firstName: this.contactInfoGroup.value.firstName,
      lastName: this.contactInfoGroup.value.lastName,
      email: this.contactInfoGroup.value.contactEmail,
      phone: this.contactInfoGroup.value.contactPhone,
      city: this.contactInfoGroup.value.city,
      state: this.contactInfoGroup.value.state,
      completeFormData: {
        contactInfo: this.contactInfoGroup.value,
        productInfo: this.productInfoGroup.value,
        footprintInfo: this.footprintInfoGroup.value,
      },
    };
  }
  handlePaymentComplete(result: any): void {
    console.log('✅ Payment complete:', result);
    this.successMessage = result.message || 'Payment successful!';

    // Clear form data from sessionStorage
    this.lenderFormService.clearSessionStorage();

    // If we have a custom token from the payment response, authenticate now
    if (result.customToken) {
      this.authService.signInWithCustomToken(result.customToken)
        .pipe(take(1))
        .subscribe({
          next: () => {
            console.log('🔐 Authenticated after payment');
            this.router.navigate(['/dashboard/lender']);
          },
          error: (err) => {
            console.error('Authentication failed after payment:', err);
            // Still navigate - user can sign in manually
            this.router.navigate(['/login']);
          }
        });
    } else {
      // No token in response - redirect to dashboard anyway
      this.router.navigate(['/dashboard/lender']);
    }
  }
}
