// src/app/services/promotion.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';

export interface CouponValidationResponse {
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

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private readonly http = inject(HttpClient);
  private readonly functionsUrl = 'https://us-central1-loanpub.cloudfunctions.net';

  validatePromotionCode(
    code: string,
    role: 'originator' | 'lender',
    interval: 'monthly' | 'annually'
  ): Observable<CouponValidationResponse> {
    const cleanedCode = code.trim().toUpperCase();

    if (!cleanedCode) {
      return of({
        valid: false,
        error: 'Promotion code cannot be empty.'
      });
    }

    return this.http.post<any>(`${this.functionsUrl}/validatePromotionCode`, {
      code: cleanedCode,
      role,
      interval
    }).pipe(
      map(response => {
        if (!response || !response.valid || !response.promotion_code) {
          return { valid: false, error: 'Invalid promotion code.' };
        }

        const coupon = response.promotion_code.coupon;
        return {
          valid: true,
          coupon: {
            id: response.promotion_code.id,
            code: cleanedCode,
            discount: coupon.percent_off ?? coupon.amount_off ?? 0,
            discountType: (coupon.percent_off ? 'percentage' : 'fixed') as 'percentage' | 'fixed',
            description: coupon.name || ''
          }
        };
      }),
      catchError(error => {
        console.error('❌ Error validating promotion code:', error);
        return of({
          valid: false,
          error: 'Failed to validate promotion code. Please try again.'
        });
      })
    );
  }
}
