// src/app/models/originator.model.ts
import { BaseUser, UserData } from './user-data.model';

/**
 * Originator interface representing users in the 'users' collection
 * Previously named 'User'
 */
export interface Originator extends BaseUser {
  // Make role optional to match BaseUser
  role?: 'originator';

  // Originator-specific properties
  company?: string;

  // You can add more originator-specific fields here
  // loans?: string[];
  // savedLoans?: string[];
}

/**
 * Type guard for Originator
 */
export function isOriginator(user: any): user is Originator {
  return (
    user &&
    ('id' in user || 'uid' in user) &&
    (!user.role || user.role === 'originator')
  );
}

/**
 * Create a complete Originator with default values
 */
export function createOriginator(partial: Partial<Originator>): Originator {
  // Ensure id is set
  const id = partial.id || partial.uid || '';

  // Create complete object with defaults
  return {
    id,
    uid: id,
    role: 'originator',
    firstName: partial.firstName || '',
    lastName: partial.lastName || '',
    email: partial.email || '',
    company: partial.company || '',
    phone: partial.phone || '',
    city: partial.city || '',
    state: partial.state || '',
    createdAt: partial.createdAt || new Date(),
    updatedAt: partial.updatedAt || new Date(),
    ...partial, // Include any other properties from partial
  };
}

/**
 * Convert any object to Originator type safely
 */
export function toOriginator(data: any): Originator | null {
  if (!data) return null;

  // If already an Originator, return it
  if (isOriginator(data)) return data as Originator;

  // Try to convert object to Originator
  try {
    return createOriginator(data);
  } catch (e) {
    console.error('Failed to convert object to Originator:', e);
    return null;
  }
}

/**
 * Convert UserData to Originator
 */
export function userDataToOriginator(userData: UserData): Originator {
  return createOriginator({
    ...userData,
    role: 'originator',
  });
}
