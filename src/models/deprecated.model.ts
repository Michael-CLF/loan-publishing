// src/app/models/deprecated.model.ts

import { Originator } from './originator.model';
import { Lender } from './lender.model';
import { UserData as CurrentUserData } from './user-data.model';

// Deprecated - use Originator or Lender instead
// This file ensures backward compatibility with existing code
export interface User extends Originator {
  // This was the original User interface
  // Now redirects to Originator
}

// Deprecated - use Lender instead
export interface UserData extends Lender {
  // This was the original UserData interface
  // Now redirects to Lender
}
/**
 * Converts user data to a generic object while preserving type safety
 * @param userData The current user data to convert
 * @returns A simplified user object for backwards compatibility
 */
export function userDataToUser(
  userData: CurrentUserData
): Partial<CurrentUserData> {
  if (!userData) return {};

  // Explicitly pick the most important fields
  const { id, uid, email, firstName, lastName, role } = userData;

  return {
    id,
    uid,
    email,
    firstName,
    lastName,
    role,
  };
}
