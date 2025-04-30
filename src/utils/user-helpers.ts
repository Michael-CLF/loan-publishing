// src/app/utils/user-helpers.ts
import { User as FirebaseUser } from '@angular/fire/auth';
import { UserData, Originator, Lender } from '../models';

/**
 * Extract user ID from different user type objects
 */
export function getUserId(user: any): string | null {
  if (!user) return null;

  // Check if it's a Firebase user
  if (user.uid && typeof user.emailVerified !== 'undefined') {
    return user.uid;
  }

  // Check for regular user objects
  return user.id || user.uid || null;
}

/**
 * Get user display name from different user objects
 */
export function getUserDisplayName(user: any): string {
  if (!user) return 'Guest';

  // Firebase user format
  if (user.displayName) {
    return user.displayName;
  }

  // Our custom user formats
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }

  // Contact info nested format (for lenders)
  if (
    user.contactInfo &&
    (user.contactInfo.firstName || user.contactInfo.lastName)
  ) {
    return `${user.contactInfo.firstName || ''} ${
      user.contactInfo.lastName || ''
    }`.trim();
  }

  // Email fallback
  if (user.email) {
    return user.email;
  }

  return 'User';
}

/**
 * Get user email from different user objects
 */
export function getUserEmail(user: any): string | null {
  if (!user) return null;

  // Direct email property
  if (user.email) {
    return user.email;
  }

  // Contact info nested format (for lenders)
  if (user.contactInfo && user.contactInfo.contactEmail) {
    return user.contactInfo.contactEmail;
  }

  return null;
}

/**
 * Determine if user has lender role
 */
export function isUserLender(user: any): boolean {
  if (!user) return false;

  // Check role property
  if (user.role) {
    return user.role === 'lender';
  }

  // Check for lender-specific properties
  return !!(
    user.lenderTypes ||
    (user.productInfo && user.productInfo.lenderTypes) ||
    user.footprintInfo
  );
}

/**
 * Determine if user has originator role
 */
export function isUserOriginator(user: any): boolean {
  if (!user) return false;

  // Check role property
  if (user.role) {
    return user.role === 'originator';
  }

  // If it's not a lender and has basic user properties, assume originator
  if (!isUserLender(user) && (user.id || user.uid)) {
    return true;
  }

  return false;
}

/**
 * Get user's company name
 */
export function getUserCompany(user: any): string | null {
  if (!user) return null;

  // Direct company property
  if (user.company) {
    return user.company;
  }

  // Contact info nested format (for lenders)
  if (user.contactInfo && user.contactInfo.company) {
    return user.contactInfo.company;
  }

  return null;
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone?: string): string {
  if (!phone) return '';

  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);

  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
}
