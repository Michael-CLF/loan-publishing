// User-form.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  Injector,
  runInInjectionContext
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
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject, of, from } from 'rxjs';
import { takeUntil, catchError, finalize, tap, switchMap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { LocationService } from 'src/services/location.service';
import { StripeService } from '../services/stripe.service';
import { EmailService } from '../services/email.service';
import { ModalService } from '../services/modal.service';
import { PromotionService } from '../services/promotion.service';


export interface StateOption {
  value: string;
  name: string;
}

interface CouponValidationResponse {
  valid: boolean;
  coupon?: {
    id: string;
    code: string;
    discount: number;
    discountType: 'percentage' | 'fixed';
    description?: string;
  };
  error?: string;
}

interface AppliedCouponDetails {
  code: string;
  displayCode?: string;
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
  providers: [EmailService]
})
export class UserFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private injector = inject(Injector);
  private locationService = inject(LocationService);
  private stripeService = inject(StripeService);
  private modalService = inject(ModalService);
  private promotionService = inject(PromotionService);


  private destroy$ = new Subject<void>();

  userForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  isValidatingCoupon = false;
  couponApplied = false;
  appliedCouponDetails: AppliedCouponDetails | null = null;
  private isResettingCoupon = false;
  states: StateOption[] = [];
  successMessage: string = '';



  ngOnInit(): void {
    const footprintLocations = this.locationService.getFootprintLocations();
    this.states = footprintLocations.map(location => ({
      value: location.value,
      name: location.name
    }));

    this.userForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      company: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z0-9 ]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[\d\(\)\-\+\s]*$/), Validators.minLength(14)]],
      city: ['', [Validators.required, Validators.minLength(2), Validators.pattern(/^[A-Za-z ]+$/)]],
      state: ['', [Validators.required]],
      tos: [false, [Validators.requiredTrue]],
      interval: ['monthly', [Validators.required]],
      applyTrial: [false],
      couponCode: ['']
    });
    // Clear coupon errors when user starts typing
    this.userForm.get('couponCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.userForm.get('couponCode')?.errors) {
          this.clearCouponErrors();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.userForm.patchValue({ interval });

    // If a coupon is applied, revalidate it for the new plan
    if (this.couponApplied && this.userForm.get('couponCode')?.value) {
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
    // Don't validate if we're in the middle of resetting
    if (this.isResettingCoupon) {
      return;
    }

    const couponCode = this.userForm.get('couponCode')?.value?.trim();

    // If no code entered, reset state and return
    if (!couponCode) {
      this.resetCouponState();
      return;
    }

    // Prevent duplicate validation calls
    if (this.isValidatingCoupon) {
      return;
    }

    this.isValidatingCoupon = true;

    // ✅ CORRECT - Use your StripeService
    this.promotionService.validatePromotionCode(couponCode, 'originator', this.userForm.get('interval')?.value || 'monthly')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isValidatingCoupon = false),
        catchError((error: HttpErrorResponse) => {
          console.error('Coupon validation error:', error);
          this.setCouponError('Unable to validate coupon. Please try again.');
          return of(null);
        })
      )
      .subscribe(response => {
        if (response) {
          this.handleCouponValidationResponse(response);
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
  private setCouponError(errorMessage: string): void {
    const couponControl = this.userForm.get('couponCode');
    if (couponControl) {
      // Check if it's a plan mismatch error
      if (errorMessage.includes('not valid for the selected plan')) {
        couponControl.setErrors({ planMismatchError: true });
      } else {
        couponControl.setErrors({ couponError: errorMessage });
      }
    }
  }

  private clearCouponErrors(): void {
    const couponControl = this.userForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors(null);
    }
  }

  private resetCouponState(): void {
    this.isResettingCoupon = true;
    this.couponApplied = false;
    this.appliedCouponDetails = null;
    this.clearCouponErrors();

    // Clear the coupon input field
    this.userForm.get('couponCode')?.setValue('', { emitEvent: false });

    setTimeout(() => {
      this.isResettingCoupon = false;
    }, 100);
  }

  onSubmit(): void {
    console.log('🚨 FORM SUBMITTED - onSubmit() called!');
    runInInjectionContext(this.injector, () => {
      if (this.userForm.invalid) {
        console.log('🚨 FORM IS INVALID - STOPPING');
        Object.keys(this.userForm.controls).forEach((key) => {
          const control = this.userForm.get(key);
          control?.markAsTouched();
        });
        return;
      }

      // ✅ CRITICAL FIX: Validate promotion code before proceeding
      const couponCode = this.userForm.get('couponCode')?.value?.trim();
      if (couponCode) {
        console.log('🔍 Validating promotion code before checkout:', couponCode);

        this.isLoading = true;
        this.errorMessage = '';

        this.promotionService.validatePromotionCode(couponCode, 'originator', this.userForm.get('interval')?.value || 'monthly')
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => {
              if (!this.couponApplied) {
                this.isLoading = false;
              }
            }),
            catchError((error: HttpErrorResponse) => {
              console.error('❌ Promotion code validation failed:', error);
              this.errorMessage = 'Invalid promotion code. Please check and try again.';
              this.isLoading = false;
              return of(null);
            })
          )
          .subscribe(response => {
            if (response && response.valid) {
              console.log('✅ Promotion code validated, proceeding to checkout');
              this.handleCouponValidationResponse(response);
              this.proceedToCheckout();
            } else {
              console.log('❌ Promotion code validation failed:', response?.error);
              this.errorMessage = response?.error || 'Invalid promotion code';
              this.isLoading = false;
            }
          });
      } else {
        // No promotion code, proceed directly
        this.proceedToCheckout();
      }
    });
  }
private proceedToCheckout(): void {
  this.isLoading = true;
  this.errorMessage = '';

  const formData = this.userForm.value;

  // Prepare user registration data for backend
  const registrationData = {
    email: formData.email,
    role: 'originator',
    userData: {
      firstName: formData.firstName,
      lastName: formData.lastName,
      company: formData.company,
      phone: formData.phone,
      city: formData.city,
      state: formData.state,
    }
  };

  // Prepare Stripe checkout data
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
    },
  };

  if (this.couponApplied && this.appliedCouponDetails) {
    const couponDetails = this.appliedCouponDetails;
    checkoutData.promotion_code = couponDetails.code;
    checkoutData.discount = couponDetails.discount;
    checkoutData.discountType = couponDetails.discountType;
  }

  console.log('🔵 Creating Stripe checkout session with registration data');
  from(this.stripeService.createCheckoutSession(checkoutData))
    .pipe(
      takeUntil(this.destroy$),
      catchError((error: any) => {
        this.isLoading = false;
        console.error('❌ Stripe checkout error:', error);
        this.errorMessage = error.message || 'Failed to create checkout session. Please try again.';
        return of(null);
      })
    )
    .subscribe({
      next: (checkoutResponse) => {
        if (checkoutResponse && checkoutResponse.url) {
          console.log('✅ Stripe checkout session created, redirecting to:', checkoutResponse.url);
          localStorage.setItem('pendingRegistration', JSON.stringify(formData));
          window.location.href = checkoutResponse.url;
        } else {
          this.isLoading = false;
          this.errorMessage = 'Invalid checkout response. Please try again.';
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('❌ Checkout error:', error);
        this.errorMessage = 'An unexpected error occurred. Please try again.';
      }
    });
  };
}

