// src/app/services/promotion.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// ========================================
// 🎯 UPDATED LOCAL COUPON INTERFACE
// ========================================

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
  setupFee?: number; // ✅ NEW: Setup fee in cents for special promotions
}

const LOCAL_COUPONS: LocalCoupon[] = [
  // 🔥 ACTIVE PROMOTIONS - Edit these weekly as needed
  {
    code: 'LENDER7TRIAL',
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
    code: 'LENDERMONTHLY7',
    name: '7-Day Free Trial',
    type: 'trial',
    trialDays: 7,
    validFor: ['lender'],
    validIntervals: ['monthly'],
    active: true,
    maxUses: 100,
    currentUses: 0,
  },
  {
    code: 'ORIGINATOR100',
    name: '100% Off Until 2025 ends',
    type: 'percentage',
    value: 100,
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
  },
  {
    code: 'BROKER30',
    name: '30-Day Free Trial for My Contacts',
    type: 'trial',
    value: 30, // 30 days
    validFor: ['originator'],
    validIntervals: ['monthly', 'annually'],
    active: true,
    expiresAt: '2025-12-31',
    currentUses: 0,
  },
  // ✅ NEW: LABORDAY6 Promotion
  {
    code: 'LABORDAY6',
    name: '6-Month Free Trial + $100 Setup Fee',
    type: 'trial',
    trialDays: 180, // 6 months ≈ 180 days
    setupFee: 10000, // $100 in cents
    validFor: ['originator', 'lender'],
    validIntervals: ['monthly', 'annually'],
    active: true,
    expiresAt: '2025-12-31', // Set appropriate expiration
    maxUses: 500,
    currentUses: 0,
  },
];

// ========================================
// 🎯 UPDATED VALIDATION RESPONSE INTERFACE
// ========================================

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
      // ✅ NEW: Setup fee information for special promotions
      setup_fee?: number;
      trial_days?: number;
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

    // 🎯 Try local validation first
    const localCoupon = this.coupons.find((c) => c.code === cleanedCode);
    if (localCoupon) {
      return of(this.validateLocalCoupon(localCoupon, role, interval));
    }

    // 🔄 Fallback to Stripe validation
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

  // 🎯 Updated local coupon validation with setup fee support
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

    // Return in Stripe format with setup fee support
    return {
      valid: true,
      promotion_code: {
        code: coupon.code,
        id: `local_${coupon.code}`,
        coupon: this.mapToStripeFormat(coupon),
      },
    };
  }

  // ✅ Updated mapping to include setup fee
  private mapToStripeFormat(coupon: LocalCoupon) {
    const result: any = {
      id: `local_${coupon.code}`,
      name: coupon.name,
      duration: 'once',
    };

    // Add setup fee if present
    if (coupon.setupFee) {
      result.setup_fee = coupon.setupFee;
    }

    // Add trial days if present
    if (coupon.trialDays) {
      result.trial_days = coupon.trialDays;
    }

    if (coupon.type === 'percentage') {
      result.percent_off = coupon.value;
    } else if (coupon.type === 'fixed') {
      result.amount_off = coupon.value;
      result.currency = 'USD';
    } else if (coupon.type === 'trial') {
      // For trials with setup fee, don't set 100% off
      if (coupon.setupFee) {
        result.percent_off = 0; // No discount on subscription, just trial + setup fee
      } else {
        result.percent_off = 100; // Full trial
      }
      result.duration = 'repeating';
      result.duration_in_months = Math.ceil((coupon.trialDays || 30) / 30);
    }

    return result;
  }

  /**
   * ✅ NEW: Helper method to check if a coupon has a setup fee
   */
  hasSetupFee(code: string): boolean {
    const coupon = this.coupons.find(c => c.code === code.toUpperCase());
    return !!(coupon?.setupFee && coupon.setupFee > 0);
  }

  /**
   * ✅ NEW: Get setup fee amount for a coupon
   */
  getSetupFee(code: string): number {
    const coupon = this.coupons.find(c => c.code === code.toUpperCase());
    return coupon?.setupFee || 0;
  }
}