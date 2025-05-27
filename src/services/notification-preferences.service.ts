import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EmailNotificationService, SavePreferencesResponse } from './email-notification.service';
import { httpsCallable, Functions } from '@angular/fire/functions';
import { NotificationPreferences } from '../types/notification.types';

@Injectable({
  providedIn: 'root'
})
export class NotificationPreferencesService {
  private readonly emailNotificationService = inject(EmailNotificationService);

  /**
   * Get notification preferences for the current user
   * Note: No need to pass lenderId - Firebase gets it from auth context
   */
  getNotificationPreferences(): Observable<any> {
    return this.emailNotificationService.getNotificationPreferencesCallable();
  }

  /**
   * Save notification preferences for the current user
   * Note: No need to pass lenderId - Firebase gets it from auth context
   */
  saveNotificationPreferences(preferences: NotificationPreferences): Observable<SavePreferencesResponse> {
    return this.emailNotificationService.saveNotificationPreferencesCallable(preferences);
  }

  /**
   * Toggle email notifications on/off for the current user
   * Note: No need to pass lenderId - Firebase gets it from auth context
   */
  toggleEmailNotifications(enabled: boolean): Observable<SavePreferencesResponse> {
    return this.emailNotificationService.toggleEmailNotificationsCallable(enabled);
  }
}