// src/app/models/user.model.ts
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
