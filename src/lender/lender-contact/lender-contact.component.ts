import { Component, inject, Input, OnDestroy, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, catchError } from 'rxjs/operators';
import { StripeService } from '../../services/stripe.service';


interface StateOption {
  value: string;
  name: string;
}

interface AppliedCouponDetails {
  code: string;
  displayCode?: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  description?: string;
}

@Component({
  selector: 'app-lender-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lender-contact.component.html',
  styleUrls: ['./lender-contact.component.css'],
})
export class LenderContactComponent implements OnDestroy {
  @Input() lenderForm!: FormGroup;
  @Input() states: StateOption[] = [];
  @Output() couponValidated = new EventEmitter<any>();

  private stripeService = inject(StripeService);
  private destroy$ = new Subject<void>();

  // ✅ Promotion code properties
  isValidatingCoupon = false;
  couponApplied = false;
  appliedCouponDetails: AppliedCouponDetails | null = null;

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Format phone number as the user types
  formatPhoneNumberOnInput(event: any): void {
    const input = event.target.value.replace(/\D/g, '');
    const phoneControl = this.lenderForm.get('.contactPhone');

    if (input.length <= 10) {
      let formattedNumber = input;

      if (input.length > 3) {
        formattedNumber = `(${input.substring(0, 3)}) ${input.substring(3)}`;
      }

      if (input.length > 6) {
        formattedNumber = `(${input.substring(0, 3)}) ${input.substring(
          3,
          6
        )}-${input.substring(6)}`;
      }

      // Update the value without marking as touched to prevent premature validation
      phoneControl?.setValue(formattedNumber, { emitEvent: false });

      // Update validity manually
      if (input.length === 10) {
        phoneControl?.setErrors(null);
      } else if (input.length > 0) {
        phoneControl?.setErrors({ invalidLength: true });
      }
    }
  }

  // Keep the blur handler for cases where the user pastes a number
  formatPhoneNumber(): void {
    const phoneControl = this.lenderForm.get('.contactPhone');
    if (phoneControl?.value) {
      let phoneNumber = phoneControl.value.replace(/\D/g, '');
      if (phoneNumber.length === 10) {
        const formattedNumber = `(${phoneNumber.substring(
          0,
          3
        )}) ${phoneNumber.substring(3, 6)}-${phoneNumber.substring(6)}`;
        phoneControl.setValue(formattedNumber, { emitEvent: false });
        phoneControl.setErrors(null);
      } else if (phoneNumber.length > 0) {
        phoneControl.setErrors({ invalidLength: true });
      }
    }
  }

  /**
   * ✅ Applies the promotion code (triggered by Apply button)
   */
  applyCoupon(): void {
    const couponCode = this.lenderForm.get('couponCode')?.value?.trim();

    if (!couponCode) {
      return;
    }

    this.isValidatingCoupon = true;

    this.stripeService.validatePromotionCode(couponCode)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isValidatingCoupon = false;
        }),
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
    const couponCode = this.lenderForm.get('couponCode')?.value?.trim();
    if (!couponCode) return;

    this.isValidatingCoupon = true;

    this.stripeService.validatePromotionCode(couponCode)
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
    const couponControl = this.lenderForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors({ couponError: errorMessage });
    }
  }

  /**
   * ✅ Clear coupon errors
   */
  private clearCouponErrors(): void {
    // ✅ Tell parent component about successful validation
    this.couponValidated.emit({
      applied: true,
      details: this.appliedCouponDetails
    });
    const couponControl = this.lenderForm.get('couponCode');
    if (couponControl) {
      couponControl.setErrors(null);
    }
  }

  /**
   * ✅ Reset coupon state
   */
  private resetCouponState(): void {
    this.couponApplied = false;
    this.appliedCouponDetails = null;
    this.clearCouponErrors();
    // ✅ Tell parent component validation was reset
    this.couponValidated.emit({
      applied: false,
      details: null
    });
  }
}