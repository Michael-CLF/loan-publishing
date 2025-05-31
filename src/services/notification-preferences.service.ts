import { Injectable, inject } from '@angular/core';
import { httpsCallable } from '@angular/fire/functions';
import { Functions } from '@angular/fire/functions';
import { Observable, from } from 'rxjs';
import { LenderNotificationPreferences } from '../types/notification.types';

@Injectable({
  providedIn: 'root'
})
export class NotificationPreferencesService {
  private functions = inject(Functions);

  saveNotificationPreferences(preferences: LenderNotificationPreferences): Observable<any> {
    const savePreferences = httpsCallable(this.functions, 'saveNotificationPreferences');
    return from(savePreferences({ preferences }));
  }

  getNotificationPreferences(): Observable<any> {
    const getPreferences = httpsCallable(this.functions, 'getNotificationPreferences');
    return from(getPreferences({}));
  }

  toggleEmailNotifications(enabled: boolean): Observable<any> {
    const toggleNotifications = httpsCallable(this.functions, 'toggleEmailNotifications');
    return from(toggleNotifications({ enabled }));
  }
}
