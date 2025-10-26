/**
 * OTP Service (Angular 18 Frontend)
 * 
 * This service connects your Angular frontend to the Firebase Cloud Functions
 * for OTP authentication.
 * 
 * Angular 18 Best Practices Used:
 * - Signals for reactive state management
 * - inject() function for dependency injection
 * - RxJS operators for async operations
 * - Comprehensive error handling
 * - TypeScript strict mode compatibility
 * - Standalone service (providedIn: 'root')
 */

import { Injectable, signal, computed, inject } from '@angular/core';
import { Auth, signInWithCustomToken } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Router } from '@angular/router';
import { from, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

/**
 * Frontend interfaces matching backend types
 * These should match the types in your Cloud Functions
 */
interface SendOTPRequest {
  email: string;
}

interface SendOTPResponse {
  success: boolean;
  message: string;
  expiresAt: string;
  error?: string;
}

interface VerifyOTPRequest {
  email: string;
  code: string;
}

interface VerifyOTPResponse {
  success: boolean;
  token?: string;
  isNewUser: boolean;
  uid?: string;
  error?: string;
  attemptsRemaining?: number;
}

/**
 * OTP Service
 * 
 * Manages OTP authentication flow with reactive state using Signals.
 * 
 * Usage in components:
 * ```typescript
 * otpService = inject(OTPService);
 * 
 * // Check loading state
 * if (this.otpService.isLoading()) { ... }
 * 
 * // Get error message
 * const error = this.otpService.error();
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class OTPService {
  // Inject dependencies using Angular 18 inject() function
  private auth = inject(Auth);
  private functions = inject(Functions);
  private router = inject(Router);

  // Reactive state using Signals (Angular 18 best practice)
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);
  private otpSentSignal = signal<boolean>(false);
  private otpExpiresAtSignal = signal<Date | null>(null);
  private attemptsRemainingSignal = signal<number>(3);

  // Computed signals - automatically update when dependencies change
  isLoading = computed(() => this.loadingSignal());
  error = computed(() => this.errorSignal());
  otpSent = computed(() => this.otpSentSignal());
  otpExpiresAt = computed(() => this.otpExpiresAtSignal());
  attemptsRemaining = computed(() => this.attemptsRemainingSignal());

  // Computed: Time remaining until OTP expires (in seconds)
  timeRemaining = computed(() => {
    const expiresAt = this.otpExpiresAt();
    if (!expiresAt) return 0;
    
    const now = new Date();
    const diff = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    return Math.max(0, diff);
  });

  /**
   * Sends an OTP code to the specified email address
   * 
   * This calls your sendOTP Cloud Function which:
   * 1. Generates a 6-digit code
   * 2. Stores it in Firestore
   * 3. Emails it to the user
   * 
   * @param email - Email address to send OTP to
   * @returns Observable that completes when OTP is sent
   * 
   * @example
   * ```typescript
   * this.otpService.sendOTP('user@example.com').subscribe({
   *   next: () => console.log('OTP sent!'),
   *   error: (err) => console.error('Failed:', err)
   * });
   * ```
   */
  sendOTP(email: string): Observable<void> {
    console.log('📤 Sending OTP to:', email);

    // Clear previous state
    this.errorSignal.set(null);
    this.loadingSignal.set(true);
    this.otpSentSignal.set(false);

    // Call Cloud Function
    const sendOTPCallable = httpsCallable<SendOTPRequest, SendOTPResponse>(
      this.functions,
      'sendOTP'
    );

    return from(sendOTPCallable({ email })).pipe(
      map(result => result.data),
      tap(response => {
        console.log('📬 SendOTP response:', response);

        if (response.success) {
          // Success - update state
          this.otpSentSignal.set(true);
          this.otpExpiresAtSignal.set(new Date(response.expiresAt));
          this.attemptsRemainingSignal.set(3); // Reset attempts
          console.log('✅ OTP sent successfully');
        } else {
          // Failed - set error
          this.errorSignal.set(response.message || 'Failed to send OTP');
          console.log('❌ SendOTP failed:', response.error);
          throw new Error(response.message);
        }
      }),
      map(() => void 0), // Convert to Observable<void>
      catchError(error => {
        console.error('❌ Error sending OTP:', error);
        const errorMessage = this.extractErrorMessage(error);
        this.errorSignal.set(errorMessage);
        return throwError(() => new Error(errorMessage));
      }),
      tap({
        finalize: () => {
          this.loadingSignal.set(false);
        }
      })
    );
  }

  /**
   * Verifies an OTP code and signs the user in
   * 
   * This calls your verifyOTP Cloud Function which:
   * 1. Validates the code
   * 2. Checks if user exists (preserves UID if they do!)
   * 3. Returns custom token
   * 4. Signs user in with that token
   * 
   * @param email - Email address the OTP was sent to
   * @param code - The 6-digit code the user entered
   * @returns Observable that completes when user is signed in
   * 
   * @example
   * ```typescript
   * this.otpService.verifyOTP('user@example.com', '847392').subscribe({
   *   next: () => this.router.navigate(['/dashboard']),
   *   error: (err) => this.showError(err.message)
   * });
   * ```
   */
  verifyOTP(email: string, code: string): Observable<boolean> {
    console.log('🔐 Verifying OTP for:', email);

    // Clear previous errors
    this.errorSignal.set(null);
    this.loadingSignal.set(true);

    // Call Cloud Function
    const verifyOTPCallable = httpsCallable<VerifyOTPRequest, VerifyOTPResponse>(
      this.functions,
      'verifyOTP'
    );

    return from(verifyOTPCallable({ email, code })).pipe(
      map(result => result.data),
      tap(response => {
        console.log('🔍 VerifyOTP response:', response);

        if (!response.success) {
          // Update attempts remaining if provided
          if (response.attemptsRemaining !== undefined) {
            this.attemptsRemainingSignal.set(response.attemptsRemaining);
          }

          // Set error message
          this.errorSignal.set(response.error || 'Verification failed');
          console.log('❌ VerifyOTP failed:', response.error);
          throw new Error(response.error || 'Verification failed');
        }

        console.log('✅ OTP verified successfully');
        console.log('🔑 Received custom token, signing in...');
      }),
      // Sign in with custom token
      tap(async (response) => {
        if (response.token) {
          try {
            await signInWithCustomToken(this.auth, response.token);
            console.log('✅ Signed in with custom token');
            
            // Store auth state
            localStorage.setItem('isLoggedIn', 'true');
            
            // Log whether this is a new or existing user
            if (response.isNewUser) {
              console.log('🎉 New user signed up:', response.uid);
            } else {
              console.log('👋 Existing user signed in:', response.uid);
            }
          } catch (signInError) {
            console.error('❌ Error signing in with custom token:', signInError);
            this.errorSignal.set('Failed to sign in. Please try again.');
            throw signInError;
          }
        }
      }),
      map(response => response.isNewUser),
      catchError(error => {
        console.error('❌ Error verifying OTP:', error);
        const errorMessage = this.extractErrorMessage(error);
        this.errorSignal.set(errorMessage);
        return throwError(() => new Error(errorMessage));
      }),
      tap({
        finalize: () => {
          this.loadingSignal.set(false);
        }
      })
    );
  }

  /**
   * Clears error state
   * 
   * Useful when user dismisses error message or tries again
   */
  clearError(): void {
    this.errorSignal.set(null);
  }

  /**
   * Resets all OTP state
   * 
   * Call this when user wants to restart the OTP flow
   * (e.g., clicks "Use different email")
   */
  resetOTPState(): void {
    this.errorSignal.set(null);
    this.loadingSignal.set(false);
    this.otpSentSignal.set(false);
    this.otpExpiresAtSignal.set(null);
    this.attemptsRemainingSignal.set(3);
    console.log('🔄 OTP state reset');
  }

  /**
   * Extracts user-friendly error message from error object
   * 
   * Handles different error formats from Firebase Functions
   */
  private extractErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error?.message) {
      // Remove "Firebase: " prefix if present
      return error.message.replace(/^Firebase:\s*/i, '');
    }

    if (error?.error?.message) {
      return error.error.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Helper method to format time remaining as MM:SS
   * 
   * Useful for displaying countdown timer in UI
   * 
   * @returns Formatted time string (e.g., "09:45")
   * 
   * @example
   * ```html
   * <p>Code expires in: {{ otpService.formatTimeRemaining() }}</p>
   * ```
   */
  formatTimeRemaining(): string {
    const seconds = this.timeRemaining();
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Checks if OTP has expired
   * 
   * @returns true if OTP has expired, false otherwise
   */
  isOTPExpired(): boolean {
    return this.timeRemaining() === 0 && this.otpSent();
  }
}