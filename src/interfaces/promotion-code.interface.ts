// src/app/interfaces/promotion-code.interface.ts

/**
 * Frontend promotion code validation request
 */
export interface PromotionValidationRequest {
  code: string;
  role: 'originator' | 'lender';
  interval: 'monthly' | 'annually';
    durationType?: 'once' | 'repeating' | 'forever';
  durationInMonths?: number;
}

export interface PromotionValidationResponse {
  valid: boolean;
  promo?: {
    code: string;
    promoType: 'percentage' | 'trial' | 'none';
    percentOff: number | null;
    durationInMonths: number | null;
    durationType: 'repeating' | 'forever' | null;
    trialDays: number | null;
    onboardingFeeCents: number | null;
    promoExpiresAt: number | null;
    allowedIntervals: ('monthly' | 'annually')[];
    allowedRoles: ('lender' | 'originator')[];
    promoInternalId: string | null;
  } | null;
  error?: string | null;
}


/**
 * Applied coupon details for UI display
 */
export interface AppliedCouponDetails {
  code: string;
  displayCode?: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
  description?: string;
}

/**
 * Admin interface - Promotion code data structure
 */
export interface PromotionCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'free';
  value: number;
  validFor: ('originator' | 'lender')[];
  validIntervals: ('monthly' | 'annually')[];
  active: boolean;
  expiresAt?: Date;
  maxUses?: number;
  currentUses: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  durationType?: 'once' | 'repeating' | 'forever';
  durationInMonths?: number;
  durationInDays?: number;
}
export interface PromotionListResponse {
  codes: PromotionCode[];
  success?: boolean;
  error?: string;
  total?: string;
}

/**
 * Admin interface - Create new promotion code
 */
export interface CreatePromotionRequest {
  code: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed' | 'free';
  value: number;
  validFor: ('originator' | 'lender')[];
  validIntervals: ('monthly' | 'annually')[];
  expiresAt?: Date;
  maxUses?: number;
  durationType?: 'once' | 'repeating' | 'forever';  
  durationInMonths?: number;
  durationInDays?: number;
}

/**
 * Admin interface - Update existing promotion code
 */
export interface UpdatePromotionRequest extends Partial<CreatePromotionRequest> {
  active?: boolean;
  durationType?: 'once' | 'repeating' | 'forever';  
  durationInMonths?: number;
   durationInDays?: number;
}

/**
 * Admin interface - Operation responses
 */
export interface PromotionOperationResponse {
  success: boolean;
  message: string;
  code?: PromotionCode;
  error?: string;
}
