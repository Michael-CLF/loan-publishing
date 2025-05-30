// src/services/notification.types.ts

export interface LenderNotificationPreferences {
  wantsEmailNotifications: boolean;
  preferredPropertyTypes: string[];   // ✅ Correct name
  preferredLoanTypes: string[];       // ✅ Correct name
  subcategorySelections: string[];    // ✅ Correct new field
  minLoanAmount: number;
  footprint: string[];                // ✅ Correct name
}

export const DEFAULT_LENDER_NOTIFICATION_PREFERENCES: LenderNotificationPreferences = {
  wantsEmailNotifications: false,
  preferredPropertyTypes: [],
  preferredLoanTypes: [],
  subcategorySelections: [],
  minLoanAmount: 0,
  footprint: []
};
