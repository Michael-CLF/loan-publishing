// src/app/lender-registration/lender-stripe-payment.component.ts

// lender-stripe-payment.component.ts - UPDATED TO USE PaymentService
import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  inject,
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
import {
  LenderFormService,
  PaymentInfo,
} from '../../services/lender-registration.service';
import {
  catchError,
  finalize,
  takeUntil,
} from 'rxjs/operators';
import { of, Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PromotionService } from '../../services/promotion.service';
import { PaymentService } from '../../services/payment.service'; // ← NEW

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
  private promotionService = inject(PromotionService);
  private lenderFormService = inject(LenderFormService);
  private paymentService = inject(PaymentService);

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
      promotion_code: [existingPayment?.promotion_code || ''],
    });

    // If there's existing payment data, apply it
    if (
      existingPayment?.couponApplied &&
      existingPayment?.appliedCouponDetails
    ) {
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
    const currentPayment =
      this.lenderFormService.getFormSection('payment') || ({} as PaymentInfo);
    this.lenderFormService.setFormSection('payment', {
      ...currentPayment,
      billingInterval: interval,
    });

    // Revalidate coupon if one exists
    if (
      currentPayment?.couponApplied &&
      this.paymentForm.get('promotion_code')?.value
    ) {
      this.validateCoupon();
    }
  }
  applyCoupon(): void {
    const promotion_code = this.paymentForm
      .get('promotion_code')
      ?.value?.trim();
    if (!promotion_code) return;

    this.isValidatingCoupon = true;

    this.promotionService
      .validatePromotionCode(
        promotion_code,
        'lender',
        this.paymentForm.get('interval')?.value || 'monthly'
      )
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isValidatingCoupon = false)),
        catchError((error: HttpErrorResponse) => {
          console.error('Promotion code application error:', error);
          this.setCouponError(
            'Unable to apply promotion code. Please try again.'
          );
          return of(null);
        })
      )
      .subscribe((response) => {
        if (response) {
          this.handleCouponValidationResponse(response);
        }
      });
  }

  /**
   * ✅ Validates promotion code on blur
   */
  validateCoupon(): void {
    const promotion_code = this.paymentForm
      .get('promotion_code')
      ?.value?.trim();
    if (!promotion_code) return;

    this.isValidatingCoupon = true;

    this.promotionService
      .validatePromotionCode(
        promotion_code,
        'lender',
        this.paymentForm.get('interval')?.value || 'monthly'
      )

      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isValidatingCoupon = false)),
        catchError((error: HttpErrorResponse) => {
          console.error('Coupon validation error:', error);
          this.setCouponError(
            'Unable to validate promotion code. Please try again.'
          );
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
    console.log('🎫 Handling coupon validation response:', response);

    if (response.valid && response.promotion_code) {
      const coupon = response.promotion_code.coupon;
      let couponDetails: any; // ✅ Declare outside the if/else blocks

      // ✅ Handle special LENDER30TRIAL case
      if (response.promotion_code.code === 'LENDER7TRIAL') {
        couponDetails = {
          promotion_code: response.promotion_code.code,
          displayCode: response.promotion_code.code,
          discount: 0, // No discount, just trial
          discountType: 'trial' as any,
          description: '7-Day Free Trial',
        };

        console.log('✅ Applied LENDER7TRIAL special case');
      } else {
        // ✅ Handle regular Stripe promotion codes
        couponDetails = {
          promotion_code: response.promotion_code.code,
          displayCode: response.promotion_code.code,
          discount: coupon.percent_off || coupon.amount_off || 0,
          discountType: coupon.percent_off ? 'percentage' : 'fixed',
          description: coupon.name,
        };
      }

      // Update service with validated coupon
      const currentPayment =
        this.lenderFormService.getFormSection('payment') || ({} as PaymentInfo);
      this.lenderFormService.setFormSection('payment', {
        ...currentPayment,
        billingInterval: this.paymentForm.get('interval')?.value || 'monthly',
        promotion_code: response.promotion_code.code,
        couponApplied: true,
        appliedCouponDetails: couponDetails,
        validatedCouponCode: response.promotion_code.code,
      });

      this.clearCouponErrors();
    } else {
      console.log('❌ Coupon validation failed:', response?.error);
      this.resetCouponState();
      this.setCouponError(response.error || 'Invalid promotion code');
    }
  }

  /**
   * ✅ Set coupon error on form control
   */
  private setCouponError(errorMessage: string): void {
    const couponControl = this.paymentForm.get('promotion_code');
    if (couponControl) {
      couponControl.setErrors({ couponError: errorMessage });
    }
  }

  private clearCouponErrors(): void {
    const couponControl = this.paymentForm.get('promotion_code');
    if (couponControl) {
      couponControl.setErrors(null);
    }
    // Emit event with current service state
    const paymentData = this.lenderFormService.getFormSection('payment');
    this.couponValidated.emit({
      applied: paymentData?.couponApplied || false,
      details: paymentData?.appliedCouponDetails || null,
    });
  }

  private resetCouponState(): void {
    // Update service to clear coupon state
    const currentPayment =
      this.lenderFormService.getFormSection('payment') || ({} as PaymentInfo);
    this.lenderFormService.setFormSection('payment', {
      ...currentPayment,
      couponCode: '',
      couponApplied: false,
      appliedCouponDetails: null,
      validatedCouponCode: '',
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

    const paymentInfo = this.lenderFormService.getFormSection('payment');
    const promotion_code = paymentInfo?.validatedCouponCode?.trim();
    const billingInterval = this.paymentForm.value.interval || 'monthly';

    if (promotion_code) {
      console.log('🎟 Validating promotion code before payment:', promotion_code);
      this.isLoading = true;
      this.errorMessage = '';

      this.promotionService
        .validatePromotionCode(promotion_code, 'lender', billingInterval)
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => {
            if (!paymentInfo?.couponApplied) {
              this.isLoading = false;
            }
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('❌ Payment promotion code validation failed:', error);
            this.errorMessage = 'Invalid promotion code. Please check and try again.';
            this.isLoading = false;
            return of(null);
          })
        )
        .subscribe((response) => {
          if (response && response.valid) {
            console.log('✅ Payment promotion code validated successfully');
            this.proceedToPayment(promotion_code, billingInterval);
          } else {
            console.log('❌ Payment promotion code validation failed:', response?.error);
            this.errorMessage = response?.error || 'Invalid promotion code';
            this.isLoading = false;
          }
        });
    } else {
      this.proceedToPayment(undefined, billingInterval);
    }
  }

  private proceedToPayment(
    validatedPromotionCode: string | undefined,
    billingInterval: 'monthly' | 'annually'
  ): void {
    this.isLoading = true;
    this.errorMessage = '';

    console.log('💳 Creating checkout session:', { billingInterval, validatedPromotionCode });

    // Use NEW PaymentService
    this.paymentService.createCheckoutSession(billingInterval, validatedPromotionCode)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (response) => {
          console.log('✅ Checkout session created:', response);

          if (response.success && response.checkoutUrl) {
            this.paymentComplete.emit({
              success: true,
              message: 'Redirecting to payment processor...',
            });

            console.log('🔄 Redirecting to Stripe:', response.checkoutUrl);
            this.paymentService.redirectToCheckout(response.checkoutUrl);
          } else {
            throw new Error(response.message || 'Failed to create checkout session');
          }
        },
        error: (error) => {
          console.error('❌ Checkout error:', error);
          this.handlePaymentError(error);
        }
      });
  }

  private handlePaymentError(error: any): void {
    this.isLoading = false;
    console.error('Lender payment error:', error);

    let errorMessage = 'Payment processing failed. Please try again.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage =
        'This email is already registered. Please use a different email or contact support.';
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
