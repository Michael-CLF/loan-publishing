// logging.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { from, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface AuthLog {
  timestamp: any;
  userId?: string | null;
  email?: string;
  event: AuthEventType;
  success: boolean;
  metadata?: any;
  errorMessage?: string;
  userAgent?: string;
  ipAddress?: string;
}

export enum AuthEventType {
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  MAGIC_LINK_SENT = 'MAGIC_LINK_SENT',
  MAGIC_LINK_CLICKED = 'MAGIC_LINK_CLICKED',
  MAGIC_LINK_VERIFIED = 'MAGIC_LINK_VERIFIED',
  MAGIC_LINK_FAILED = 'MAGIC_LINK_FAILED',
  REGISTRATION_STARTED = 'REGISTRATION_STARTED',
  REGISTRATION_COMPLETED = 'REGISTRATION_COMPLETED',
  REGISTRATION_FAILED = 'REGISTRATION_FAILED',
  LOGOUT = 'LOGOUT',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  DUPLICATE_EMAIL_ATTEMPT = 'DUPLICATE_EMAIL_ATTEMPT'
}

@Injectable({
  providedIn: 'root'
})
export class LoggingService {
  private firestore = inject(Firestore);
  private functions = inject(Functions);
  
  // Store logs locally in case of network issues
  private localLogQueue: AuthLog[] = [];
  private maxLocalLogs = 50;

  constructor() {
    // Try to send any queued logs when service initializes
    this.flushLocalLogs();
    
    // Set up periodic flush of local logs
    setInterval(() => this.flushLocalLogs(), 60000); // Every minute
  }

  /**
   * Log an authentication event
   * This is the main method you'll use throughout your app
   */
  logAuthEvent(
    event: AuthEventType,
    details: {
      userId?: string | null;
      email?: string;
      success?: boolean;
      metadata?: any;
      error?: any;
    }
  ): Observable<void> {
    const log: AuthLog = {
      timestamp: serverTimestamp(),
      event,
      userId: details.userId || null,
      email: details.email?.toLowerCase().trim(),
      success: details.success ?? true,
      metadata: details.metadata || {},
      errorMessage: details.error?.message || details.error?.code,
      userAgent: navigator.userAgent,
      // IP will be added server-side for security
    };

    // Log to console in development
    if (!environment.production) {
      console.log(`[AUTH LOG] ${event}:`, log);
    }

    // Try to send to Firestore
    return this.sendLogToFirestore(log).pipe(
      catchError(error => {
        // If sending fails, store locally
        this.storeLogLocally(log);
        console.error('Failed to send log, stored locally:', error);
        return of(void 0);
      })
    );
  }

  /**
   * Send log to Firestore
   */
  private sendLogToFirestore(log: AuthLog): Observable<void> {
    const logsCollection = collection(this.firestore, 'authLogs');
    return from(addDoc(logsCollection, log)).pipe(
      map(() => void 0)
    );
  }

  /**
   * Store log locally when network fails
   */
  private storeLogLocally(log: AuthLog): void {
    this.localLogQueue.push({
      ...log,
      timestamp: new Date().toISOString() // Convert to string for storage
    });

    // Limit queue size
    if (this.localLogQueue.length > this.maxLocalLogs) {
      this.localLogQueue = this.localLogQueue.slice(-this.maxLocalLogs);
    }

    // Store in localStorage as backup
    try {
      localStorage.setItem('authLogQueue', JSON.stringify(this.localLogQueue));
    } catch (e) {
      console.error('Failed to store logs locally:', e);
    }
  }

  /**
   * Try to send any locally stored logs
   */
  private flushLocalLogs(): void {
    // Load from localStorage if needed
    try {
      const stored = localStorage.getItem('authLogQueue');
      if (stored) {
        const parsedLogs = JSON.parse(stored);
        this.localLogQueue = [...parsedLogs, ...this.localLogQueue];
        localStorage.removeItem('authLogQueue');
      }
    } catch (e) {
      console.error('Failed to load stored logs:', e);
    }

    if (this.localLogQueue.length === 0) return;

    // Try to send each log
    const logsToSend = [...this.localLogQueue];
    this.localLogQueue = [];

    logsToSend.forEach(log => {
      this.sendLogToFirestore(log).subscribe({
        next: () => console.log('Successfully sent queued log'),
        error: (error) => {
          // Re-queue if still failing
          this.storeLogLocally(log);
        }
      });
    });
  }

  /**
   * Get login history for a specific user
   * Useful for debugging and user support
   */
  getLoginHistory(userId: string): Observable<AuthLog[]> {
    const getHistory = httpsCallable<{userId: string}, {logs: AuthLog[]}>(
      this.functions, 
      'getAuthLogs'
    );
    
    return from(getHistory({ userId })).pipe(
      map(result => result.data.logs),
      catchError(error => {
        console.error('Failed to fetch login history:', error);
        return of([]);
      })
    );
  }

  /**
   * Specific logging methods for common scenarios
   */
  logLoginAttempt(email: string, method: 'magic-link' | 'google' | 'password'): Observable<void> {
    return this.logAuthEvent(AuthEventType.LOGIN_ATTEMPT, {
      email,
      metadata: { method }
    });
  }

  logLoginSuccess(userId: string, email: string, method: string): Observable<void> {
    return this.logAuthEvent(AuthEventType.LOGIN_SUCCESS, {
      userId,
      email,
      success: true,
      metadata: { method }
    });
  }

  logLoginFailed(email: string, error: any, method: string): Observable<void> {
    return this.logAuthEvent(AuthEventType.LOGIN_FAILED, {
      email,
      success: false,
      error,
      metadata: { method }
    });
  }

  logMagicLinkSent(email: string): Observable<void> {
    return this.logAuthEvent(AuthEventType.MAGIC_LINK_SENT, {
      email,
      success: true
    });
  }

  logMagicLinkClicked(email: string): Observable<void> {
    return this.logAuthEvent(AuthEventType.MAGIC_LINK_CLICKED, {
      email
    });
  }

  logDuplicateEmailAttempt(email: string, existingUserId?: string): Observable<void> {
    return this.logAuthEvent(AuthEventType.DUPLICATE_EMAIL_ATTEMPT, {
      email,
      success: false,
      metadata: { existingUserId }
    });
  }

  logLogout(userId: string, email?: string): Observable<void> {
    return this.logAuthEvent(AuthEventType.LOGOUT, {
      userId,
      email,
      success: true
    });
  }
}

// Environment file addition (add to your environment.ts files)
const environment = {
  production: false,
  // ... other config
};