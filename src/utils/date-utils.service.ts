// src/app/utils/date-utils.service.ts

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DateUtilsService {

  /**
   * Calculate days between two dates
   */
  daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get days since last login with null handling
   */
  getDaysSinceLastLogin(lastLoginAt: Date | null): number | null {
    if (!lastLoginAt) return null;
    return this.daysBetween(lastLoginAt, new Date());
  }

  /**
   * Format "X days ago" text
   */
  formatDaysAgo(days: number | null): string {
    if (days === null) return 'Never';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  }

  /**
   * Get login status based on days since last login
   */
  getLoginStatus(days: number | null): 'never' | 'recent' | 'moderate' | 'old' {
    if (days === null) return 'never';
    if (days <= 7) return 'recent';
    if (days <= 30) return 'moderate';
    return 'old';
  }

  /**
   * Get CSS class for status indicator
   */
  getStatusClass(status: 'never' | 'recent' | 'moderate' | 'old'): string {
    switch (status) {
      case 'recent': return 'status-recent';
      case 'moderate': return 'status-moderate';
      case 'old': return 'status-old';
      case 'never': return 'status-never';
      default: return 'status-never';
    }
  }

  /**
   * Get status color for visual indicators
   */
  getStatusColor(status: 'never' | 'recent' | 'moderate' | 'old'): string {
    switch (status) {
      case 'recent': return '#10b981'; // green
      case 'moderate': return '#f59e0b'; // yellow
      case 'old': return '#ef4444'; // red
      case 'never': return '#6b7280'; // gray
      default: return '#6b7280';
    }
  }

  /**
   * Normalize timestamp from various formats (reused from your admin component)
   */
  normalizeTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();

    // Handle string dates FIRST
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Handle Firestore Timestamp objects  
    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      return timestamp.toDate();
    }

    // Handle timestamp objects with seconds/nanoseconds
    if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
      return new Date(timestamp.seconds * 1000);
    }

    // Handle raw serverTimestamp objects
    if (
      timestamp &&
      typeof timestamp === 'object' &&
      timestamp._methodName === 'serverTimestamp'
    ) {
      return new Date();
    }

    // Handle JavaScript Date objects
    if (timestamp instanceof Date) {
      return timestamp;
    }

    return new Date();
  }
}