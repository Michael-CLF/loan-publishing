import {
  Component,
  OnInit,
  inject,
  Injector,
  runInInjectionContext,
  OnDestroy,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { VerificationCodeService } from '../services/verification-code.service';
import { EmailService } from '../services/email.service';
import { ModalService } from '../services/modal.service';
import { LocationService } from 'src/services/location.service';
import { StripeService } from '../services/stripe.service';
import { FirestoreService } from '../services/firestore.service';
import { catchError, tap, takeUntil, finalize, switchMap, map } from 'rxjs/operators';
import { of, Subject, Observable } from 'rxjs';

export interface StateOption {
  value: string;
  name: string;
}

export interface UserTypeOption {
  value: string;
  name: string;
}

// Interface for applied coupon details (keep this one)
interface AppliedCouponDetails {
  code: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  description?: string;
}

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css'],
  providers: [EmailService],
})
export class UserFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private emailService = inject(EmailService);
  private verificationService = inject(VerificationCodeService);
  private modalService = inject(ModalService);
  private readonly locationService = inject(LocationService);
  private injector = inject(Injector);
  private stripeService = inject(StripeService);
  private firestoreService = inject(FirestoreService);

  // Component destruction subject for cleanup
  private destroy$ = new Subject<void>();

  userForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  phone: any;

  // Coupon-related properties
  isValidatingCoupon = false;
  couponApplied = false;
  appliedCouponDetails: AppliedCouponDetails | null = null;

  // Define all US states - using the same approach as lender registration
  states: StateOption[] = [];

  ngOnInit(): void {
    // Use the LocationService to get states in the same format as lender registration
    const footprintLocations = this.locationService.getFootprintLocations();
    this.states = footprintLocations.map((location) => ({
      value: location.value,
      name: location.name,
    }));

    this.userForm = this.fb.group({
      firstName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      lastName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      company: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z0-9 ]+$/),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[\d\(\)\-\+\s]*$/),
          Validators.minLength(14),
        ],
      ],
      city: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      state: ['', [Validators.required]],
      tos: [false, [Validators.requiredTrue]],
      interval: ['monthly', [Validators.required]],
      applyTrial: [false],
      // Add coupon code form control
      couponCode: [''], // Optional field, no validators by default
    });

    console.log('Initial TOS control state:', {
      value: this.userForm.get('tos')?.value,
      status: this.userForm.get('tos')?.status,
      enabled: !this.userForm.get('tos')?.disabled,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.userForm.patchValue({
      interval: interval
    });
  }

  formatPhoneNumber(): void {
    let phone = this.userForm.get('phone')?.value;
    if (phone) {
      phone = phone.replace(/\D/g, ''); // digits only
      if (phone.length > 10) phone = phone.slice(0, 10);

      let formatted = phone;
      if (phone.length >= 6) {
        formatted = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(
          6
        )}`;
      } else if (phone.length >= 3) {
        formatted = `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
      } else {
        formatted = phone;
      }

      this.userForm.get('phone')?.setValue(formatted, { emitEvent: false });
    }
  }

  /**
   * Validates coupon code with Stripe API
   */
  validateCoupon(): void {
    const couponCode = this.userForm.get('couponCode')?.value?.trim();

    if (!couponCode) {
      this.resetCouponState();
      return;
    }

    this.isValidatingCoupon = true;

    // Use StripeService to validate promotion code
    this.stripeService.validatePromotionCode(couponCode)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isValidatingCoupon = false;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Coupon validation error:', error);
          this.setCouponError('Unable to validate coupon. Please try again.');
          return of(null);
        })
      )
      .subscribe(response => {
        if (response) {
          this.handlePromotionCodeResponse(response);
        }
      });
  }

  /**
   * Applies the coupon code (triggered by Apply button)
   */
  applyCoupon(): void {
    // For Stripe promotion codes, validation and application are the same
    this.validateCoupon();
  }

  /**
   * Validates coupon before form submission if user didn't click Apply
   */
  private validateCouponBeforeSubmission(formData: any): void {
    const couponCode = formData.couponCode.trim();

    this.stripeService.validatePromotionCode(couponCode)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.isLoading = false;
          this.errorMessage = 'Invalid promotion code. Please check and try again.';
          return of(null);
        })
      )
      .subscribe(response => {
        if (response?.valid) {
          // Auto-apply the valid coupon
          this.handlePromotionCodeResponse(response);
          this.proceedWithCheckout(formData);
        } else {
          this.isLoading = false;
          this.errorMessage = 'Invalid promotion code. Please check and try again.';
        }
      });
  }

  /**
   * Re-validates applied coupon for security before final submission
   */
  private revalidateAndProceed(formData: any): void {
    if (!this.appliedCouponDetails) {
      this.proceedWithCheckout(formData);
      return;
    }

    this.stripeService.validatePromotionCode(this.appliedCouponDetails.code)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.warn('Coupon re-validation failed, proceeding without coupon:', error);
          this.resetCouponState();
          this.proceedWithCheckout(formData);
          return of(null);
        })
      )
      .subscribe(response => {
        if (response?.valid) {
          this.proceedWithCheckout(formData);
        } else {
          // Coupon is no longer valid - reset and proceed without it
          this.resetCouponState();
          this.proceedWithCheckout(formData);
        }
      });
  }

  /**
    * Proceeds with checkout session creation
    * Angular 18 Best Practice: Single method, clear responsibility
    */
 
  /**
 * Proceeds with checkout session creation
 * Angular 18 Best Practice: Passwordless system - create Firestore doc, then checkout
 */
private proceedWithCheckout(formData: any): void {
  console.log('🚀 Starting pre-payment Firestore document creation');
  
  // First, create inactive Firestore document
  this.createInactiveFirestoreDocument(formData)
    .pipe(
      tap((success) => {
        if (success) {
          console.log('✅ Firestore document created, proceeding to payment');
        }
      }),
      switchMap((success) => {
        if (!success) {
          throw new Error('Failed to create user document');
        }
        return this.createStripeCheckout(formData);
      }),
      takeUntil(this.destroy$),
      catchError((error) => {
        console.error('❌ Error in checkout process:', error);
        this.isLoading = false;
        this.errorMessage = error.message || 'Failed to process registration. Please try again.';
        return of(null);
      })
    )
    .subscribe();
}

/**
 * Creates inactive Firestore document before payment (passwordless system)
 */
private createInactiveFirestoreDocument(formData: any): Observable<boolean> {
  const email = formData.email.toLowerCase().trim();
  
  console.log('📝 Creating inactive Firestore document for:', email);
  
  // Generate temporary document ID based on email for webhook to find
  const tempDocId = 'temp_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  
  const userData = {
    id: tempDocId,
    email: email,
    firstName: formData.firstName,
    lastName: formData.lastName,
    company: formData.company,
    phone: formData.phone,
    city: formData.city,
    state: formData.state,
    role: 'originator' as const,
    subscriptionStatus: 'inactive',
    registrationCompleted: false,
    paymentPending: true,
    billingInterval: formData.interval,
    isTemporary: true // Flag for webhook to identify pre-payment documents
  };
  
  return this.firestoreService.setDocument(`originators/${tempDocId}`, userData).pipe(
    tap(() => {
      console.log('✅ Inactive Firestore document created');
      // Store email for post-payment webhook processing
      localStorage.setItem('pendingAuthEmail', email);
    }),
    map(() => true),
    catchError((error) => {
      console.error('❌ Failed to create Firestore document:', error);
      this.errorMessage = 'Failed to prepare registration. Please try again.';
      return of(false);
    })
  );
}

/**
 * Creates Stripe checkout session (unchanged logic)
 */
private createStripeCheckout(formData: any): Observable<boolean> {
  // Store minimal data for frontend display only
  const displayData = {
    email: formData.email,
    firstName: formData.firstName,
    lastName: formData.lastName,
    company: formData.company,
    role: 'originator' as const,
    billingInterval: formData.interval
  };

  try {
    // Store data for post-payment UI display
    localStorage.setItem('pendingUserData', JSON.stringify(displayData));
    localStorage.setItem('showRegistrationModal', 'true');
    
    console.log('📦 Stored display data for post-payment flow');
  } catch (err) {
    console.error('Failed to store display data:', err);
    throw new Error('Failed to prepare registration. Please try again.');
  }

  // Create Stripe checkout session
  return runInInjectionContext(this.injector, () => {
    const checkoutData: any = {
      email: formData.email,
      role: 'originator',
      interval: formData.interval as 'monthly' | 'annually',
      userData: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        company: formData.company,
        phone: formData.phone,
        city: formData.city,
        state: formData.state,
      }
    };

    // Add coupon data if applied
    if (this.couponApplied && this.appliedCouponDetails) {
      checkoutData.coupon = {
        code: this.appliedCouponDetails.code,
        discount: this.appliedCouponDetails.discount,
        discountType: this.appliedCouponDetails.discountType
      };
    }

    return this.stripeService.createCheckoutSession(checkoutData).pipe(
      tap((checkoutResponse) => {
        console.log('✅ Stripe checkout session created, redirecting...');
        window.location.href = checkoutResponse.url;
      }),
      map(() => true),
      catchError((error: HttpErrorResponse) => {
        this.isLoading = false;
        console.error('❌ Stripe checkout error:', error);
        
        if (error.status === 0) {
          this.errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.status === 400) {
          this.errorMessage = 'Invalid registration data. Please check your information.';
        } else {
          this.errorMessage = error.error?.message || 'Failed to initiate payment. Please try again.';
        }
        
        return of(false);
      })
    );
  });
}
  


  /**
   * Handles the response from Stripe promotion code validation
   */
  private handlePromotionCodeResponse(response: any): void {
    if (response.valid && response.promotion_code) {
      const coupon = response.promotion_code.coupon;

      // Coupon is valid - apply it
      this.couponApplied = true;
      this.appliedCouponDetails = {
        code: response.promotion_code.code,
        discount: coupon.percent_off || (coupon.amount_off / 100), // Convert cents to dollars for fixed amounts
        discountType: coupon.percent_off ? 'percentage' : 'fixed',
        description: coupon.name
      };

      // Clear any existing errors
      this.clearCouponErrors();

      console.log('Promotion code applied successfully:', this.appliedCouponDetails);
    } else {
      // Coupon is invalid
      this.resetCouponState();
      this.setCouponError(response.error || 'Invalid promotion code');
    }
  }

  /**
   * Sets coupon validation errors
   */
  private setCouponError(errorMessage: string): void {
    const couponControl = this.userForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors({
        couponError: errorMessage
      });
    }
  }

  /**
   * Clears coupon validation errors
   */
  private clearCouponErrors(): void {
    const couponControl = this.userForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors(null);
    }
  }

  /**
   * Resets coupon application state
   */
  private resetCouponState(): void {
    this.couponApplied = false;
    this.appliedCouponDetails = null;
    this.clearCouponErrors();
  }

  onSubmit(): void {
    // Mark form as touched to show validation errors
    Object.keys(this.userForm.controls).forEach((key) => {
      const control = this.userForm.get(key);
      control?.markAsTouched();
    });

    if (this.userForm.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const formData = this.userForm.value;

    // Handle coupon validation before proceeding
    const couponCode = formData.couponCode?.trim();

    if (couponCode && !this.couponApplied) {
      // User entered a coupon but didn't apply it - validate it first
      this.validateCouponBeforeSubmission(formData);
    } else if (couponCode && this.couponApplied) {
      // Re-validate applied coupon for security before submission
      this.revalidateAndProceed(formData);
    } else {
      // No coupon or empty coupon - proceed directly
      this.proceedWithCheckout(formData);
    }
  }
}