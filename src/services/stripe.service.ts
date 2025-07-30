// ============================================
// src/app/services/stripe.service.ts
// ============================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { AppCheckService } from './app-check.service';

export interface CheckoutSessionRequest {
  email: string;
  role: 'originator' | 'lender';
  interval: 'monthly' | 'annually';
  userData: {
    firstName: string;
    lastName: string;
    company: string;
    phone: string;
    city: string;
    state: string;
    draftId?: string;
  };
  promotion_code?: string | null;
}

export interface CheckoutSessionResponse {
  url: string;
  sessionId?: string;
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

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private readonly http = inject(HttpClient);
  private readonly appCheckService = inject(AppCheckService);
  private readonly apiUrl = environment.apiUrl;
  private readonly functionsUrl = 'https://us-central1-loanpub.cloudfunctions.net';

  /**
   * ✅ Create a Stripe Checkout Session
   */
  async createCheckoutSession(requestData: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    console.log('📤 Sending checkout session request:', requestData);

    try {
      // Validate data before sending
      this.validateCheckoutData(requestData);

      // Call backend endpoint
      const response = await firstValueFrom(
        this.http.post<CheckoutSessionResponse>(
          `${this.functionsUrl}/createStripeCheckout`,
          requestData,
          { headers: new HttpHeaders({ 'Content-Type': 'application/json' }) }
        ).pipe(
          catchError((error: HttpErrorResponse) => {
            console.error('❌ Error creating Stripe checkout session:', error);
            let message = 'Failed to create checkout session. Please try again.';
            if (error.status === 400 && error.error?.error?.includes('promotion code')) {
              message = 'Invalid promotion code provided.';
            }
            return throwError(() => new Error(message));
          })
        )
      );

      console.log('✅ Stripe session created successfully:', response);
      return response;

    } catch (error: any) {
      console.error('❌ createCheckoutSession failed:', error);
      throw new Error(error.message || 'Failed to create checkout session.');
    }
  }

  /**
   * ✅ Retrieve an existing checkout session
   */
  getCheckoutSession(sessionId: string): Observable<any> {
    return this.http.get(`${this.functionsUrl}/get-checkout-session`, {
      params: { session_id: sessionId }
    });
  }

  /**
   * ✅ Cancel a checkout session
   */
  cancelCheckoutSession(sessionId: string): Observable<any> {
    return this.http.post(`${this.functionsUrl}/cancel-checkout-session`, {
      session_id: sessionId
    });
  }

  /**
   * ✅ Validate a promotion code
   */
  validatePromotionCode(promotion_code: string, role: string, interval: string): Observable<CouponValidationResponse> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });

    const body = {
      code: promotion_code,
      role,
      interval
    };

    return this.http.post<CouponValidationResponse>(
      `${this.functionsUrl}/validatePromotionCode`,
      body,
      { headers }
    ).pipe(
      catchError((error) => {
        console.error('❌ Promotion code validation failed:', error);
        return of({ valid: false, error: 'Error validating promotion code' });
      })
    );
  }

  // ----------------------
  // ✅ HELPER FUNCTIONS
  // ----------------------
  private validateCheckoutData(data: CheckoutSessionRequest): void {
    const errors: string[] = [];

    if (!data.email || !this.isValidEmail(data.email)) errors.push('Valid email is required');
    if (!data.userData.firstName?.trim()) errors.push('First name is required');
    if (!data.userData.lastName?.trim()) errors.push('Last name is required');
    if (!data.userData.company?.trim()) errors.push('Company name is required');
    if (!data.userData.phone?.trim()) errors.push('Phone number is required');
    if (!data.userData.city?.trim()) errors.push('City is required');
    if (!data.userData.state?.trim()) errors.push('State is required');
    if (!['monthly', 'annually'].includes(data.interval)) errors.push('Valid billing interval is required');
    if (!['originator', 'lender'].includes(data.role)) errors.push('Valid role is required');
    if (data.promotion_code && !data.promotion_code.trim()) errors.push('Promotion code cannot be empty if provided');

    if (errors.length > 0) throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
