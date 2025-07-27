// src/app/lender-registration/lender-stripe-payment.component.ts

import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  inject,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { StripeService } from '../../services/stripe.service';
import { catchError, tap, switchMap, take, finalize, takeUntil } from 'rxjs/operators';
import { of, Subject } from 'rxjs';
import { CheckoutSessionRequest } from '../../services/stripe.service';
import { HttpErrorResponse } from '@angular/common/http';

interface LenderData {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  completeFormData?: {
    contactInfo: any;
    productInfo: any;
    footprintInfo: any;
  };
}

interface PaymentResult {
  success: boolean;
  message?: string;
  error?: string;
}

@Component({
  selector: 'app-lender-stripe-payment',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-stripe-payment.component.html',
  styleUrls: ['./lender-stripe-payment.component.css'],
})
export class LenderStripePaymentComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private injector = inject(Injector);
  private stripeService = inject(StripeService);

  @Input() lenderData!: LenderData;
  @Output() paymentComplete = new EventEmitter<PaymentResult>();
  @Output() paymentError = new EventEmitter<PaymentResult>();
  @Output() couponValidated = new EventEmitter<any>();

  paymentForm!: FormGroup;
  isLoading = false;
  errorMessage = '';

  isValidatingCoupon = false;
  couponApplied = false;
  appliedCouponDetails: any = null;
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.initializePaymentForm();
    this.validateLenderData();
  }

  private initializePaymentForm(): void {
    this.paymentForm = this.fb.group({
      interval: ['monthly'],
      couponCode: ['']
    });
  }

  private validateLenderData(): void {
    if (!this.lenderData) {
      console.error('LenderStripePaymentComponent: lenderData is required');
      this.paymentError.emit({
        success: false,
        error: 'Lender data not provided',
      });
    }
  }

  selectBilling(interval: 'monthly' | 'annually'): void {
    this.paymentForm.patchValue({ interval });
    if (this.couponApplied && this.paymentForm.get('couponCode')?.value) {
      this.validateCoupon();
    }
  }

  /**
   * ✅ Applies the promotion code (triggered by Apply button)
   */
  applyCoupon(): void {
    const couponCode = this.paymentForm.get('couponCode')?.value?.trim();
    if (!couponCode) return;

    this.isValidatingCoupon = true;

    this.stripeService.validatePromotionCode(couponCode, 'lender', this.paymentForm.get('interval')?.value || 'monthly')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isValidatingCoupon = false),
        catchError((error: HttpErrorResponse) => {
          console.error('Promotion code application error:', error);
          this.setCouponError('Unable to apply promotion code. Please try again.');
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
   * ✅ Validates promotion code on blur
   */
  validateCoupon(): void {
    const couponCode = this.paymentForm.get('couponCode')?.value?.trim();
    if (!couponCode) return;

    this.isValidatingCoupon = true;

    this.stripeService.validatePromotionCode(couponCode, 'lender', this.paymentForm.get('interval')?.value || 'monthly')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isValidatingCoupon = false),
        catchError((error: HttpErrorResponse) => {
          console.error('Coupon validation error:', error);
          this.setCouponError('Unable to validate promotion code. Please try again.');
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
   * ✅ Handle promotion code validation response
   */
  private handleCouponValidationResponse(response: any): void {
    if (response.valid && response.promotion_code) {
      this.couponApplied = true;
      const coupon = response.promotion_code.coupon;
      this.appliedCouponDetails = {
        code: response.promotion_code.id,
        displayCode: response.promotion_code.code,
        discount: coupon.percent_off || coupon.amount_off || 0,
        discountType: coupon.percent_off ? 'percentage' : 'fixed',
        description: coupon.name
      };
      this.clearCouponErrors();
    } else {
      this.resetCouponState();
      this.setCouponError(response.error || 'Invalid promotion code');
    }
  }

  /**
   * ✅ Set coupon error on form control
   */
  private setCouponError(errorMessage: string): void {
    const couponControl = this.paymentForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors({ couponError: errorMessage });
    }
  }

  /**
   * ✅ Clear coupon errors
   */
  private clearCouponErrors(): void {
    const couponControl = this.paymentForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors(null);
    }
    this.couponValidated.emit({ applied: true, details: this.appliedCouponDetails });
  }

  /**
   * ✅ Reset coupon state
   */
  private resetCouponState(): void {
    this.couponApplied = false;
    this.appliedCouponDetails = null;
    this.clearCouponErrors();
    this.couponValidated.emit({ applied: false, details: null });
  }

  onSubmit(): void {
    this.paymentForm.markAllAsTouched();
    this.paymentForm.get('interval')?.markAsTouched();

    if (this.paymentForm.invalid) {
      this.errorMessage = 'Please select a billing option';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    const paymentData = this.paymentForm.value;

    runInInjectionContext(this.injector, () => {
      this.processLenderPayment(paymentData);
    });
  }

  private async processLenderPayment(paymentData: CheckoutSessionRequest): Promise<void> {
    this.isLoading = true;

    try {
      const checkoutResponse = await this.stripeService.createCheckoutSession(paymentData);

      if (!checkoutResponse || !checkoutResponse.url) {
        throw new Error('Invalid response from Stripe');
      }

      console.log('✅ Stripe checkout session created:', checkoutResponse);

      this.paymentComplete.emit({
        success: true,
        message: 'Redirecting to payment processor...'
      });

      console.log('➡️ Redirecting to:', checkoutResponse.url);
      window.location.href = checkoutResponse.url;

    } catch (error) {
      console.error('❌ Error in processLenderPayment:', error);
      this.handlePaymentError(error);
      this.isLoading = false;
    }
  }

  private handlePaymentError(error: any): void {
    this.isLoading = false;
    console.error('Lender payment error:', error);

    let errorMessage = 'Payment processing failed. Please try again.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already registered. Please use a different email or contact support.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    this.errorMessage = errorMessage;
    this.paymentError.emit({ success: false, error: errorMessage });
  }

  getDisplayPrice(): string {
    const interval = this.paymentForm.get('interval')?.value;
    return interval === 'monthly' ? '$149.00/month' : '$1610.00/year';
  }

  getSavingsAmount(): string {
    return '$178.00';
  }
}