// src/app/models/user.model.ts
import { User as FirebaseUser } from '@angular/fire/auth';

// Interface for Firebase User
export type FirebaseUserType = FirebaseUser;

// Interface with custom user data from Firestore
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
  [key: string]: any; // Allow for additional properties
}

// Complete User interface with required fields for application use
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

/**
 * Type guard to check if an object is a Firebase User
 * @param user The user object to check
 * @returns True if the object is a Firebase User
 */
export function isFirebaseUser(user: any): user is FirebaseUser {
  return (
    user && 'uid' in user && 'emailVerified' in user && 'isAnonymous' in user
  );
}

/**
 * Type guard to check if an object is custom UserData
 * @param user The user object to check
 * @returns True if the object is UserData
 */
export function isUserData(user: any): user is UserData {
  return (
    user &&
    'id' in user &&
    !('emailVerified' in user) &&
    !('isAnonymous' in user)
  );
}

/**
 * Type guard to check if an object is a complete User
 * @param user The user object to check
 * @returns True if the object is a complete User
 */
export function isUser(user: any): user is User {
  return (
    user &&
    'uid' in user &&
    'firstName' in user &&
    'lastName' in user &&
    !('emailVerified' in user)
  );
}

/**
 * Converts Firestore data to a proper User object
 * @param firestoreData Raw data from Firestore
 * @param docId Document ID to use as UID
 * @returns A User object with all required fields
 */
export function createUserFromFirestore(
  firestoreData: any,
  docId: string
): User {
  return {
    uid: docId,
    firstName: firestoreData.firstName || '',
    lastName: firestoreData.lastName || '',
    email: firestoreData.email || '',
    company: firestoreData.company || '',
    phone: firestoreData.phone || '',
    city: firestoreData.city || '',
    state: firestoreData.state || '',
    role: firestoreData.role || 'originator',
    createdAt: firestoreData.createdAt?.toDate() || new Date(),
  };
}
