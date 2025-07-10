import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, retryWhen, scan, delay } from 'rxjs/operators';
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
  private readonly apiUrl = environment.apiUrl;
  private readonly functionsUrl = 'https://us-central1-loanpub.cloudfunctions.net';

  /**
   * Validate Stripe promotion code using Firebase Cloud Function
   * Implements proper error handling and retry logic
   */
  validatePromotionCode(code: string): Observable<PromotionCodeValidationResponse> {
    if (!code?.trim()) {
      return throwError(() => new Error('Promotion code is required'));
    }

    console.log('🔵 Validating promotion code:', code);
    
    return this.http.post<PromotionCodeValidationResponse>(
      `${this.functionsUrl}/validatePromotionCode`,
      { code: code.trim().toUpperCase() },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    ).pipe(
      retryWhen(errors => 
        errors.pipe(
          scan((retryCount: number, error: HttpErrorResponse) => {
            if (error.status >= 400 && error.status < 500 || retryCount >= 2) {
              throw error;
            }
            console.warn(`🔄 Retrying promotion code validation (attempt ${retryCount + 1})`);
            return retryCount + 1;
          }, 0),
          delay(1000) // 1 second delay between retries
        )
      ),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Failed to validate promotion code', error);
        const errorMessage = error.status === 404 ? 'Invalid promotion code' : 'Unable to validate promotion code. Please try again.';
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Create Stripe checkout session following Angular 18 best practices
   * Implements proper error handling, retry logic, and type safety
   */
  createCheckoutSession(data: CheckoutSessionRequest): Observable<CheckoutSessionResponse> {
    // Early validation with detailed error messages
    this.validateCheckoutData(data);

    // Build request payload with proper type safety
    const requestPayload = this.buildCheckoutRequestPayload(data);

    console.log('🔵 Creating Stripe checkout session', {
      email: requestPayload.email,
      role: requestPayload.role,
      interval: requestPayload.interval,
      hasCoupon: !!requestPayload.coupon,
      timestamp: new Date().toISOString()
    });

    return this.http.post<CheckoutSessionResponse>(
      `${this.apiUrl}/createStripeCheckout`,
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Source': 'angular-registration'
        }
      }
    ).pipe(
      // Retry failed requests up to 2 times with exponential backoff
      retryWhen(errors => 
        errors.pipe(
          scan((retryCount: number, error: HttpErrorResponse) => {
            // Don't retry client errors (4xx)
            if (error.status >= 400 && error.status < 500) {
              throw error;
            }
            
            if (retryCount >= 2) {
              throw error;
            }
            
            console.warn(`🔄 Retrying Stripe checkout creation (attempt ${retryCount + 1})`, error);
            return retryCount + 1;
          }, 0),
          delay(1000) // 1 second delay between retries
        )
      ),
      
      // Transform response if needed
      map(response => {
        if (!response.url) {
          throw new Error('Invalid response: missing checkout URL');
        }
        
        console.log('✅ Stripe checkout session created successfully', {
          hasUrl: !!response.url,
          hasSessionId: !!response.sessionId
        });
        
        return response;
      }),
      
      // Handle errors with proper typing
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Failed to create Stripe checkout session', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: error.url
        });

        // Transform errors into user-friendly messages
        const errorMessage = this.getCheckoutErrorMessage(error);
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  /**
   * Get checkout session details using session ID
   */
  getCheckoutSession(sessionId: string): Observable<any> {
    if (!sessionId?.trim()) {
      return throwError(() => new Error('Session ID is required'));
    }

    return this.http.get(`${this.apiUrl}/get-checkout-session`, {
      params: { session_id: sessionId }
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Failed to get checkout session', error);
        return throwError(() => new Error('Failed to retrieve checkout session details'));
      })
    );
  }

  /**
   * Cancel checkout session
   */
  cancelCheckoutSession(sessionId: string): Observable<any> {
    if (!sessionId?.trim()) {
      return throwError(() => new Error('Session ID is required'));
    }

    return this.http.post(`${this.apiUrl}/cancel-checkout-session`, {
      session_id: sessionId
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Failed to cancel checkout session', error);
        return throwError(() => new Error('Failed to cancel checkout session'));
      })
    );
  }

  /**
   * Build checkout request payload with proper data transformation and sanitization
   * Following Angular best practices for data handling
   */
  private buildCheckoutRequestPayload(data: CheckoutSessionRequest) {
    const payload = {
      email: this.sanitizeEmail(data.email),
      role: data.role,
      interval: data.interval,
      userData: {
        firstName: this.sanitizeString(data.userData.firstName),
        lastName: this.sanitizeString(data.userData.lastName),
        company: this.sanitizeString(data.userData.company),
        phone: this.sanitizePhoneNumber(data.userData.phone),
        city: this.sanitizeString(data.userData.city),
        state: data.userData.state
      }
    } as any;

    // Add coupon data only if provided and valid
    if (data.coupon?.code?.trim()) {
      payload.coupon = {
        code: data.coupon.code.trim(),
        discount: data.coupon.discount,
        discountType: data.coupon.discountType
      };
    }

    return payload;
  }

  /**
   * Enhanced email sanitization with validation
   */
  private sanitizeEmail(email: string): string {
    if (!email) {
      throw new Error('Email is required');
    }
    
    const sanitized = email.toLowerCase().trim();
    
    if (!this.isValidEmail(sanitized)) {
      throw new Error('Invalid email format');
    }
    
    return sanitized;
  }

  /**
   * Enhanced string sanitization
   */
  private sanitizeString(input: string): string {
    if (!input) return '';
    
    return input
      .trim()
      .replace(/[^\w\s\-.']/g, '') // Allow letters, numbers, spaces, hyphens, periods, apostrophes
      .substring(0, 100);
  }

  /**
   * Enhanced phone number sanitization and formatting
   */
  private sanitizePhoneNumber(phone: string): string {
    if (!phone) return '';
    
    const digits = phone.replace(/\D/g, '');
    
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      // Handle +1 country code
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    return phone.substring(0, 50);
  }

  /**
   * Enhanced email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Enhanced phone number validation
   */
  private isValidPhoneNumber(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
  }

  /**
   * Get user-friendly error message based on HTTP error
   * Following Angular best practices for error handling
   */
  private getCheckoutErrorMessage(error: HttpErrorResponse): string {
    switch (error.status) {
      case 0:
        return 'Network error. Please check your internet connection and try again.';
      case 400:
        return 'Invalid registration data. Please check your form and try again.';
      case 401:
        return 'Authentication failed. Please refresh the page and try again.';
      case 403:
        return 'Access denied. Please contact support if this continues.';
      case 404:
        return 'Service not found. Please contact support.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Server error. Please try again in a few moments.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Enhanced validation with detailed error reporting
   * Following Angular best practices for form validation
   */
  private validateCheckoutData(data: CheckoutSessionRequest): void {
    const errors: string[] = [];

    // Email validation
    if (!data.email?.trim()) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(data.email)) {
      errors.push('Valid email address is required');
    }

    // User data validation
    if (!data.userData) {
      errors.push('User information is required');
    } else {
      const { firstName, lastName, company, phone, city, state } = data.userData;
      
      if (!firstName?.trim()) errors.push('First name is required');
      if (!lastName?.trim()) errors.push('Last name is required');
      if (!company?.trim()) errors.push('Company name is required');
      if (!phone?.trim()) errors.push('Phone number is required');
      if (!city?.trim()) errors.push('City is required');
      if (!state?.trim()) errors.push('State is required');
      
      // Enhanced phone validation
      if (phone?.trim() && !this.isValidPhoneNumber(phone)) {
        errors.push('Valid phone number is required');
      }
    }

    // Role and interval validation
    if (!['originator', 'lender'].includes(data.role)) {
      errors.push('Valid role is required');
    }

    if (!['monthly', 'annually'].includes(data.interval)) {
      errors.push('Valid billing interval is required');
    }

    // Coupon validation (if provided)
    if (data.coupon && !data.coupon.code?.trim()) {
      errors.push('Coupon code cannot be empty');
    }

    if (errors.length > 0) {
      const errorMessage = `Validation failed: ${errors.join(', ')}`;
      console.error('❌ Checkout data validation failed', { errors, data });
      throw new Error(errorMessage);
    }
  }
}