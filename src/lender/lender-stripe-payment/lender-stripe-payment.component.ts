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
import { LenderFormService, PaymentInfo } from '../../services/lender-registration.service';
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
  private lenderFormService = inject(LenderFormService);

  @Input() lenderData!: LenderData;
  @Output() paymentComplete = new EventEmitter<PaymentResult>();
  @Output() paymentError = new EventEmitter<PaymentResult>();
  @Output() couponValidated = new EventEmitter<any>();

  paymentForm!: FormGroup;
  paymentInfo$ = this.lenderFormService.getFormSection('payment');
  isLoading = false;
  isValidatingCoupon = false;
  errorMessage = '';

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.initializePaymentForm();
    this.validateLenderData();
  }

  private initializePaymentForm(): void {
    // Get existing payment data from service
    const existingPayment = this.lenderFormService.getFormSection('payment');

    this.paymentForm = this.fb.group({
      interval: [existingPayment?.billingInterval || 'monthly'],
      couponCode: [existingPayment?.couponCode || '']
    });

    // If there's existing payment data, apply it
    if (existingPayment?.couponApplied && existingPayment?.appliedCouponDetails) {
    }
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

    // Update service with new interval
    const currentPayment = this.lenderFormService.getFormSection('payment') || {} as PaymentInfo;
    this.lenderFormService.setFormSection('payment', {
      ...currentPayment,
      billingInterval: interval
    });

    // Revalidate coupon if one exists
    if (currentPayment?.couponApplied && this.paymentForm.get('couponCode')?.value) {
      this.validateCoupon();
    }
  }
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

  private handleCouponValidationResponse(response: any): void {
    if (response.valid && response.promotion_code) {
      const coupon = response.promotion_code.coupon;
      const couponDetails = {
        code: response.promotion_code.code,
        displayCode: response.promotion_code.code,
        discount: coupon.percent_off || coupon.amount_off || 0,
        discountType: coupon.percent_off ? 'percentage' : 'fixed',
        description: coupon.name
      };

      // Update service with validated coupon
      const currentPayment = this.lenderFormService.getFormSection('payment') || {} as PaymentInfo;
      this.lenderFormService.setFormSection('payment', {
        ...currentPayment,
        billingInterval: this.paymentForm.get('interval')?.value || 'monthly',
        couponCode: response.promotion_code.code,
        couponApplied: true,
        appliedCouponDetails: couponDetails,
        validatedCouponCode: response.promotion_code.code
      });

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

  private clearCouponErrors(): void {
    const couponControl = this.paymentForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors(null);
    }
    // Emit event with current service state
    const paymentData = this.lenderFormService.getFormSection('payment');
    this.couponValidated.emit({
      applied: paymentData?.couponApplied || false,
      details: paymentData?.appliedCouponDetails || null
    });
  }

  private resetCouponState(): void {
    // Update service to clear coupon state
    const currentPayment = this.lenderFormService.getFormSection('payment') || {} as PaymentInfo;
    this.lenderFormService.setFormSection('payment', {
      ...currentPayment,
      couponCode: '',
      couponApplied: false,
      appliedCouponDetails: null,
      validatedCouponCode: ''
    });

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
    const formValue = this.paymentForm.value;

    // Get payment info from service
    const paymentInfo = this.lenderFormService.getFormSection('payment');

    const paymentData: CheckoutSessionRequest = {
      ...formValue,
      promotion_code: paymentInfo?.couponApplied && paymentInfo?.validatedCouponCode
        ? paymentInfo.validatedCouponCode
        : null
    };

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
  // Helper methods for template
  get couponApplied(): boolean {
    const paymentInfo = this.lenderFormService.getFormSection('payment');
    return paymentInfo?.couponApplied || false;
  }

  get appliedCouponDetails(): any {
    const paymentInfo = this.lenderFormService.getFormSection('payment');
    return paymentInfo?.appliedCouponDetails || null;
  }
}