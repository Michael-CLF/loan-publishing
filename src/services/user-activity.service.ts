// src/app/services/user-activity.service.ts

import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  Firestore,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc
} from '@angular/fire/firestore';
import { User } from '@angular/fire/auth';
import { UserActivity, LoginEvent } from '../interfaces/user-activity.interface';

@Injectable({
  providedIn: 'root'
})
export class UserActivityService {
  private readonly firestore = inject(Firestore);
  private lastLoginTime = 0;
  private readonly DEBOUNCE_TIME = 5000; // 5 seconds to avoid excessive writes

  /**
   * Track user login event
   */
  trackLogin(user: User, method: 'magic-link' | 'google'): Observable<void> {
    if (!user?.uid) {
      console.warn('UserActivityService: No user UID provided');
      return of();
    }

    // Debounce to prevent excessive writes during rapid auth state changes
    const now = Date.now();
    if (now - this.lastLoginTime < this.DEBOUNCE_TIME) {
      console.log('UserActivityService: Login tracking debounced');
      return of();
    }
    this.lastLoginTime = now;

    console.log(`🔐 UserActivityService: Tracking ${method} login for user:`, user.uid);

    return this.updateUserLoginTimestamp(user.uid, method).pipe(
      tap(() => console.log('✅ UserActivityService: Login tracked successfully')),
      catchError(error => {
        console.error('❌ UserActivityService: Error tracking login:', error);
        return of();
      })
    );
  }

  /**
   * Update lastLoginAt timestamp for both lenders and originators
   */
  private updateUserLoginTimestamp(uid: string, method: 'magic-link' | 'google'): Observable<void> {
    return from(this.findAndUpdateUser(uid, method));
  }

  /**
   * Find user in either lenders or originators collection and update
   */
  private async findAndUpdateUser(uid: string, method: 'magic-link' | 'google'): Promise<void> {
    try {
      // Try lenders collection first
      const lenderRef = doc(this.firestore, `lenders/${uid}`);
      const lenderSnap = await getDoc(lenderRef);

      if (lenderSnap.exists()) {
        console.log('📝 UserActivityService: Updating lender login timestamp');
        await updateDoc(lenderRef, {
          lastLoginAt: serverTimestamp(),
          lastLoginMethod: method,
          updatedAt: serverTimestamp()
        });
        return;
      }

      // Try originators collection
      const originatorRef = doc(this.firestore, `originators/${uid}`);
      const originatorSnap = await getDoc(originatorRef);

      if (originatorSnap.exists()) {
        console.log('📝 UserActivityService: Updating originator login timestamp');
        await updateDoc(originatorRef, {
          lastLoginAt: serverTimestamp(),
          lastLoginMethod: method,
          updatedAt: serverTimestamp()
        });
        return;
      }

      console.warn('⚠️ UserActivityService: User not found in either collection:', uid);
    } catch (error) {
      console.error('❌ UserActivityService: Error updating user login:', error);
      throw error;
    }
  }

  /**
   * Get user activity data
   */
  getUserActivity(uid: string): Observable<UserActivity | null> {
    return from(this.fetchUserActivity(uid)).pipe(
      catchError(error => {
        console.error('❌ UserActivityService: Error fetching user activity:', error);
        return of(null);
      })
    );
  }

  /**
   * Fetch user activity from either collection
   */
  private async fetchUserActivity(uid: string): Promise<UserActivity | null> {
    try {
      // Check lenders first
      const lenderRef = doc(this.firestore, `lenders/${uid}`);
      const lenderSnap = await getDoc(lenderRef);

      if (lenderSnap.exists()) {
        const data = lenderSnap.data();
        return this.mapToUserActivity(uid, data);
      }

      // Check originators
      const originatorRef = doc(this.firestore, `originators/${uid}`);
      const originatorSnap = await getDoc(originatorRef);

      if (originatorSnap.exists()) {
        const data = originatorSnap.data();
        return this.mapToUserActivity(uid, data);
      }

      return null;
    } catch (error) {
      console.error('❌ UserActivityService: Error fetching user activity:', error);
      return null;
    }
  }

  /**
   * Map Firestore data to UserActivity interface
   */
  private mapToUserActivity(uid: string, data: any): UserActivity {
    return {
      userId: uid,
      lastLoginAt: data.lastLoginAt ? data.lastLoginAt.toDate() : null,
      loginCount: data.loginCount || 0,
      lastLoginMethod: data.lastLoginMethod || null
    };
  }

  /**
   * Initialize login tracking for new users (sets initial values)
   */
  initializeUserActivity(uid: string, userType: 'lender' | 'originator'): Observable<void> {
    const collectionName = userType === 'lender' ? 'lenders' : 'originators';
    const userRef = doc(this.firestore, `${collectionName}/${uid}`);

    const initialData = {
      lastLoginAt: null,
      lastLoginMethod: null,
      loginCount: 0,
      updatedAt: serverTimestamp()
    };

    return from(updateDoc(userRef, initialData)).pipe(
      tap(() => console.log(`✅ UserActivityService: Initialized activity tracking for ${userType}:`, uid)),
      catchError(error => {
        console.error('❌ UserActivityService: Error initializing user activity:', error);
        return of();
      })
    );
  }

  manualTrackLogin(uid: string, method: 'magic-link' | 'google' = 'google'): Observable<void> {
  console.log('UserActivityService: Manual login tracking triggered');
  return this.updateUserLoginTimestamp(uid, method);
}
}