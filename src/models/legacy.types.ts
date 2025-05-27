// src/app/models/legacy-types.ts

import { Originator, userDataToOriginator } from './originator.model';
import { Lender, userDataToLender } from './lender.model';
import { UserData } from './user-data.model';
import { Timestamp } from '@angular/fire/firestore';

/**
 * @deprecated Use Originator instead.
 * Legacy User interface for backward compatibility.
 */
export interface LegacyUser {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  city: string;
  state: string;
  role?: 'originator' | 'lender';
  createdAt: Date;
}

/**
 * Create either Originator or Lender based on role.
 */
export function createUserByRole(
  data: Partial<UserData>,
  role: 'originator' | 'lender' = 'originator'
): Originator | Lender {
  return role === 'lender'
    ? userDataToLender(data as UserData)
    : userDataToOriginator(data as UserData);
}

/**
 * Convert legacy UserData to properly typed user.
 */
export function convertUserData(userData: UserData): Originator | Lender {
  const role = userData.role || 'originator';
  return role === 'lender'
    ? userDataToLender(userData)
    : userDataToOriginator(userData);
}

/**
 * Normalize any possible timestamp format to a valid Date.
 */
function normalizeCreatedAt(value: any): Date {
  if (value instanceof Date) {
    return value;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (typeof value === 'object' && typeof value?.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  return new Date();
}

/**
 * Convert UserData to LegacyUser.
 */
export function userDataToUser(userData: UserData): LegacyUser {
  return {
    uid: userData.id || userData.uid || '',
    firstName: userData.firstName || '',
    lastName: userData.lastName || '',
    email: userData.email || '',
    company: userData.company || '',
    phone: userData.phone || '',
    city: userData.city || '',
    state: userData.state || '',
    role: userData.role,
    createdAt: normalizeCreatedAt(userData.createdAt),
  };
}

/**
 * Type guard to check if a value can be converted to User.
 */
export function canConvertToUser(value: any): boolean {
  return value && typeof value === 'object' && (value.id || value.uid);
}
