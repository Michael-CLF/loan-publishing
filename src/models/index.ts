// src/app/models/index.ts
import { UserData } from './user-data.model';
export * from './user-data.model';
export * from './originator.model';
export * from './lender.model';
export * from './deprecated.model';

// Explicitly convert user data to a generic object
export function userDataToUser(userData: UserData): any {
  return userData ? { ...userData } : {};
}

// If there are naming conflicts, you can use a type alias
export type { UserData } from './user-data.model';

// Other models can be exported here
// export * from './loan-model.model';
// export * from './footprint-location.model';
// etc.
