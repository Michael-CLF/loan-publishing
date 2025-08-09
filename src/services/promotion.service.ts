// src/app/services/promotion.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// ========================================
// 🎯 LOCAL COUPON CONFIGURATION
// ========================================
// Edit this section weekly to manage your promotion codes locally

interface LocalCoupon {
  code: string;
  name: string;
  type: 'percentage' | 'fixed' | 'trial';
  value?: number; // percentage (1-100) or fixed amount in cents
  validFor: ('originator' | 'lender')[];
  validIntervals: ('monthly' | 'annually')[];
  active: boolean;
  expiresAt?: string; // ISO date string
  maxUses?: number;
  currentUses?: number;
  trialDays?: number;
}

const LOCAL_COUPONS: LocalCoupon[] = [
  // 🔥 ACTIVE PROMOTIONS - Edit these weekly as needed
  {
    code: 'LENDER30TRIAL',
    name: '30-Day Free Trial',
    type: 'trial',
    trialDays: 30,
    validFor: ['lender'],
    validIntervals: ['annually'],
    active: true,
    maxUses: 100,
    currentUses: 0,
  },
  {
    code: 'ORIGINATOR50',
    name: '50% Off First Month',
    type: 'percentage',
    value: 50,
    validFor: ['originator'],
    validIntervals: ['monthly'],
    active: true,
    expiresAt: '2025-12-31',
    currentUses: 0,
  },
  {
    code: 'NEWLENDER20',
    name: '20% Off Annual Plan',
    type: 'percentage',
    value: 20,
    validFor: ['lender'],
    validIntervals: ['annually'],
    active: true,
    maxUses: 50,
    currentUses: 0,
  },
  {
    code: 'SAVE25',
    name: '$25 Off Any Plan',
    type: 'fixed',
    value: 2500, // $25 in cents
    validFor: ['originator', 'lender'],
    validIntervals: ['monthly', 'annually'],
    active: true,
    expiresAt: '2025-09-30',
    currentUses: 0,
  },
  {
  code: 'ORIGINATOR7TRIAL',
  name: '7-Day Free Trial for Originators',
  type: 'trial',
  value: 7, // 7 days
  validFor: ['originator'],
  validIntervals: ['monthly', 'annually'],
  active: true,
  expiresAt: '2025-12-31',
  currentUses: 0,
}
];

export interface CouponValidationResponse {
  valid: boolean;
  promotion_code?: {
    id?: string;
    code: string;
    coupon: {
      id?: string;
      percent_off?: number;
      amount_off?: number;
      currency?: string;
      name?: string;
      duration?: string;
      duration_in_months?: number;
    };
  };
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PromotionService {
  private readonly http = inject(HttpClient);
  private readonly functionsUrl =
    'https://us-central1-loanpub.cloudfunctions.net';

  // Keep local copy for usage tracking
  private coupons = [...LOCAL_COUPONS];

  /**
   * Validate a promotion code against role/interval.
   * Always returns the canonical { promotion_code: { ... } } shape when valid.
   */
  validatePromotionCode(
    code: string,
    role: 'originator' | 'lender',
    interval: 'monthly' | 'annually'
  ): Observable<CouponValidationResponse> {
    const cleanedCode = (code ?? '').trim().toUpperCase();

    if (!cleanedCode) {
      return of({ valid: false, error: 'Promotion code cannot be empty.' });
    }

    // 🎯 NEW: Try local validation first
    const localCoupon = this.coupons.find((c) => c.code === cleanedCode);
    if (localCoupon) {
      return of(this.validateLocalCoupon(localCoupon, role, interval));
    }

    // 🔄 Original: Fallback to Stripe validation
    return this.http
      .post<any>(`${this.functionsUrl}/validatePromotionCode`, {
        code: cleanedCode,
        role,
        interval,
      })
      .pipe(
        map((resp: any): CouponValidationResponse => {
          // ✅ Canonical shape from backend
          if (resp?.valid && resp?.promotion_code) {
            // Ensure code is present on the object
            return {
              valid: true,
              promotion_code: {
                code: resp.promotion_code.code ?? cleanedCode,
                id: resp.promotion_code.id,
                coupon: { ...(resp.promotion_code.coupon ?? {}) },
              },
            };
          }

          // 🛟 Legacy shape support: { valid, coupon }
          if (resp?.valid && resp?.coupon) {
            return {
              valid: true,
              promotion_code: {
                code: cleanedCode,
                id: resp.coupon?.id,
                coupon: { ...resp.coupon },
              },
            };
          }

          // Invalid / error case
          return {
            valid: false,
            error: resp?.error || 'Invalid promotion code.',
          };
        }),
        catchError((error) => {
          console.error('❌ Error validating promotion code:', error);
          return of({
            valid: false,
            error: 'Failed to validate promotion code. Please try again.',
          });
        })
      );
  }

  // 🎯 NEW: Local coupon validation
  private validateLocalCoupon(
    coupon: LocalCoupon,
    role: 'originator' | 'lender',
    interval: 'monthly' | 'annually'
  ): CouponValidationResponse {
    // Check if active
    if (!coupon.active) {
      return {
        valid: false,
        error: 'This promotion code is no longer active.',
      };
    }

    // Check expiration
    if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
      return { valid: false, error: 'This promotion code has expired.' };
    }

    // Check role
    if (!coupon.validFor.includes(role)) {
      return {
        valid: false,
        error: `This promotion code is not valid for ${role}s.`,
      };
    }

    // Check interval
    if (!coupon.validIntervals.includes(interval)) {
      return {
        valid: false,
        error: `This promotion code is not valid for ${interval} billing.`,
      };
    }

    // Check usage limit
    if (coupon.maxUses && (coupon.currentUses || 0) >= coupon.maxUses) {
      return {
        valid: false,
        error: 'This promotion code has reached its maximum usage limit.',
      };
    }

    // 🎉 Valid - increment usage
    coupon.currentUses = (coupon.currentUses || 0) + 1;

    // Return in Stripe format
    return {
      valid: true,
      promotion_code: {
        code: coupon.code,
        id: `local_${coupon.code}`,
        coupon: this.mapToStripeFormat(coupon),
      },
    };
  }

  // Map local coupon to Stripe format
  private mapToStripeFormat(coupon: LocalCoupon) {
    const result: any = {
      id: `local_${coupon.code}`,
      name: coupon.name,
      duration: 'once',
    };

    if (coupon.type === 'percentage') {
      result.percent_off = coupon.value;
    } else if (coupon.type === 'fixed') {
      result.amount_off = coupon.value;
      result.currency = 'USD';
    } else if (coupon.type === 'trial') {
      result.percent_off = 100;
      result.duration = 'repeating';
      result.duration_in_months = 1;
      result.trial_days = coupon.trialDays || 30;
    }

    return result;
  }
}
