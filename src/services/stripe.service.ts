import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CheckoutRequest {
  email: string;
  role: 'originator' | 'lender';
  interval: 'monthly' | 'annually';
  userId?: string;
  userData?: {
    firstName: string;
    lastName: string;
    company: string;
    phone: string;
    city: string;
    state: string;
  };
}

export interface CheckoutResponse {
  url: string;
}

@Injectable({ 
  providedIn: 'root' 
})
export class StripeService {
  private functions = inject(Functions);

  createCheckoutSession(data: CheckoutRequest): Observable<CheckoutResponse> {
    const createCheckoutSession = httpsCallable<CheckoutRequest, CheckoutResponse>(
      this.functions, 
      'stripeCheckout'  // Make sure this matches your Firebase function name
    );
    
    return from(createCheckoutSession(data)).pipe(
      map(result => result.data)  // Extract the data from the Firebase result
    );
  }
}