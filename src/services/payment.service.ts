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
 /**
 * createCheckoutSession
 *
 * Starts Stripe Checkout for this user.
 * Backend no longer accepts raw promo data here.
 * It only needs email, role, interval, and userId.
 */
// --- replace the whole createCheckoutSession(...) method ---
createCheckoutSession(
  email: string,
  role: 'lender' | 'originator',
  interval: 'monthly' | 'annually',
  userId: string,
  promotionCode?: string
): Observable<CreateCheckoutResponse> {
  this.isCreatingCheckout.set(true);
  this.checkoutError.set(null);

  const payload: any = {
    email: email.toLowerCase().trim(),
    role,
    interval,
    userId
  };
  if (promotionCode && promotionCode.trim().length > 0) {
    payload.promotionCode = promotionCode.trim();
  }

  // headers are optional; keep if you already have them defined above
  return this.http
    .post<CreateCheckoutResponse>(this.checkoutEndpoint, payload /*, { headers }*/)
    .pipe(
      tap((resp) => {
        if (!resp || (resp as any).error) {
          const msg =
            ((resp as any)?.error as string) || 'Failed to create checkout session';
          this.checkoutError.set(msg);
          console.error('Checkout creation failed:', msg);
        } else {
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
        this.checkoutError.set(msg);
        this.isCreatingCheckout.set(false);
        console.error('Checkout HTTP error:', msg, err);
        return throwError(() => err);
      })
    );
}
// --- end replacement ---


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
