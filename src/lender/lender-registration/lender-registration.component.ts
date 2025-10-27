// lender-registration.component.ts - CORRECTED (NO SIGNALS)
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
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
import { takeUntil, finalize } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { LocationService } from 'src/services/location.service';
import { LenderFormService } from '../../services/lender-registration.service';
import { OTPService } from '../../services/otp.service';
import { UserService, RegistrationData } from '../../services/user.service';

// Import child components
import { LenderContactComponent } from '../lender-contact/lender-contact.component';
import { LenderProductComponent } from '../lender-product/lender-product.component';
import { LenderFootprintComponent } from '../lender-footprint/lender-footprint.component';
import { LenderReviewComponent } from '../lender-review/lender-review.component';
import { LenderStripePaymentComponent } from '../lender-stripe-payment/lender-stripe-payment.component';

// ==========================================
// EXPORTED INTERFACES (for child components)
// ==========================================
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

  private destroy$ = new Subject<void>();

  // Form groups
  lenderForm!: FormGroup;
  contactForm!: FormGroup;
  productForm!: FormGroup;
  footprintForm!: FormGroup;

  // Step management
  currentStep = 0;
  totalSteps = 5;

  // OTP modal state (NO SIGNALS - regular properties)
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

  // Static data (loaded from LocationService)
  states: StateOption[] = [];
  lenderTypes: LenderTypeOption[] = [];
  propertyCategories: any[] = [];
  loanTypes: LoanTypes[] = [];

  ngOnInit(): void {
    console.log('🚀 LenderRegistrationComponent initialized');
    
    this.loadStaticData();
    this.initializeForms();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

 private loadStaticData(): void {
  const footprintLocations = this.locationService.getFootprintLocations();
  this.states = footprintLocations.map((location: any) => ({
    value: location.value,
    name: location.name,
    subcategories: location.subcategories || []
  }));

  // Load lender types from LocationService
  this.lenderTypes = this.locationService.getLenderTypes();

  // Load property categories from LocationService
  this.propertyCategories = this.locationService.getPropertyCategories();

  // Load loan types from LocationService
  this.loanTypes = this.locationService.getLoanTypes();
}
  private initializeForms(): void {
    // Contact Form (Step 0)
    this.contactForm = this.fb.group({
      company: ['', [Validators.required, Validators.minLength(2)]],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      contactPhone: ['', [Validators.required, Validators.minLength(14)]],
      city: ['', [Validators.required, Validators.minLength(2)]],
      state: ['', [Validators.required]],
    });
  

    // Product Form (Step 1)
    this.productForm = this.fb.group({
      lenderTypes: [[], [Validators.required]],
      minLoanAmount: ['', [Validators.required]],
      maxLoanAmount: ['', [Validators.required]],
      propertyCategories: [[], [Validators.required]],
      loanTypes: [[], [Validators.required]],
      ficoScore: [620, [Validators.required]],
    });

    // Footprint Form (Step 2)
    this.footprintForm = this.fb.group({
      lendingFootprint: ['', [Validators.required]],
      states: [[]],
    });

    // Main Form (consolidates all)
    this.lenderForm = this.fb.group({
      contactInfo: this.contactForm,
      productInfo: this.productForm,
      footprintInfo: this.footprintForm,
      termsAccepted: [false, [Validators.requiredTrue]],
      interval: ['monthly', [Validators.required]],
    });
  }

  // ==========================================
  // STEP NAVIGATION
  // ==========================================

  nextStep(): void {
    console.log('➡️ Next step clicked, current step:', this.currentStep);

    // Step 0: Contact Info → Register and show OTP modal
    if (this.currentStep === 0) {
      if (this.contactForm.invalid) {
        this.contactForm.markAllAsTouched();
        return;
      }
      this.registerLender();
      return;
    }

    // Other steps: Validate and move forward
    if (this.currentStep === 1 && this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    if (this.currentStep === 2 && this.footprintForm.invalid) {
      this.footprintForm.markAllAsTouched();
      return;
    }

    // Move to next step
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
    // Save current step data to service
    if (this.currentStep === 1) {
      this.lenderFormService.setFormSection('contact', this.contactForm.value);
    } else if (this.currentStep === 2) {
      this.lenderFormService.setFormSection('product', this.productForm.value);
    } else if (this.currentStep === 3) {
      this.lenderFormService.setFormSection('footprint', this.footprintForm.value);
    }
  }

  // ==========================================
  // REGISTRATION (After Step 0)
  // ==========================================

  /**
   * Register lender after Step 0 (Contact Info)
   * Calls createPendingUser Cloud Function
   */
  private registerLender(): void {
    console.log('📝 Registering lender');

    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.isRegistering = true;
    this.errorMessage = '';

    const contactData = this.contactForm.value;
    const email = contactData.contactEmail.toLowerCase().trim();

    // Build registration data
    const registrationData: RegistrationData = {
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
      }
    };

    console.log('📤 Calling createPendingUser for lender:', registrationData);

    this.userService.registerUser(registrationData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isRegistering = false)
      )
      .subscribe({
        next: (response: any) => {
          console.log('✅ Lender registration successful:', response);

          if (response.success && response.userId) {
            this.registeredEmail = email;
            this.registeredUserId = response.userId;
            this.showOTPModal = true;
            this.successMessage = 'Check your email for a verification code!';
          } else {
            this.errorMessage = response.message || 'Registration failed. Please try again.';
          }
        },
        error: (error: any) => {
          console.error('❌ Lender registration error:', error);
          this.errorMessage = error.message || 'Registration failed. Please try again.';
        }
      });
  }

  // ==========================================
  // OTP VERIFICATION
  // ==========================================

  /**
   * Verify OTP code from modal
   */
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
            this.currentStep = 1; // Move to Product Details
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

  /**
   * Close OTP modal
   */
  closeOTPModal(): void {
    this.showOTPModal = false;
    this.otpCode = '';
    this.otpError = '';
  }

  // ==========================================
  // PAYMENT (Step 4)
  // ==========================================

  submitForm(): void {
    console.log('💳 Submit form (payment step)');
    // Payment component handles submission
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
  }

  getLenderData(): any {
    return {
      companyName: this.contactForm.value.company,
      firstName: this.contactForm.value.firstName,
      lastName: this.contactForm.value.lastName,
      email: this.contactForm.value.contactEmail,
      phone: this.contactForm.value.contactPhone,
      city: this.contactForm.value.city,
      state: this.contactForm.value.state,
      completeFormData: {
        contactInfo: this.contactForm.value,
        productInfo: this.productForm.value,
        footprintInfo: this.footprintForm.value,
      },
    };
  }
}