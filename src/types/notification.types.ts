// src/services/notification.types.ts
export interface LenderNotificationPreferences {
  wantsEmailNotifications: boolean;
  propertyCategories: string[];        // ✅ FIXED
  loanTypes: string[];                 // ✅ FIXED
  subcategorySelections: string[];     // ✅ Already correct
  minLoanAmount: number;
  ficoScore: number;                   // ✅ New field added
  footprint: string[];
}

export const DEFAULT_LENDER_NOTIFICATION_PREFERENCES: LenderNotificationPreferences = {
  wantsEmailNotifications: false,
  propertyCategories: [],      // ✅ FIXED
  loanTypes: [],               // ✅ FIXED
  subcategorySelections: [],
  minLoanAmount: 0,
  ficoScore: 0,                // ✅ New field added
  footprint: []
};
