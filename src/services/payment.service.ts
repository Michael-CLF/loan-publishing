/**
 * Payment Service
 * 
 * Handles Stripe checkout session creation and payment flow.
 * Called after user verifies email (status='pending_payment').
 */

import { Injectable, inject, signal } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * Checkout session request
 */
export interface CreateCheckoutRequest {
  interval?: 'monthly' | 'annually';
  promotionCode?: string;
}

/**
 * Checkout session response
 */
export interface CreateCheckoutResponse {
  success: boolean;
  message: string;
  checkoutUrl?: string;
  sessionId?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private functions = inject(Functions);

  // Payment state signals
  isCreatingCheckout = signal<boolean>(false);
  checkoutError = signal<string | null>(null);

  /**
   * Creates Stripe checkout session
   * User must be authenticated and have verified email
   */
  createCheckoutSession(
    interval: 'monthly' | 'annually' = 'monthly',
    promotionCode?: string
  ): Observable<CreateCheckoutResponse> {
    console.log('💳 PaymentService: Creating checkout session', { interval, promotionCode });

    this.isCreatingCheckout.set(true);
    this.checkoutError.set(null);

    const createCheckoutCallable = httpsCallable<CreateCheckoutRequest, CreateCheckoutResponse>(
      this.functions,
      'createCheckoutSession'
    );

    const request: CreateCheckoutRequest = {
      interval,
      promotionCode: promotionCode?.toUpperCase().trim(),
    };

    return from(createCheckoutCallable(request)).pipe(
      map((result) => {
        console.log('📦 Checkout response:', result);
        
        const response = result.data;

        if (response.success) {
          console.log('✅ Checkout session created');
        } else {
          this.checkoutError.set(response.message || 'Failed to create checkout session');
          console.error('❌ Checkout creation failed:', response.message);
        }

        this.isCreatingCheckout.set(false);
        return response;
      }),
      catchError((error) => {
        console.error('❌ Checkout error:', error);
        const errorMessage = error.message || 'Failed to create checkout session. Please try again.';
        this.checkoutError.set(errorMessage);
        this.isCreatingCheckout.set(false);
        
        throw error;
      })
    );
  }

  /**
   * Redirects to Stripe checkout
   */
  redirectToCheckout(checkoutUrl: string): void {
    console.log('🔄 Redirecting to Stripe checkout');
    window.location.href = checkoutUrl;
  }

  /**
   * Clears payment state
   */
  clearState(): void {
    this.isCreatingCheckout.set(false);
    this.checkoutError.set(null);
  }
}