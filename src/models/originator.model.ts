// src/app/models/originator.model.ts
import { BaseUser, UserData } from './user-data.model';

/**
 * Originator interface representing users in the 'users' collection
 * Previously named 'User'
 */
export interface Originator extends BaseUser {
  // Make role optional to match BaseUser
  role?: 'originator';
   company?: string;

contactInfo?: {
  firstName?: string;
  lastName?: string;
  company?: string;
  contactEmail?: string;
   contactPhone?: string
  city?: string; 
  state?: string;
  createdAt?: any;
  updatedAt?: any;
};

  };

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
export interface Originator extends BaseUser {
  // Make role optional to match BaseUser
  role?: 'originator';
  company?: string;

  contactInfo?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    contactEmail?: string;
    contactPhone?: string;
    city?: string; 
    state?: string;
    createdAt?: any;  // Add these consistent timestamp fields
    updatedAt?: any;  // matching the lender structure
  };
}

// Update createOriginator function to ensure timestamps are properly handled
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
    createdAt: partial.createdAt || new Date(), // Ensure timestamp field
    updatedAt: partial.updatedAt || new Date(), // Ensure timestamp field
    
    // Add contactInfo structure to ensure compatibility with lender structure
    contactInfo: partial.contactInfo || {
      firstName: partial.firstName || '',
      lastName: partial.lastName || '',
      contactEmail: partial.email || '',
      contactPhone: partial.phone || '',
      company: partial.company || '',
      city: partial.city || '',
      state: partial.state || '',
    },
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
