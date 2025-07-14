// src/app/services/stripe.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { getToken } from 'firebase/app-check';
import { AppCheckService } from './app-check.service';


export interface CheckoutSessionRequest {
  email: string;
  role: string;
  interval: 'monthly' | 'annually';
  userData: {
    firstName: string;
    lastName: string;
    company: string;
    phone: string;
    city: string;
    state: string;
  };
  coupon?: {
    code: string;
    discount: number;
    discountType: 'percentage' | 'fixed';
  };
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
   * Validate Stripe promotion code using Firebase Cloud Function
   */
  validatePromotionCode(code: string): Observable<PromotionCodeValidationResponse> {
    console.log('🔵 Validating promotion code:', code);

    return this.http.post<PromotionCodeValidationResponse>(
      `${this.functionsUrl}/validatePromotionCode`,
      { code: code.trim().toUpperCase() },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  /**
   * Create Stripe checkout session with App Check protection
   */
  async createCheckoutSession(data: CheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    this.validateCheckoutData(data);

    const metadata: StripeMetadata = {
      email: data.email.toLowerCase().trim(),
      firstName: this.sanitizeString(data.userData.firstName),
      lastName: this.sanitizeString(data.userData.lastName),
      company: this.sanitizeString(data.userData.company),
      phone: this.sanitizePhoneNumber(data.userData.phone),
      city: this.sanitizeString(data.userData.city),
      state: data.userData.state,
      role: data.role,
      interval: data.interval,
      source: 'registration_form',
      timestamp: new Date().toISOString(),
      couponCode: data.coupon?.code
    };

    const checkoutData: any = {
      email: data.email.toLowerCase().trim(),
      role: data.role,
      interval: data.interval,
      userData: data.userData,
      coupon: data.coupon
    };

    if (data.coupon?.code) {
      checkoutData.promotion_code = data.coupon.code.trim().toUpperCase();
    }

    const appCheckInstance = this.appCheckService.getAppCheckInstance();
    if (!appCheckInstance) {
      throw new Error('App Check not initialized');
    }
    const tokenResult = await getToken(appCheckInstance, false);


    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Firebase-AppCheck': tokenResult.token
    });

    console.log('🔵 Creating Stripe checkout session with App Check token');

    return firstValueFrom(
      this.http.post<CheckoutSessionResponse>(
        `${this.apiUrl}/createStripeCheckout`,
        checkoutData,
        { headers }
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
    if (data.coupon && !data.coupon.code?.trim()) errors.push('Coupon code cannot be empty if coupon is provided');

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
