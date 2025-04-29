// src/app/models/lender.model.ts
export interface Lender {
  id?: string;
  contactInfo: {
    company: string;
    firstName: string;
    lastName: string;
    contactPhone: string;
    contactEmail: string;
    city: string;
    state: string;
  };
  productInfo: {
    lenderTypes: string[];
    minLoanAmount: string;
    maxLoanAmount: string;
    propertyCategories: string[];
    propertyTypes: string[];
  };
  footprintInfo: {
    lendingFootprint: string[];
    propertyTypes: Record<string, any>;
  };
  createdAt: Date;
  updatedAt: Date;
}
