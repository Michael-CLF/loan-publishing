import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

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
}

@Injectable({
  providedIn: 'root'
})
export class StripeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Create Stripe checkout session with comprehensive metadata
   * Angular 18 best practice: Strong typing and proper error handling
   */
  createCheckoutSession(data: CheckoutSessionRequest): Observable<CheckoutSessionResponse> {
    
    // Validate input data
    this.validateCheckoutData(data);

    // Prepare metadata following Stripe's metadata guidelines
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
      timestamp: new Date().toISOString()
    };

    const checkoutData = {
      email: data.email.toLowerCase().trim(),
      role: data.role,
      interval: data.interval,
      metadata,
      success_url: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${window.location.origin}/pricing`,
      // Additional Stripe configuration
      payment_method_types: ['card'],
      mode: 'subscription',
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_creation: 'always'
    };

    console.log('🔵 Creating Stripe checkout session with data:', {
      email: checkoutData.email,
      role: checkoutData.role,
      interval: checkoutData.interval,
      metadataKeys: Object.keys(metadata)
    });

    return this.http.post<CheckoutSessionResponse>(
      `${this.apiUrl}/create-checkout-session`, 
      checkoutData,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  /**
   * Validate checkout data before sending to Stripe
   * Angular 18 best practice: Input validation and sanitization
   */
  private validateCheckoutData(data: CheckoutSessionRequest): void {
    const errors: string[] = [];

    if (!data.email || !this.isValidEmail(data.email)) {
      errors.push('Valid email is required');
    }

    if (!data.userData.firstName?.trim()) {
      errors.push('First name is required');
    }

    if (!data.userData.lastName?.trim()) {
      errors.push('Last name is required');
    }

    if (!data.userData.company?.trim()) {
      errors.push('Company name is required');
    }

    if (!data.userData.phone?.trim()) {
      errors.push('Phone number is required');
    }

    if (!data.userData.city?.trim()) {
      errors.push('City is required');
    }

    if (!data.userData.state?.trim()) {
      errors.push('State is required');
    }

    if (!['monthly', 'annually'].includes(data.interval)) {
      errors.push('Valid billing interval is required');
    }

    if (!['originator', 'lender'].includes(data.role)) {
      errors.push('Valid role is required');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Sanitize string inputs to prevent issues with Stripe metadata
   * Angular 18 best practice: Data sanitization
   */
  private sanitizeString(input: string): string {
    if (!input) return '';
    
    return input
      .trim()
      .replace(/[^\w\s-.']/g, '') // Remove special characters except common ones
      .substring(0, 100); // Stripe metadata values have 500 char limit, but keep reasonable
  }

  /**
   * Sanitize and format phone numbers
   * Angular 18 best practice: Consistent data formatting
   */
  private sanitizePhoneNumber(phone: string): string {
    if (!phone) return '';
    
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX if 10 digits
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // Return original if not standard format
    return phone.substring(0, 50);
  }

  /**
   * Validate email format
   * Angular 18 best practice: Proper email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get checkout session status
   * Angular 18 best practice: Complete service API
   */
  getCheckoutSession(sessionId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/get-checkout-session`, {
      params: { session_id: sessionId }
    });
  }

  /**
   * Cancel checkout session if needed
   * Angular 18 best practice: Complete CRUD operations
   */
  cancelCheckoutSession(sessionId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/cancel-checkout-session`, {
      session_id: sessionId
    });
  }
}