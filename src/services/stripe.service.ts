// ============================================
// src/app/services/stripe.service.ts
// ============================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../environments/environment';

export interface CheckoutSessionRequest {
  email: string;
  role: 'originator' | 'lender';
  interval: 'monthly' | 'annually';
  userData: {
    /** REQUIRED: Firebase Auth UID to link Stripe session to the Firestore doc */
    userId: string;
    /** Optional: any display fields you still want to send */
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
    city?: string;
    state?: string;
  };
  /** Optional: validated promotion code (uppercase) */
  promotion_code?: string | null;
}

export interface CheckoutSessionResponse {
  url: string;
}

export interface CouponValidationResponse {
  valid: boolean;
  promotion_code?: {
    id: string;
    code: string;
    coupon: {
      id: string;
      percent_off?: number | null;
      amount_off?: number | null;
      currency?: string | null;
      name?: string;
      duration?: string;
      duration_in_months?: number | null;
    };
  };
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class StripeService {
  private readonly http = inject(HttpClient);
  private readonly functionsUrl =
    environment.stripeCheckoutUrl || 'https://us-central1-loanpub.cloudfunctions.net';

  // ----------------------
  // Create Checkout Session
  // ----------------------
  async createCheckoutSession(requestData: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    this.validateCheckoutData(requestData);

    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    try {
      const res = await firstValueFrom(
        this.http
          .post<CheckoutSessionResponse>(
            `${this.functionsUrl}/createStripeCheckout`,
            requestData,
            { headers }
          )
          .pipe(
            catchError((error: HttpErrorResponse) => {
              let message = 'Failed to create checkout session. Please try again.';
              if (error.status === 400 && typeof error.error === 'object') {
                if (error.error?.error) message = error.error.error;
              }
              return throwError(() => new Error(message));
            })
          )
      );
      return res;
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to create checkout session.');
    }
  }

  // ----------------------
  // Get/Cancel Session (optional helpers)
  // ----------------------
  getCheckoutSession(sessionId: string): Observable<any> {
    return this.http.get(`${this.functionsUrl}/get-checkout-session`, {
      params: { session_id: sessionId },
    });
  }

  cancelCheckoutSession(sessionId: string): Observable<any> {
    return this.http.post(`${this.functionsUrl}/cancel-checkout-session`, {
      session_id: sessionId,
    });
  }

  // ----------------------
  // Validate promotion code
  // ----------------------
  validatePromotionCode(
    promotion_code: string,
    role: 'originator' | 'lender',
    interval: 'monthly' | 'annually'
  ): Observable<CouponValidationResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const body = { code: promotion_code, role, interval };

    return this.http
      .post<CouponValidationResponse>(`${this.functionsUrl}/validatePromotionCode`, body, {
        headers,
      })
      .pipe(
        catchError(() => {
          return of({ valid: false, error: 'Error validating promotion code' });
        })
      );
  }

  // ----------------------
  // Helpers
  // ----------------------
  private validateCheckoutData(data: CheckoutSessionRequest): void {
    const errors: string[] = [];

    if (!data.email?.trim()) errors.push('Valid email is required');
    if (!['originator', 'lender'].includes(data.role)) errors.push('Valid role is required');
    if (!['monthly', 'annually'].includes(data.interval)) errors.push('Valid billing interval is required');

    if (!data.userData || !data.userData.userId || !data.userData.userId.trim()) {
      errors.push('Missing user UID');
    }

    if (data.promotion_code !== undefined && data.promotion_code !== null) {
      if (!data.promotion_code.toString().trim()) {
        errors.push('Promotion code cannot be empty if provided');
      }
    }

    if (errors.length) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }
}
