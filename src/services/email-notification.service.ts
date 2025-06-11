import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable, HttpsCallableResult } from '@angular/fire/functions';
import { Observable, from, throwError, timer } from 'rxjs';
import { map, catchError, timeout, retryWhen, concatMap, take } from 'rxjs/operators';
import { LenderNotificationPreferences } from '../types/notification.types';

/**
 * Interface for email notification responses
 */
export interface EmailNotificationResponse {
  success: boolean;
  message: string;
  emailsSent?: number;
}

/**
 * Interface for saving notification preferences
 */
export interface SavePreferencesResponse {
  success: boolean;
  message: string;
  preferences: LenderNotificationPreferences;
}

/**
 * Interface for getting notification preferences
 */
export interface GetPreferencesResponse {
  preferences: LenderNotificationPreferences;
}

/**
 * Service for handling email notifications through Firebase Cloud Functions
 * Following Angular 18 best practices with standalone services and modern DI
 */
@Injectable({
  providedIn: 'root'
})
export class EmailNotificationService {
  private readonly functions = inject(Functions);
  private readonly EMAIL_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 2;

  /**
   * Send test email
   * @param email - Email address to send test email to
   * @returns Observable<EmailNotificationResponse>
   */
  sendTestEmail(email: string): Observable<EmailNotificationResponse> {
    if (!email || !this.isValidEmail(email)) {
      return throwError(() => new Error('Valid email address is required'));
    }

    const sendTestEmailFn = httpsCallable<{ email: string }, EmailNotificationResponse>(
      this.functions,
      'sendTestEmail'
    );

    return from(sendTestEmailFn({ email: email.trim().toLowerCase() })).pipe(
      map(result => result.data),
      timeout(this.EMAIL_TIMEOUT),
      retryWhen(errors => 
        errors.pipe(
          concatMap((error, index) => {
            if (index >= this.MAX_RETRIES) {
              return throwError(() => error);
            }
            const delayMs = Math.pow(2, index) * 1000;
            console.warn(`Email service retry ${index + 1}/${this.MAX_RETRIES} in ${delayMs}ms:`, error);
            return timer(delayMs);
          }),
          take(this.MAX_RETRIES)
        )
      ),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Send loan notifications to matching lenders
   * @param loanId - ID of the loan to send notifications for
   * @returns Observable<EmailNotificationResponse>
   */
  sendLoanNotifications(loanId: string): Observable<EmailNotificationResponse> {
    if (!loanId || loanId.trim().length === 0) {
      return throwError(() => new Error('Loan ID is required'));
    }

    const sendLoanNotificationsFn = httpsCallable<{ loanId: string }, EmailNotificationResponse>(
      this.functions,
      'sendLoanNotifications'
    );

    return from(sendLoanNotificationsFn({ loanId: loanId.trim() })).pipe(
      map(result => result.data),
      timeout(this.EMAIL_TIMEOUT),
      retryWhen(errors => 
        errors.pipe(
          concatMap((error, index) => {
            if (index >= this.MAX_RETRIES) {
              return throwError(() => error);
            }
            const delayMs = Math.pow(2, index) * 1000;
            console.warn(`Email service retry ${index + 1}/${this.MAX_RETRIES} in ${delayMs}ms:`, error);
            return timer(delayMs);
          }),
          take(this.MAX_RETRIES)
        )
      ),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Save notification preferences
   * Note: We don't pass userId anymore - Firebase Functions v2 gets it from auth context
   * @param preferences - Notification preferences to save
   * @returns Observable<SavePreferencesResponse>
   */
  saveNotificationPreferencesCallable(preferences: LenderNotificationPreferences): Observable<SavePreferencesResponse> {
    if (!preferences) {
      return throwError(() => new Error('Notification preferences are required'));
    }

    const savePreferencesFn = httpsCallable<{ preferences: LenderNotificationPreferences }, SavePreferencesResponse>(
      this.functions,
      'saveNotificationPreferences'
    );

    return from(savePreferencesFn({ preferences })).pipe(
      map(result => result.data),
      timeout(this.EMAIL_TIMEOUT),
      retryWhen(errors => 
        errors.pipe(
          concatMap((error, index) => {
            if (index >= this.MAX_RETRIES) {
              return throwError(() => error);
            }
            const delayMs = Math.pow(2, index) * 1000;
            console.warn(`Email service retry ${index + 1}/${this.MAX_RETRIES} in ${delayMs}ms:`, error);
            return timer(delayMs);
          }),
          take(this.MAX_RETRIES)
        )
      ),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Get notification preferences
   * Note: We don't pass userId anymore - Firebase Functions v2 gets it from auth context
   * @returns Observable<LenderNotificationPreferences>
   */
  getNotificationPreferencesCallable(): Observable<LenderNotificationPreferences> {
    const getPreferencesFn = httpsCallable<any, GetPreferencesResponse>(
      this.functions,
      'getNotificationPreferences'
    );

    return from(getPreferencesFn({})).pipe(
      map(result => result.data.preferences),
      timeout(this.EMAIL_TIMEOUT),
      retryWhen(errors => 
        errors.pipe(
          concatMap((error, index) => {
            if (index >= this.MAX_RETRIES) {
              return throwError(() => error);
            }
            const delayMs = Math.pow(2, index) * 1000;
            console.warn(`Email service retry ${index + 1}/${this.MAX_RETRIES} in ${delayMs}ms:`, error);
            return timer(delayMs);
          }),
          take(this.MAX_RETRIES)
        )
      ),
      catchError(this.handleError.bind(this))
    );
  }

  /**
   * Toggle email notifications
   * Note: We don't pass userId anymore - Firebase Functions v2 gets it from auth context
   * @param enabled - Whether to enable or disable email notifications
   * @returns Observable<SavePreferencesResponse>
   */
  toggleEmailNotificationsCallable(enabled: boolean): Observable<SavePreferencesResponse> {
    if (typeof enabled !== 'boolean') {
      return throwError(() => new Error('Enabled parameter must be a boolean'));
    }

    const toggleNotificationsFn = httpsCallable<{ enabled: boolean }, SavePreferencesResponse>(
      this.functions,
      'toggleEmailNotifications'
    );

    return from(toggleNotificationsFn({ enabled })).pipe(
      map(result => result.data),
      timeout(this.EMAIL_TIMEOUT),
      retryWhen(errors => 
        errors.pipe(
          concatMap((error, index) => {
            if (index >= this.MAX_RETRIES) {
              return throwError(() => error);
            }
            const delayMs = Math.pow(2, index) * 1000;
            console.warn(`Email service retry ${index + 1}/${this.MAX_RETRIES} in ${delayMs}ms:`, error);
            return timer(delayMs);
          }),
          take(this.MAX_RETRIES)
        )
      ),
      catchError(this.handleError.bind(this))
    );
  }

  /**
 * Send event confirmation email
 * @param email - Recipient email address
 * @param firstName - Recipient's first name
 * @returns Observable<EmailNotificationResponse>
 */
sendEventConfirmation(email: string, firstName: string): Observable<EmailNotificationResponse> {
  // Validate input parameters
  if (!email || !firstName) {
    return throwError(() => new Error('Email and firstName are required'));
  }

  if (!this.isValidEmail(email)) {
    return throwError(() => new Error('Invalid email format'));
  }

  if (firstName.trim().length < 2) {
    return throwError(() => new Error('First name must be at least 2 characters'));
  }

  const sendEventConfirmationFn = httpsCallable<{ email: string, firstName: string }, EmailNotificationResponse>(
    this.functions,
    'sendEventConfirmationEmail'  // ✅ Correct function name
  );

  const requestData = { 
    email: email.trim().toLowerCase(), 
    firstName: this.sanitizeInput(firstName) 
  };

  console.log('🚀 Calling Firebase function with data:', requestData);

  return from(sendEventConfirmationFn(requestData)).pipe(
    map(result => {
      console.log('✅ Firebase function response:', result);
      return result.data;
    }),
    timeout(this.EMAIL_TIMEOUT),
    retryWhen(errors => 
      errors.pipe(
        concatMap((error, index) => {
          if (index >= this.MAX_RETRIES) {
            return throwError(() => error);
          }
          const delayMs = Math.pow(2, index) * 1000;
          console.warn(`Email service retry ${index + 1}/${this.MAX_RETRIES} in ${delayMs}ms:`, error);
          return timer(delayMs);
        }),
        take(this.MAX_RETRIES)
      )
    ),
    catchError(this.handleError.bind(this))
  );
}
  /**
   * Validates email address format
   * @param email - Email to validate
   * @returns boolean indicating if email is valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sanitizes input strings to prevent XSS and injection attacks
   * @param input - String to sanitize
   * @returns Sanitized string
   */
  private sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Enhanced error handling for all service methods
   * @param error - The error to handle
   * @returns Observable that throws a user-friendly error
   */
  private handleError(error: any): Observable<never> {
    console.error('Email notification service error:', error);
    
    // Handle specific error types
    let errorMessage = 'Email service request failed';
    
    if (error.name === 'TimeoutError') {
      errorMessage = 'Email service request timed out. Please try again.';
    } else if (error.code === 'functions/not-found') {
      errorMessage = 'Email service is currently unavailable';
    } else if (error.code === 'functions/permission-denied') {
      errorMessage = 'Permission denied for email service';
    } else if (error.code === 'functions/unauthenticated') {
      errorMessage = 'Authentication required for email service';
    } else if (error.code === 'functions/internal') {
      errorMessage = 'Internal server error. Please try again later.';
    } else if (error.code === 'functions/invalid-argument') {
      errorMessage = 'Invalid request data provided';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Create a standardized error response
    const errorResponse = {
      success: false,
      message: errorMessage,
      error: error.code || error.name || 'unknown_error'
    };
    
    return throwError(() => errorResponse);
  }
}