// payment.service.ts

/**
 * Payment Service
 *
 * Calls the backend HTTPS function to create a Stripe Checkout session.
 * Exposes state flags for UI.
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';

export interface CreateCheckoutResponse {
  url?: string;
  sessionId?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);

  // Cloud Function endpoint for Design B
  // This must match your deployed function name in stripe.ts
  private checkoutEndpoint =
    'https://us-central1-loanpub.cloudfunctions.net/createStripeCheckout';

  // UI state
  isCreatingCheckout = signal<boolean>(false);
  checkoutError = signal<string | null>(null);

  /**
   * createCheckoutSession
   *
   * Starts Stripe Checkout for this user.
   * Do not rename this method.
   */
  createCheckoutSession(
    email: string,
    role: 'lender' | 'originator',
    interval: 'monthly' | 'annually',
    userId: string,
    promoCode?: string
  ): Observable<CreateCheckoutResponse> {
    this.isCreatingCheckout.set(true);
    this.checkoutError.set(null);

    const payload: any = {
      email: email.toLowerCase().trim(),
      role,
      interval,
      userData: { userId }
    };

    // Backend expects promotion_code (snake case)
    if (promoCode) {
      payload.promotion_code = promoCode.toUpperCase().trim();
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
      // No Authorization header. Design B does not require ID token.
    });

    return this.http
      .post<CreateCheckoutResponse>(this.checkoutEndpoint, payload, { headers })
      .pipe(
        tap((resp) => {
          // If backend sent an error field
          if (!resp || resp.error) {
            const msg =
              resp?.error ||
              'Failed to create checkout session';
            console.error('Checkout creation failed:', msg);
            this.checkoutError.set(msg);
          } else {
            // happy path
            console.log('Checkout session created:', resp);
          }

          this.isCreatingCheckout.set(false);
        }),
        map((resp) => resp),
        catchError((err) => {
          const msg =
            err?.error?.error ||
            err?.message ||
            'Failed to create checkout session';

          console.error('Checkout HTTP error:', msg, err);
          this.checkoutError.set(msg);
          this.isCreatingCheckout.set(false);

          return throwError(() => err);
        })
      );
  }

  /**
   * redirectToCheckout
   *
   * Navigates browser to Stripe-hosted checkout page.
   * Do not rename this method.
   */
  redirectToCheckout(checkoutUrl: string | undefined): void {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    } else {
      this.checkoutError.set('No checkout URL returned');
    }
  }

  /**
   * clearState
   *
   * Resets local flags.
   * Do not rename this method.
   */
  clearState(): void {
    this.isCreatingCheckout.set(false);
    this.checkoutError.set(null);
  }
}
