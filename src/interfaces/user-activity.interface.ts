// src/app/interfaces/user-activity.interface.ts

export interface LoginEvent {
  timestamp: Date;
  method: 'magic-link' | 'google';
  userAgent?: string;
  ip?: string;
}

export interface UserActivity {
  userId: string;
  lastLoginAt: Date | null;
  loginCount: number;
  lastLoginMethod: 'magic-link' | 'google' | null;
}

export interface UserWithActivity {
  id: string;
  accountNumber?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  company?: string;
  city?: string;
  state?: string;
  phone?: string;
  role: 'lender' | 'originator';
  createdAt: Date;
  lastLoginAt: Date | null;
  daysSinceLastLogin: number | null;
  loginStatus: 'never' | 'recent' | 'moderate' | 'old';
  
  // Lender-specific properties
  lenderTypes?: any[];
  productInfo?: any;
  contactInfo?: any;
  _rawData?: any;
}