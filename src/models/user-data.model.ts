// src/app/models/user-data.model.ts
import { User as FirebaseUser } from '@angular/fire/auth';

// Export Firebase User type for convenience
export type FirebaseAuthUser = FirebaseUser;

/**
 * Base user interface with common properties for all user types
 */
export interface BaseUser {
  // Primary identifiers (both maintained for compatibility)
  id: string;
  uid?: string; // Optional for backward compatibility

  // Basic profile info
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  city?: string;
  state?: string;

  // User type - mandatory for proper type handling
  role?: 'originator' | 'lender';

  // Timestamps
  createdAt?: Date | any;
  updatedAt?: Date | any;

  // Allow additional properties for flexibility
  [key: string]: any;
}

/**
 * Legacy UserData interface for backward compatibility
 * This is the original UserData interface from your application
 */
export interface UserData extends BaseUser {
  // Keep id named consistently
  id: string;

  // Optional role can be originator or lender
  role?: 'originator' | 'lender' | undefined;

  // Other fields from your original UserData interface
  accountNumber?: string;
  lenderId?: string;

  // Support for any other properties
  [key: string]: any;
}

/**
 * Type guard for Firebase User
 */
export function isFirebaseUser(user: any): user is FirebaseUser {
  return (
    user && 'uid' in user && 'emailVerified' in user && 'isAnonymous' in user
  );
}

/**
 * Type guard for UserData
 */
export function isUserData(user: any): user is UserData {
  return user && 'id' in user;
}

/**
 * Helper to ensure ID fields are synchronized
 */
export function synchronizeIds(user: BaseUser): BaseUser {
  if (user.id && !user.uid) {
    user.uid = user.id;
  } else if (user.uid && !user.id) {
    user.id = user.uid;
  }
  return user;
}

/**
 * Get user ID from any user object type
 */
export function getUserId(user: any): string | null {
  if (!user) return null;
  return user.id || user.uid || null;
}
