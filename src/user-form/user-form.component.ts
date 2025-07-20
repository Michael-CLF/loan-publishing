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
import { takeUntil, catchError, finalize, tap, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { LocationService } from 'src/services/location.service';
import { StripeService } from '../services/stripe.service';
import { EmailService } from '../services/email.service';
import { ModalService } from '../services/modal.service';



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

  private destroy$ = new Subject<void>();

  userForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  isValidatingCoupon = false;
  couponApplied = false;
  appliedCouponDetails: AppliedCouponDetails | null = null;
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.userForm.patchValue({ interval });
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
  /**
   * Applies the coupon code (triggered by Apply button)
   */
  applyCoupon(): void {
    const couponCode = this.userForm.get('couponCode')?.value?.trim();

    if (!couponCode) {
      return;
    }

    this.isValidatingCoupon = true;

    // Make API call to apply coupon
    this.http.post<CouponValidationResponse>('/api/apply-coupon', {
      code: couponCode
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isValidatingCoupon = false;
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Coupon application error:', error);
          this.setCouponError('Unable to apply coupon. Please try again.');
          return of(null);
        })
      )
      .subscribe(response => {
        if (response) {
          this.handleCouponValidationResponse(response);
        }
      });
  }

  validateCoupon(): void {
    const couponCode = this.userForm.get('couponCode')?.value?.trim();
    if (!couponCode) return;

    this.isValidatingCoupon = true;

    // ✅ CORRECT - Use your StripeService
    this.stripeService.validatePromotionCode(couponCode)
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
      couponControl.setErrors({ couponError: errorMessage });
    }
  }

  private clearCouponErrors(): void {
    const couponControl = this.userForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors(null);
    }
  }

  private resetCouponState(): void {
    this.couponApplied = false;
    this.appliedCouponDetails = null;
    this.clearCouponErrors();
  }

  onSubmit(): void {
    console.log('🚨 FORM IS INVALID - STOPPING');
    console.log('🚨 FORM SUBMITTED - onSubmit() called!');
    runInInjectionContext(this.injector, () => {
      if (this.userForm.invalid) {

        Object.keys(this.userForm.controls).forEach((key) => {
          const control = this.userForm.get(key);
          control?.markAsTouched();
        });
        return;
      }
      console.log('🚨 FORM IS VALID - CONTINUING');
      this.isLoading = true;
      this.errorMessage = '';

      const formData = this.userForm.value;
      console.log('🚨 FORM DATA:', formData);

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

      // Add coupon data if applied
      if (this.couponApplied && this.appliedCouponDetails) {
        checkoutData.coupon = {
          code: this.appliedCouponDetails.code,
          discount: this.appliedCouponDetails.discount,
          discountType: this.appliedCouponDetails.discountType,
        };
      }

      console.log('🚨 ABOUT TO CALL registerUser');

      // Step 1: Register user in Firebase (creates user with inactive status)
      this.authService.registerUserViaAPI(formData.email, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        company: formData.company,
        phone: formData.phone,
        city: formData.city,
        state: formData.state,
        role: 'originator'
      })
        .pipe(
          takeUntil(this.destroy$),
          switchMap((registrationResponse) => {
            console.log('✅ User registered successfully with inactive status:', registrationResponse);

            // Step 2: Create Stripe checkout session
            console.log('🔵 Now creating Stripe checkout session');
            return from(this.stripeService.createCheckoutSession(checkoutData));
          }),
          catchError((error: any) => {
            this.isLoading = false;
            console.error('❌ Registration or Stripe error:', error);
            this.errorMessage = error.message || 'Failed to complete registration. Please try again.';
            return of(null);
          })
        )
        .subscribe({
          next: (checkoutResponse) => {
            if (checkoutResponse && checkoutResponse.url) {
              console.log('✅ Stripe checkout session created, redirecting to:', checkoutResponse.url);
              window.location.href = checkoutResponse.url;
            } else {
              this.isLoading = false;
              this.errorMessage = 'Invalid checkout response. Please try again.';
            }
          },
          error: (error) => {
            this.isLoading = false;
            console.error('❌ Subscription error:', error);
            this.errorMessage = 'An unexpected error occurred. Please try again.';
          }
        });
    });
  }
}
