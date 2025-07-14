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
import { Subject, of } from 'rxjs';
import { takeUntil, catchError, finalize, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { LocationService } from 'src/services/location.service';
import { StripeService } from '../services/stripe.service';
import { EmailService } from '../services/email.service';
import { ModalService } from '../services/modal.service';
import { VerificationCodeService } from '../services/verification-code.service';



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
  private verificationService = inject(VerificationCodeService);

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
    this.http.post<CouponValidationResponse>('/api/validate-coupon', { code: couponCode })
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

  private handleCouponValidationResponse(response: CouponValidationResponse): void {
    if (response.valid && response.coupon) {
      this.couponApplied = true;
      this.appliedCouponDetails = {
        code: response.coupon.code,
        discount: response.coupon.discount,
        discountType: response.coupon.discountType,
        description: response.coupon.description
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
    runInInjectionContext(this.injector, () => {
      if (this.userForm.invalid) {
        Object.keys(this.userForm.controls).forEach((key) => {
          const control = this.userForm.get(key);
          control?.markAsTouched();
        });
        return;
      }

      this.isLoading = true;
      this.errorMessage = '';


      const formData = this.userForm.value;

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

      try {
        this.stripeService.createCheckoutSession(checkoutData).then((checkoutResponse) => {
          if (checkoutResponse && checkoutResponse.url) {
            console.log('✅ Stripe checkout session created:', checkoutResponse);
            window.location.href = checkoutResponse.url;
          } else {
            throw new Error('Stripe checkout URL not returned');
          }
        }).catch((error: any) => {
          this.isLoading = false;
          console.error('Stripe error:', error);
          this.errorMessage = error.message || 'Failed to initiate payment. Please try again.';
        });
      } catch (error: any) {
        this.isLoading = false;
        console.error('Stripe error (outer try/catch):', error);
        this.errorMessage = error.message || 'Unexpected error. Please try again.';
      }
    });
  }
}