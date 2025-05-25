import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EmailNotificationService, NotificationPreferences, SavePreferencesResponse } from './email-notification.service';

// Default preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  wantsEmailNotifications: false,
  preferredPropertyTypes: [],
  preferredLoanTypes: [],
  minLoanAmount: 0,
  footprint: []
};

@Injectable({
  providedIn: 'root'
})
export class NotificationPreferencesService {
  private readonly emailNotificationService = inject(EmailNotificationService);

  /**
   * Get notification preferences for the current user
   * Note: No need to pass lenderId - Firebase gets it from auth context
   */
  getNotificationPreferences(): Observable<NotificationPreferences> {
    return this.emailNotificationService.getNotificationPreferences();
  }

  /**
   * Save notification preferences for the current user
   * Note: No need to pass lenderId - Firebase gets it from auth context
   */
  saveNotificationPreferences(preferences: NotificationPreferences): Observable<SavePreferencesResponse> {
    return this.emailNotificationService.saveNotificationPreferences(preferences);
  }

  /**
   * Toggle email notifications on/off for the current user
   * Note: No need to pass lenderId - Firebase gets it from auth context
   */
  toggleEmailNotifications(enabled: boolean): Observable<SavePreferencesResponse> {
    return this.emailNotificationService.toggleEmailNotifications(enabled);
  }
}