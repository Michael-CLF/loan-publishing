// src/app/services/promotion.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
  providedIn: 'root'
})
export class PromotionService {
  private readonly http = inject(HttpClient);
  private readonly functionsUrl = 'https://us-central1-loanpub.cloudfunctions.net';

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

    return this.http
      .post<any>(`${this.functionsUrl}/validatePromotionCode`, {
        code: cleanedCode,
        role,
        interval
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
                coupon: { ...(resp.promotion_code.coupon ?? {}) }
              }
            };
          }

          // 🛟 Legacy shape support: { valid, coupon }
          if (resp?.valid && resp?.coupon) {
            return {
              valid: true,
              promotion_code: {
                code: cleanedCode,
                id: resp.coupon?.id,
                coupon: { ...resp.coupon }
              }
            };
          }

          // Invalid / error case
          return {
            valid: false,
            error: resp?.error || 'Invalid promotion code.'
          };
        }),
        catchError((error) => {
          console.error('❌ Error validating promotion code:', error);
          return of({
            valid: false,
            error: 'Failed to validate promotion code. Please try again.'
          });
        })
      );
  }
}
