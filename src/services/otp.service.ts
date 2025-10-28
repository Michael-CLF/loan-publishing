import { Injectable, signal, computed, effect } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Auth, signInWithCustomToken } from '@angular/fire/auth';

/**
 * Response types for OTP operations
 */
export interface SendOTPResponse {
  success: boolean;
  message: string;
  expiresAt?: string;
  error?: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  customToken?: string;
  token?: string;
  isNewUser?: boolean;
  error?: string;
}

/**
 * OTP Service - Frontend
 * 
 * Manages OTP flow with countdown timer
 */
@Injectable({
  providedIn: 'root'
})
export class OTPService {
  // Signals for reactive state
  isLoading = signal<boolean>(false);
  otpSent = signal<boolean>(false);
  error = signal<string>('');

  // Timer signals
  private otpExpiresAt = signal<Date | null>(null);
  private currentTime = signal<Date>(new Date());
  timeRemainingSeconds = signal<number>(0);

  // Attempt tracking
  attemptsRemaining = signal<number>(3);

  // Computed signals
  public isExpired = computed(() => this.timeRemainingSeconds() <= 0);

  private timerInterval: any;

  constructor(
    private functions: Functions,
    private auth: Auth
  ) {
    // Start countdown timer
    this.startGlobalTimer();

    // Calculate time remaining
    effect(() => {
      const expiresAt = this.otpExpiresAt();
      const now = this.currentTime();

      if (expiresAt) {
        const remainingMs = expiresAt.getTime() - now.getTime();
        const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));
        this.timeRemainingSeconds.set(remainingSeconds);
      } else {
        this.timeRemainingSeconds.set(0);
      }
    });
  }

  private startGlobalTimer(): void {
    this.timerInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  formatTimeRemaining(): string {
    const seconds = this.timeRemainingSeconds();
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  sendOTP(email: string): Observable<void> {
    this.isLoading.set(true);
    this.error.set('');

    const sendOTPCallable = httpsCallable(this.functions, 'sendOTP');

    return from(sendOTPCallable({ email })).pipe(
      map((result: any) => {
        console.log('📦 Raw sendOTP result:', result);

        // Firebase callable functions return data in result.data
        const data = result.data as SendOTPResponse;

        console.log('📦 Parsed sendOTP data:', data);

        if (!data.success) {
          throw new Error(data.message || 'Failed to send OTP');
        }

        if (data.expiresAt) {
          const expiresAt = new Date(data.expiresAt);
          this.otpExpiresAt.set(expiresAt);
          console.log('📅 OTP expires at:', expiresAt.toLocaleTimeString());
        }

        this.otpSent.set(true);
        this.attemptsRemaining.set(3);
        this.isLoading.set(false);

        console.log('✅ OTP sent successfully');
      }),
      catchError((error) => {
        console.error('❌ Error sending OTP:', error);
        this.isLoading.set(false);
        this.error.set(error.message || 'Failed to send verification code');
        return throwError(() => error);
      })
    );
  }

  verifyOTP(email: string, code: string): Observable<boolean> {
  this.isLoading.set(true);
  this.error.set('');

  if (this.isExpired()) {
    this.isLoading.set(false);
    const error = new Error('Code has expired. Please request a new one.');
    this.error.set(error.message);
    return throwError(() => error);
  }

  const verifyOTPCallable = httpsCallable(this.functions, 'verifyOTP');

  return from(verifyOTPCallable({ email, code })).pipe(
    switchMap((result: any) => {
      console.log('🔍 Raw verifyOTP result:', result);
      
      // CRITICAL: Access result.data, not result directly!
      const data = result.data as VerifyOTPResponse;
      console.log('📦 Extracted data:', data);
      
      if (!data.success || (!data.customToken && !data.token)) {
        const current = this.attemptsRemaining();
        this.attemptsRemaining.set(Math.max(0, current - 1));
        throw new Error(data.message || 'Invalid verification code');
      }

      console.log('🔐 Signing in with custom token...');
      const token = data.customToken || data.token!;
      return from(signInWithCustomToken(this.auth, token)).pipe(
        map(() => {
          this.isLoading.set(false);
          this.resetOTPState();
          console.log('✅ Successfully signed in');
          return data.isNewUser || false;
        })
      );
    }),
    catchError((error) => {
      console.error('❌ Error verifying OTP:', error);
      this.isLoading.set(false);
      
      let errorMessage = 'Invalid code. Please try again.';
      
      if (error.message.includes('expired')) {
        errorMessage = 'Code has expired. Please request a new one.';
      } else if (error.message.includes('too many attempts')) {
        errorMessage = 'Too many failed attempts. Please request a new code.';
        this.attemptsRemaining.set(0);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      this.error.set(errorMessage);
      return throwError(() => new Error(errorMessage));
    })
  );
}
  resetOTPState(): void {
    this.otpSent.set(false);
    this.otpExpiresAt.set(null);
    this.timeRemainingSeconds.set(0);
    this.attemptsRemaining.set(3);
    this.error.set('');
    this.isLoading.set(false);
  }

  clearError(): void {
    this.error.set('');
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }
}