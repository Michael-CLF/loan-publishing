// src/app/models/loan-model.model.ts

import { Timestamp } from "firebase/firestore";

// NEW: Define the subcategory structure that you're actually receiving
export interface PropertySubcategory {
  value: string;
  name: string;
}

// NEW: Union type for handling both string and object subcategories
export type PropertySubcategoryValue = string | PropertySubcategory;

export interface Loan {
  id?: string;
  propertyTypeCategory: string;
  userId?: string;
  
  // FIXED: Updated to handle both string and object types
  propertySubCategory: PropertySubcategoryValue;
  
  transactionType: string;
  loanAmount: string;
  loanType: string;
  propertyValue: string;
  ltv: number;
  noi?: string;
  city: string;
  state: string;
  numberOfSponsors: number;
  sponsorsLiquidity: string;
  sponsorFico: number;
  experienceInYears: number;
  contact: string;
  company?: string;
  phone: string;
  email: string;
  notes?: string;
  originatorId?: string;
  createdBy?: string;
  createdAt?: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  isFavorite?: boolean;
}

// NEW: Utility functions following Angular 18 best practices
export namespace LoanUtils {
  /**
   * Safely extracts the subcategory value whether it's a string or object
   * Following Angular 18 functional programming patterns
   */
  export function getSubcategoryValue(subcategory: PropertySubcategoryValue): string {
    if (!subcategory) return '';
    
    if (typeof subcategory === 'string') {
      return subcategory;
    }
    
    if (typeof subcategory === 'object' && 'value' in subcategory) {
      return subcategory.value || '';
    }
    
    return '';
  }

  /**
   * Safely extracts the subcategory display name
   * Falls back to formatted value if name not available
   */
  export function getSubcategoryDisplayName(subcategory: PropertySubcategoryValue): string {
    if (!subcategory) return 'None';
    
    if (typeof subcategory === 'string') {
      // Import and use your existing mapping function
      return subcategory; // You can enhance this later with getPropertySubcategoryName(subcategory)
    }
    
    if (typeof subcategory === 'object' && 'name' in subcategory) {
      return subcategory.name || subcategory.value || 'None';
    }
    
    return 'None';
  }

  /**
   * Type guard to check if subcategory is an object
   * Following Angular 18 type safety patterns
   */
  export function isSubcategoryObject(subcategory: PropertySubcategoryValue): subcategory is PropertySubcategory {
    return typeof subcategory === 'object' && subcategory !== null && 'value' in subcategory;
  }

  /**
   * Formats loan amount for display
   * Following Angular best practices for data formatting
   */
  export function formatLoanAmount(amount: string | number): string {
    if (!amount) return '$0';
    
    const numAmount = typeof amount === 'string' 
      ? parseFloat(amount.replace(/[^0-9.]/g, '')) || 0
      : amount;
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
  }
}