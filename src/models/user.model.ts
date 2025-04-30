// src/app/models/user.model.ts
import { User as FirebaseUser } from '@angular/fire/auth';

// Interface for Firebase User
export type FirebaseUserType = FirebaseUser;

// Interface with custom user data
export interface UserData {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  city?: string;
  state?: string;
  role?: 'originator' | 'lender' | undefined;
  createdAt?: any;
  accountNumber?: string;
  lenderId?: string;
  [key: string]: any;
}

// Complete User interface with all fields
export interface User {
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

// Common Identity interface with shared properties
export interface UserIdentity {
  id: string;
  email?: string | null;
  displayName?: string | null;
}

// Type guards to safely check user types
export function isFirebaseUser(user: any): user is FirebaseUser {
  return (
    user && 'uid' in user && 'emailVerified' in user && 'isAnonymous' in user
  );
}

export function isUserData(user: any): user is UserData {
  return (
    user &&
    'id' in user &&
    !('emailVerified' in user) &&
    !('isAnonymous' in user)
  );
}

export function isUser(user: any): user is User {
  return (
    user &&
    'uid' in user &&
    'firstName' in user &&
    'lastName' in user &&
    !('emailVerified' in user)
  );
}
