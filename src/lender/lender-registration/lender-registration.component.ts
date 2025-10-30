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


  private destroy$ = new Subject<void>();

  // Master form
  lenderForm!: FormGroup;

  // These properties still exist to satisfy current code
  contactForm!: FormGroup;
  productForm!: FormGroup;
  footprintForm!: FormGroup;

  // Step management
  currentStep = 0;
  totalSteps = 5;

  // OTP modal state
  showOTPModal = false;
  otpCode = '';
  isVerifyingOTP = false;
  otpError = '';
  registeredEmail = '';
  registeredUserId = '';

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
    setTimeout(() => {
      this.initializeForms();
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
      if (this.contactInfoGroup.invalid) {
        this.contactInfoGroup.markAllAsTouched();
        return;
      }
      this.registerLender();
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
    }

    // Advance
    if (this.currentStep < this.totalSteps - 1) {
      this.currentStep++;
      this.saveSectionData();
    }
  }

  prevStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
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

  private registerLender(): void {
    console.log('📝 Registering lender');

    if (this.contactInfoGroup.invalid) {
      this.contactInfoGroup.markAllAsTouched();
      return;
    }

    this.isRegistering = true;
    this.errorMessage = '';

    const contactData = this.contactInfoGroup.value;
    const email = (contactData.contactEmail || '').toLowerCase().trim();

    const registrationData = {
      email,
      role: 'lender',
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      phone: contactData.contactPhone,
      city: contactData.city,
      state: contactData.state,
      company: contactData.company,
      lenderData: {
        ...contactData
      },
      interval: this.lenderFormService?.getFormSection('payment')?.billingInterval || 'monthly',
      promotionCode: this.lenderFormService?.getFormSection('payment')?.validatedCouponCode || null,
    } as RegistrationData;

    console.log('📤 Calling createPendingUser for lender:', registrationData);

    this.userService.registerUser(registrationData, this.validatedPromoResult)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isRegistering = false)
      )
      .subscribe({
        next: (response: any) => {
          console.log('✅ Lender registration successful:', response);

          if (!response?.success || !response?.userId || !response?.customToken) {
            this.errorMessage = response?.message || 'Registration failed. Please try again.';
            return;
          }

          this.registeredEmail = email;
          this.registeredUserId = response.userId;
          this.createdUserId = response.userId;


          // sign browser into Firebase using the custom token from backend
          this.authService.signInWithCustomToken(response.customToken)
            .pipe(take(1))
            .subscribe({
              next: () => {
                console.log('🔐 Browser authenticated as new user. Moving to payment step.');
                this.currentStep = 1; // product details comes next in UI flow
              },
              error: (authErr) => {
                console.error('❌ Could not authenticate after registration:', authErr);
                this.errorMessage = 'Account created but we could not start your session. Refresh and try again.';
              }
            });
        },
        error: (error: any) => {
          console.error('❌ Lender registration error:', error);
          this.errorMessage = error.message || 'Registration failed. Please try again.';
        }
      });
  }

  // ==========================================
  // OTP
  // ==========================================

  verifyOTP(): void {
    const code = this.otpCode;
    const email = this.registeredEmail;

    if (!code || code.length !== 6) {
      this.otpError = 'Please enter a valid 6-digit code';
      return;
    }

    if (!email) {
      this.otpError = 'Email not found. Please start registration again.';
      return;
    }

    this.isVerifyingOTP = true;
    this.otpError = '';

    console.log('🔐 Verifying OTP for lender:', email);

    this.otpService.verifyOTP(email, code)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isVerifyingOTP = false)
      )
      .subscribe({
        next: (response: any) => {
          console.log('✅ OTP verification response:', response);

          if (response.success) {
            this.showOTPModal = false;
            this.currentStep = 1;
            this.successMessage = 'Email verified! Continue filling out your profile.';
            this.saveSectionData();
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

  closeOTPModal(): void {
    this.showOTPModal = false;
    this.otpCode = '';
    this.otpError = '';
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

    // 1. Collect required values for checkout

    // email from the form
    const emailCtrl = this.lenderForm.get('email');
    const email: string | undefined = emailCtrl
      ? String(emailCtrl.value || '').toLowerCase().trim()
      : undefined;

    // role is fixed for this component
    const role: 'lender' = 'lender';

    // billing interval: component should be tracking what the user chose
    // If you already have something like this.billingInterval set elsewhere,
    // we normalize it here.
    const interval: 'monthly' | 'annually' =
      this.billingInterval === 'annually' ? 'annually' : 'monthly';

    // userId: must be the Firestore doc ID returned by createPendingUser
    // You told me you save that. We assume it's on this.createdUserId.
    const userId = this.createdUserId ?? undefined;



    // optional promo code
    const promoCtrl = this.lenderForm.get('promotionCode');
    const rawPromo = promoCtrl ? String(promoCtrl.value || '').trim() : '';
    const promoCode = rawPromo.length ? rawPromo : undefined;

    if (!email || !userId) {
      console.error('Missing email or userId for checkout.', { email, userId });
      this.isLoading = false;
      return;
    }

    // 2. Call PaymentService
    this.paymentService
      .createCheckoutSession(email, role, interval, userId)
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


  handlePaymentComplete(result: any): void {
    console.log('✅ Payment complete:', result);
    this.successMessage = result.message || 'Payment successful!';
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
}
