// src/services/notification-preferences.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EmailNotificationService, SavePreferencesResponse } from './email-notification.service';
import { LenderNotificationPreferences } from '../types/notification.types'; 

@Injectable({
  providedIn: 'root'
})
export class NotificationPreferencesService {
  private readonly emailNotificationService = inject(EmailNotificationService);

  getNotificationPreferences(): Observable<any> {
    return this.emailNotificationService.getNotificationPreferencesCallable();
  }

  saveNotificationPreferences(preferences: LenderNotificationPreferences): Observable<SavePreferencesResponse> {
    return this.emailNotificationService.saveNotificationPreferencesCallable(preferences);
  }

  toggleEmailNotifications(enabled: boolean): Observable<SavePreferencesResponse> {
    return this.emailNotificationService.toggleEmailNotificationsCallable(enabled);
  }
}
