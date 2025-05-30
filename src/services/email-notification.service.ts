import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { LenderNotificationPreferences } from '../types/notification.types';

export interface EmailNotificationResponse {
  success: boolean;
  message: string;
  emailsSent?: number;
}

export interface SavePreferencesResponse {
  success: boolean;
  message: string;
  preferences: LenderNotificationPreferences;
}

export interface GetPreferencesResponse {
  preferences: LenderNotificationPreferences;
}

@Injectable({
  providedIn: 'root'
})
export class EmailNotificationService {
  private readonly functions = inject(Functions);

  /**
   * Send test email
   */
  sendTestEmail(email: string): Observable<EmailNotificationResponse> {
    const sendTestEmailFn = httpsCallable<{ email: string }, EmailNotificationResponse>(
      this.functions,
      'sendTestEmail'
    );

    return from(sendTestEmailFn({ email })).pipe(
      map(result => result.data)
    );
  }

  /**
   * Send loan notifications to matching lenders
   */
  sendLoanNotifications(loanId: string): Observable<EmailNotificationResponse> {
    const sendLoanNotificationsFn = httpsCallable<{ loanId: string }, EmailNotificationResponse>(
      this.functions,
      'sendLoanNotifications'
    );

    return from(sendLoanNotificationsFn({ loanId })).pipe(
      map(result => result.data)
    );
  }

  /**
   * Save notification preferences
   * Note: We don't pass userId anymore - Firebase Functions v2 gets it from auth context
   */
  saveNotificationPreferencesCallable(preferences: LenderNotificationPreferences): Observable<SavePreferencesResponse> {
    const savePreferencesFn = httpsCallable<{ preferences: LenderNotificationPreferences }, SavePreferencesResponse>(
      this.functions,
      'saveNotificationPreferences'
    );

    return from(savePreferencesFn({ preferences })).pipe(
      map(result => result.data)
    );
  }

  /**
   * Get notification preferences
   * Note: We don't pass userId anymore - Firebase Functions v2 gets it from auth context
   */
  getNotificationPreferencesCallable(): Observable<LenderNotificationPreferences> {
    const getPreferencesFn = httpsCallable<any, GetPreferencesResponse>(
      this.functions,
      'getNotificationPreferences'
    );

    return from(getPreferencesFn({})).pipe(
      map(result => result.data.preferences)
    );
  }

  /**
   * Toggle email notifications
   * Note: We don't pass userId anymore - Firebase Functions v2 gets it from auth context
   */
  toggleEmailNotificationsCallable(enabled: boolean): Observable<SavePreferencesResponse> {
    const toggleNotificationsFn = httpsCallable<{ enabled: boolean }, SavePreferencesResponse>(
      this.functions,
      'toggleEmailNotifications'
    );

    return from(toggleNotificationsFn({ enabled })).pipe(
      map(result => result.data)
    );
  }
}