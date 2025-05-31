// src/app/models/lender-form.model.ts

import { Time } from '@angular/common';
import { Lender } from './lender.model';
import { Timestamp, serverTimestamp } from '@angular/fire/firestore';


// Form state tracking interface
export interface LenderFormState {
  currentStep: number;
  contactDataSaved: boolean;
  userId: string | null;
  lastSaved?: Date;
}

// Form validation state interface
export interface LenderFormValidation {
  contactValid: boolean;
  productValid: boolean;
  footprintValid: boolean;
  termsAccepted: boolean;
}

// Extended lender type for form data during submission
export interface LenderFormData
  extends Omit<Lender, 'id' | 'createdAt' | 'updatedAt'> {
  termsAccepted: boolean;
}

// Document structure interfaces for Firebase
export interface LenderProfileDocument {
  contactInfo: Lender['contactInfo'];
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LenderProductDocument {
  lenderProfileId: string;
  lenderTypes: string[];
  propertyCategories: string[];
  subcategorySelections: string[];
  loanTypes: string[];
  ficoScore: number;
  minLoanAmount: number | string;
  maxLoanAmount: number | string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LenderLocationDocument {
  lenderProfileId: string;
  lendingFootprint: string[];
  states: Record<string, boolean | Record<string, boolean>>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Helper type for form value extraction
export type FormArrayValueType = string | { value: string; name: string } | any;

// Type guard functions
export function isStringValue(value: FormArrayValueType): value is string {
  return typeof value === 'string';
}

export function isObjectWithValue(
  value: FormArrayValueType
): value is { value: string; name: string } {
  return value !== null && typeof value === 'object' && 'value' in value;
}

// Helper functions for data conversion
export function extractFormArrayValues(
  formArrayData: FormArrayValueType[]
): string[] {
  if (!formArrayData || !Array.isArray(formArrayData)) return [];

  return formArrayData.map((item) => {
    if (isStringValue(item)) return item;
    if (isObjectWithValue(item)) return item.value;
    return String(item); // Fallback
  });
}

export function parseNumericValue(value: any): number {
  if (value === undefined || value === null) return 0;

  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numericString = value.replace(/[^0-9.]/g, '');
    const parsedValue = parseFloat(numericString);
    return isNaN(parsedValue) ? 0 : parsedValue;
  }

  return 0;
}
