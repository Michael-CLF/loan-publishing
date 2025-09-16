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

/**
 * Frontend promotion code validation response
 */
export interface PromotionValidationResponse {
  valid: boolean;
  promotion_code?: {
    id: string;
    code: string;
    coupon: {
      id: string;
      name: string;
      percent_off?: number;
      amount_off?: number;
      currency?: string;
    };
  };
  error?: string;
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
}

/**
 * Admin interface - Update existing promotion code
 */
export interface UpdatePromotionRequest extends Partial<CreatePromotionRequest> {
  active?: boolean;
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

export interface PromotionListResponse {
  codes: PromotionCode[];
  total: number;
}