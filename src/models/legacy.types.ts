// src/app/models/legacy-types.ts
// This file contains type definitions for backward compatibility

import { Originator, userDataToOriginator } from './originator.model';
import { Lender, userDataToLender } from './lender.model';
import { UserData } from './user-data.model';

/**
 * @deprecated Use Originator instead
 * Legacy User interface for backward compatibility
 */
export interface LegacyUser {
  // Define as a completely separate interface instead of extending
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
 * Create either Originator or Lender based on role
 */
export function createUserByRole(
  data: Partial<UserData>,
  role: 'originator' | 'lender' = 'originator'
): Originator | Lender {
  if (role === 'lender') {
    return userDataToLender(data as UserData);
  } else {
    return userDataToOriginator(data as UserData);
  }
}

/**
 * Convert legacy UserData to properly typed user
 * This is the main function to fix your TypeScript error
 */
export function convertUserData(userData: UserData): Originator | Lender {
  const role = userData.role || 'originator';

  if (role === 'lender') {
    return userDataToLender(userData);
  } else {
    return userDataToOriginator(userData);
  }
}

/**
 * Convert UserData to User (legacy type)
 * This solves your original TypeScript error
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
    createdAt:
      userData.createdAt instanceof Date
        ? userData.createdAt
        : new Date(userData.createdAt || Date.now()),
  };
}

/**
 * Type guard to check if a value can be converted to User
 */
export function canConvertToUser(value: any): boolean {
  return value && (value.id || value.uid) && typeof value === 'object';
}
