// src/app/models/lender.model.ts
import { BaseUser, UserData } from './user-data.model';

/**
 * Lender interface representing users in the 'lenders' collection
 */
export interface Lender extends BaseUser {
  // Make role optional to match BaseUser
  role?: 'lender';

  // Lender-specific properties
  company?: string;
  accountNumber?: string;

  // Lending preferences
  lenderTypes?: string[];
  propertyCategories?: string[];
  minLoanAmount?: number | string;
  maxLoanAmount?: number | string;

  // Nested objects for organization
  productInfo?: {
    lenderTypes?: string[];
    minLoanAmount?: number | string;
    maxLoanAmount?: number | string;
    propertyCategories?: string[];
    propertyTypes?: string[];
    loanTypes?: string[];
  };

  contactInfo?: {
    firstName?: string;
    lastName?: string;
    contactPhone?: string;
    contactEmail?: string;
    city?: string;
    state?: string;
  };

  footprintInfo?: {
    lendingFootprint?: string[];
    states?: Record<string, any>;
  };
}

/**
 * Type guard for Lender
 */
export function isLender(user: any): user is Lender {
  return user && ('id' in user || 'uid' in user) && user.role === 'lender';
}

/**
 * Create a complete Lender with default values
 */
export function createLender(partial: Partial<Lender>): Lender {
  // Ensure id is set
  const id = partial.id || partial.uid || '';

  // Create complete object with defaults
  return {
    id,
    uid: id,
    role: 'lender',
    firstName: partial.firstName || '',
    lastName: partial.lastName || '',
    email: partial.email || '',
    company: partial.company || '',
    phone: partial.phone || '',
    city: partial.city || '',
    state: partial.state || '',
    accountNumber: partial.accountNumber || '',
    lenderTypes: partial.lenderTypes || [],
    propertyCategories: partial.propertyCategories || [],
    createdAt: partial.createdAt || new Date(),
    updatedAt: partial.updatedAt || new Date(),

    // Initialize nested objects with defaults
    productInfo: partial.productInfo || {
      lenderTypes: [],
      propertyCategories: [],
      propertyTypes: [],
      loanTypes: [],
      minLoanAmount: 0,
      maxLoanAmount: 0,
    },

    contactInfo: partial.contactInfo || {
      firstName: partial.firstName || '',
      lastName: partial.lastName || '',
      contactPhone: partial.phone || '',
      contactEmail: partial.email || '',
      city: partial.city || '',
      state: partial.state || '',
    },

    footprintInfo: partial.footprintInfo || {
      lendingFootprint: [],
      states: {},
    },

    ...partial, // Include any other properties from partial
  };
}

/**
 * Convert any object to Lender type safely
 */
export function toLender(data: any): Lender | null {
  if (!data) return null;

  // If already a Lender, return it
  if (isLender(data)) return data as Lender;

  // Try to convert object to Lender
  try {
    return createLender(data);
  } catch (e) {
    console.error('Failed to convert object to Lender:', e);
    return null;
  }
}

/**
 * Convert UserData to Lender
 */
export function userDataToLender(userData: UserData): Lender {
  return createLender({
    ...userData,
    role: 'lender',
  });
}
