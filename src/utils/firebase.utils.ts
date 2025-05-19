// src/utils/firebase.utils.ts
import { Timestamp, FieldValue, serverTimestamp } from '@angular/fire/firestore';

/**
 * Creates a Firestore Timestamp from current date
 */
export function createTimestamp(): Timestamp {
  return Timestamp.fromDate(new Date());
}

/**
 * Creates a server timestamp for write operations
 */
export function createServerTimestamp(): FieldValue {
  return serverTimestamp();
}

/**
 * Safely converts any date-like value to a Firestore Timestamp
 */
export function toFirestoreTimestamp(value?: Date | Timestamp | FieldValue | null): Timestamp | FieldValue | null {
  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }
  return value || null;
}