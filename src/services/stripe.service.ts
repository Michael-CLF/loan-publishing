// src/app/services/stripe.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom, catchError, map, of } from 'rxjs';
import { environment } from '../environments/environment';
import { getToken } from 'firebase/app-check';
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
    draftId: string;
  };
  promotion_code?: string;
}

export interface CheckoutSessionResponse {
  url: string;
  sessionId?: string;
}

export interface StripeMetadata {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  city: string;
  state: string;
  role: string;
  interval: string;
  source: string;
  timestamp: string;
  couponCode?: string;
  draftId?: string;
}

export interface PromotionCodeValidationResponse {
  valid: boolean;
  promotion_code?: {
    id: string;
    code: string;
    coupon: {
      id: string;
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

// Add this helper interface for the component
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
export class StripeService {
  private readonly http = inject(HttpClient);
  private readonly appCheckService = inject(AppCheckService);
  private readonly apiUrl = environment.apiUrl;
  private readonly functionsUrl = 'https://us-central1-loanpub.cloudfunctions.net';

 validatePromotionCode(code: string, role: 'originator' | 'lender', interval: 'monthly' | 'annually'): Observable<any> {
  console.log('🔵 Validating promotion code:', code);

  if (!code?.trim()) {
    throw new Error('Promotion code cannot be empty');  }

  return this.http.post<any>(
    `${this.functionsUrl}/validatePromotionCode`,
    {
      code: code.trim().toUpperCase(),
      role,
      interval
    },
    {
      headers: { 'Content-Type': 'application/json' }
    }
  ).pipe(
    catchError((error) => {
      console.error('❌ Promotion code validation failed:', error);
      throw new Error('Failed to validate promotion code. Please try again.');
    })
  );
}
  /**
   * Create Stripe checkout session with App Check protection
   */
  async createCheckoutSession(data: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    console.log('🚨 createCheckoutSession method called!');
    this.validateCheckoutData(data);

    console.log('🔍 functionsUrl:', this.functionsUrl);
    console.log('🔍 environment.registerUserUrl:', environment.registerUserUrl);
    console.log('🔍 Final URL:', `{environment.registerUserUrl}`);
    console.log('🔵 Creating Stripe checkout session');
    this.validateCheckoutData(data);

    const checkoutData: any = {
      email: data.email.toLowerCase().trim(),
      role: data.role,
      interval: data.interval,
      userData: data.userData,
    };

    if (data.promotion_code && typeof data.promotion_code === 'string') {
      checkoutData.promotion_code = data.promotion_code.trim().toUpperCase();
    }


    console.log('🔵 Creating Stripe checkout session (App Check disabled)');

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });


    console.log('🔵 Creating Stripe checkout session with App Check token');

    return firstValueFrom(
      this.http.post<CheckoutSessionResponse>(
        environment.stripeCheckoutUrl, // ← Fixed endpoint
        checkoutData,
        { headers }
      ).pipe(
        catchError((error) => {
          console.error('❌ Stripe checkout failed:', error);
          throw new Error('Failed to create checkout session. Please try again.');
        })
      )
    );
  }

  getCheckoutSession(sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/get-checkout-session`, {
      params: { session_id: sessionId }
    });
  }

  cancelCheckoutSession(sessionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/cancel-checkout-session`, {
      session_id: sessionId
    });
  }

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

  private sanitizeString(input: string): string {
    return input?.trim().replace(/[^\w\s-.']/g, '').substring(0, 100) || '';
  }

  private sanitizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10
      ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
      : phone.substring(0, 50);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
