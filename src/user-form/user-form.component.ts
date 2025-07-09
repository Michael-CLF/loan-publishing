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
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, tap, switchMap, take, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';
import { of, Subject, Observable } from 'rxjs';
import { VerificationCodeService } from '../services/verification-code.service';
import { EmailService } from '../services/email.service';
import { ModalService } from '../services/modal.service';
import { usaStatesWithCounties } from 'typed-usa-states/dist/states-with-counties';
import { LocationService } from 'src/services/location.service';
import { StripeService } from '../services/stripe.service';

export interface StateOption {
  value: string;
  name: string;
}

export interface UserTypeOption {
  value: string;
  name: string;
}

// Interface for coupon validation response
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

// Interface for applied coupon details
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
  private http = inject(HttpClient);

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
   * Validates coupon code with the backend
   */
  validateCoupon(): void {
    const couponCode = this.userForm.get('couponCode')?.value?.trim();
    
    if (!couponCode) {
      this.resetCouponState();
      return;
    }

    this.isValidatingCoupon = true;
    
    // Make API call to validate coupon
    this.http.post<CouponValidationResponse>('/api/validate-coupon', { 
      code: couponCode 
    })
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
        this.handleCouponValidationResponse(response);
      }
    });
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

  /**
   * Handles the response from coupon validation/application
   */
  private handleCouponValidationResponse(response: CouponValidationResponse): void {
    if (response.valid && response.coupon) {
      // Coupon is valid - apply it
      this.couponApplied = true;
      this.appliedCouponDetails = {
        code: response.coupon.code,
        discount: response.coupon.discount,
        discountType: response.coupon.discountType,
        description: response.coupon.description
      };
      
      // Clear any existing errors
      this.clearCouponErrors();
      
      console.log('Coupon applied successfully:', this.appliedCouponDetails);
    } else {
      // Coupon is invalid
      this.resetCouponState();
      this.setCouponError(response.error || 'Invalid coupon code');
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

    // ✅ NEW: Store originator data for post-payment processing
    const originatorData = {
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      company: formData.company,
      phone: formData.phone,
      city: formData.city,
      state: formData.state,
      role: 'originator',
      billingInterval: formData.interval,
      // Include coupon data if applied
      coupon: this.appliedCouponDetails ? {
        code: this.appliedCouponDetails.code,
        discount: this.appliedCouponDetails.discount,
        discountType: this.appliedCouponDetails.discountType
      } : null
    };

    try {
      localStorage.setItem('completeOriginatorData', JSON.stringify(originatorData));
      localStorage.setItem('showRegistrationModal', 'true');
    } catch (err) {
      console.error('Failed to store originator data locally', err);
      this.errorMessage = 'Failed to prepare registration. Please try again.';
      this.isLoading = false;
      return;
    }

    // ✅ NEW: Create Stripe checkout session directly (no user creation)
    runInInjectionContext(this.injector, () => {
      // Prepare checkout session data
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

      // Add coupon data only if coupon is applied
      if (this.couponApplied && this.appliedCouponDetails) {
        checkoutData.coupon = {
          code: this.appliedCouponDetails.code,
          discount: this.appliedCouponDetails.discount,
          discountType: this.appliedCouponDetails.discountType
        };
      }

      this.stripeService.createCheckoutSession(checkoutData)
      .pipe(
        tap((checkoutResponse) => {
          console.log('✅ Stripe checkout session created:', checkoutResponse);
          window.location.href = checkoutResponse.url;
        }),
        catchError((error) => {
          this.isLoading = false;
          console.error('Stripe error:', error);
          this.errorMessage = error.message || 'Failed to initiate payment. Please try again.';
          return of(null);
        })
      )
      .subscribe();
    });
  }
}