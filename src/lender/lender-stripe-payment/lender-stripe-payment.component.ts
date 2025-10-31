// src/app/lender-registration/lender-stripe-payment.component.ts
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
import { catchError, finalize, takeUntil } from 'rxjs/operators';
import { of, Subject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PromotionService } from '../../services/promotion.service';
import { PaymentService } from '../../services/payment.service';

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
  isLoading = false;
  isValidatingCoupon = false;
  errorMessage = '';

  private destroy$ = new Subject<void>();

  // Added fields used by PaymentService
  createdUserId: string | null = null;

  ngOnInit(): void {
    this.initializePaymentForm();
    this.validateLenderData();
  }

  private initializePaymentForm(): void {
    const existingPayment = this.lenderFormService.getFormSection('payment');

    this.paymentForm = this.fb.group({
      interval: [existingPayment?.billingInterval || 'monthly'],
      promotion_code: [existingPayment?.promotion_code || ''],
    });

    if (
      existingPayment?.couponApplied &&
      existingPayment?.appliedCouponDetails
    ) {
      // already applied coupon
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

    const currentPayment =
      this.lenderFormService.getFormSection('payment') || ({} as PaymentInfo);
    this.lenderFormService.setFormSection('payment', {
      ...currentPayment,
      billingInterval: interval,
    });

    if (
      currentPayment?.couponApplied &&
      this.paymentForm.get('promotion_code')?.value
    ) {
      this.validateCoupon();
    }
  }

  applyCoupon(): void {
    const promotion_code = this.paymentForm.get('promotion_code')?.value?.trim();
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
          this.setCouponError('Unable to apply promotion code. Please try again.');
          return of(null);
        })
      )
      .subscribe((response) => {
        if (response) this.handleCouponValidationResponse(response);
      });
  }

  validateCoupon(): void {
    const promotion_code = this.paymentForm.get('promotion_code')?.value?.trim();
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
          this.setCouponError('Unable to validate promotion code. Please try again.');
          return of(null);
        })
      )
      .subscribe((response) => {
        if (response) this.handleCouponValidationResponse(response);
      });
  }

  private handleCouponValidationResponse(response: any): void {
  console.log('🎫 Handling coupon validation response:', response);

  // Accept either shape:
  // A) { valid: true, promo: { promoType, percentOff, durationInMonths, durationType, trialDays, onboardingFeeCents, promoInternalId, promoExpiresAt, code } }
  // B) { valid: true, promotion_code: { code, coupon: { percent_off?, amount_off?, name } } }
  const isValid = !!response?.valid;

  // Normalize a single object "norm" with fields we need
  const fromA = response?.promo;
  const fromB = response?.promotion_code;

  let norm: {
    code: string;
    type: 'trial' | 'percentage' | 'fixed';
    percentOff?: number | null;
    amountOff?: number | null;
    durationType?: 'once' | 'repeating' | 'forever' | null;
    durationInMonths?: number | null;
    trialDays?: number | null;
    onboardingFeeCents?: number | null;
    description?: string | null;
  } | null = null;

  if (isValid && fromA?.promoType) {
    norm = {
      code: fromA.code,
      type: fromA.promoType === 'trial' ? 'trial' : (fromA.percentOff ? 'percentage' : 'fixed'),
      percentOff: fromA.percentOff ?? null,
      amountOff: null,
      durationType: fromA.durationType ?? null,
      durationInMonths: fromA.durationInMonths ?? null,
      trialDays: fromA.trialDays ?? null,
      onboardingFeeCents: fromA.onboardingFeeCents ?? null,
      description: null,
    };
  } else if (isValid && fromB?.code) {
    const c = fromB.coupon || {};
    norm = {
      code: fromB.code,
      type: c.percent_off ? 'percentage' : 'fixed',
      percentOff: c.percent_off ?? null,
      amountOff: c.amount_off ?? null,
      durationType: (c.duration as any) ?? null,
      durationInMonths: c.duration_in_months ?? null,
      trialDays: null,
      onboardingFeeCents: null,
      description: c.name ?? null,
    };
  }

  if (isValid && norm) {
    const currentPayment =
      this.lenderFormService.getFormSection('payment') || ({} as PaymentInfo);

    const couponDetails = {
      promotion_code: norm.code,
      displayCode: norm.code,
      discount: norm.percentOff ?? norm.amountOff ?? 0,
      discountType: norm.type,
      description: norm.description || (norm.type === 'trial' ? 'Free Trial' : ''),
    };

    this.lenderFormService.setFormSection('payment', {
      ...currentPayment,
      billingInterval: this.paymentForm.get('interval')?.value || 'monthly',
      promotion_code: norm.code,
      couponApplied: true,
      appliedCouponDetails: couponDetails,
      validatedCouponCode: norm.code,
    });

    this.clearCouponErrors();
    return;
  }

  console.log('❌ Coupon validation failed:', response?.error);
  this.resetCouponState();
  this.setCouponError(response?.error || 'Invalid promotion code');
}


  private setCouponError(errorMessage: string): void {
    const couponControl = this.paymentForm.get('promotion_code');
    if (couponControl) couponControl.setErrors({ couponError: errorMessage });
  }

  private clearCouponErrors(): void {
    const couponControl = this.paymentForm.get('promotion_code');
    if (couponControl) couponControl.setErrors(null);

    const paymentData = this.lenderFormService.getFormSection('payment');
    this.couponValidated.emit({
      applied: paymentData?.couponApplied || false,
      details: paymentData?.appliedCouponDetails || null,
    });
  }

  private resetCouponState(): void {
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
            if (!paymentInfo?.couponApplied) this.isLoading = false;
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

    console.log('💳 Creating checkout session:', {
      billingInterval,
      validatedPromotionCode,
    });

    const email =
      this.lenderData?.email?.toLowerCase().trim() ||
      this.lenderFormService.getFormSection('contact')?.email ||
      null;
    const role: 'lender' = 'lender';
    const interval: 'monthly' | 'annually' =
      billingInterval === 'annually' ? 'annually' : 'monthly';
    const userId = this.createdUserId || null;

    if (!email || !userId) {
      console.error('Missing email or userId for checkout.', { email, userId });
      this.isLoading = false;
      return;
    }

    this.paymentService
      .createCheckoutSession(email, role, interval, userId, validatedPromotionCode)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (response) => {
          if (response.url && !response.error) {
            console.log('🔄 Redirecting to Stripe:', response.url);
            this.paymentService.redirectToCheckout(response.url);
          } else {
            const msg = response.error || 'Failed to create checkout session';
            console.error('❌ Checkout session error:', msg);
            this.errorMessage = msg;
            this.paymentError.emit({ success: false, error: msg });
          }
        },
        error: (err) => {
          console.error('❌ Checkout request failed:', err);
          this.handlePaymentError(err);
        },
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

  get couponApplied(): boolean {
    const paymentInfo = this.lenderFormService.getFormSection('payment');
    return paymentInfo?.couponApplied || false;
  }

  get appliedCouponDetails(): any {
    const paymentInfo = this.lenderFormService.getFormSection('payment');
    return paymentInfo?.appliedCouponDetails || null;
  }
}
