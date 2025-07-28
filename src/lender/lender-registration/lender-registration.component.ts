// src/app/lender-registration/lender-registration.component.ts

import {
  Component,
  inject,
  OnDestroy,
  OnInit,
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
import { HttpClient } from '@angular/common/http';
import { Subject, of, from } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { StripeService } from '../../services/stripe.service';
import { ModalService } from '../../services/modal.service';
import { Injector } from '@angular/core';


@Component({
  selector: 'app-lender-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './lender-registration.component.html',
  styleUrls: ['./lender-registration.component.css']
})
export class LenderRegistrationComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private stripeService = inject(StripeService);
  private modalService = inject(ModalService);

  private destroy$ = new Subject<void>();

  lenderForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  isValidatingCoupon = false;
  couponApplied = false;
  appliedCouponDetails: any = null;
  private isResettingCoupon = false;

  ngOnInit(): void {
    this.lenderForm = this.fb.group({
      companyName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      interval: ['monthly', Validators.required],
      couponCode: [''],
      tos: [false, Validators.requiredTrue]
    });

    this.lenderForm.get('couponCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.lenderForm.get('couponCode')?.errors) {
          this.clearCouponErrors();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.lenderForm.patchValue({ interval });

    if (this.couponApplied && this.lenderForm.get('couponCode')?.value) {
      this.validateCoupon();
    }
  }

  validateCoupon(): void {
    if (this.isResettingCoupon) return;

    const couponCode = this.lenderForm.get('couponCode')?.value?.trim();
    if (!couponCode) {
      this.resetCouponState();
      return;
    }

    if (this.isValidatingCoupon) return;

    this.isValidatingCoupon = true;

    this.stripeService
      .validatePromotionCode(
        couponCode,
        'lender',
        this.lenderForm.get('interval')?.value || 'monthly'
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isValidatingCoupon = false)),
        catchError((error) => {
          console.error('❌ Coupon validation error:', error);
          this.setCouponError('Unable to validate coupon. Please try again.');
          return of(null);
        })
      )
      .subscribe((response) => {
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
    const couponControl = this.lenderForm.get('couponCode');
    if (couponControl) {
      if (errorMessage.includes('not valid for the selected plan')) {
        couponControl.setErrors({ planMismatchError: true });
      } else {
        couponControl.setErrors({ couponError: errorMessage });
      }
    }
  }

  private clearCouponErrors(): void {
    const couponControl = this.lenderForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors(null);
    }
  }

  private resetCouponState(): void {
    this.isResettingCoupon = true;
    this.couponApplied = false;
    this.appliedCouponDetails = null;
    this.clearCouponErrors();

    this.lenderForm.get('couponCode')?.setValue('', { emitEvent: false });

    setTimeout(() => {
      this.isResettingCoupon = false;
    }, 100);
  }

  onSubmit(): void {
    runInInjectionContext(inject(Injector), () => {
      if (this.lenderForm.invalid) {
        Object.keys(this.lenderForm.controls).forEach((key) => {
          const control = this.lenderForm.get(key);
          control?.markAsTouched();
        });
        return;
      }

      this.isLoading = true;
      this.errorMessage = '';

      const formData = this.lenderForm.value;

      const checkoutData: any = {
        email: formData.email,
        role: 'lender',
        interval: formData.interval,
        companyName: formData.companyName
      };

      if (this.couponApplied && this.appliedCouponDetails) {
        const coupon = this.appliedCouponDetails;
        checkoutData.promotion_code = coupon.code;
        checkoutData.discount = coupon.discount;
        checkoutData.discountType = coupon.discountType;
      }

      console.log('🟦 Sending checkoutData to Stripe:', checkoutData);

      from(this.stripeService.createCheckoutSession(checkoutData))
        .pipe(
          takeUntil(this.destroy$),
          catchError((error) => {
            this.isLoading = false;
            console.error('❌ Stripe checkout error:', error);
            this.errorMessage = error.message || 'Failed to create checkout session.';
            return of(null);
          })
        )
        .subscribe((response) => {
          if (response && response.url) {
            localStorage.setItem('pendingRegistration', JSON.stringify(formData));
            window.location.href = response.url;
          } else {
            this.isLoading = false;
            this.errorMessage = 'Invalid Stripe response.';
          }
        });
    });
  }
}
