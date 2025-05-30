import { Timestamp } from "firebase/firestore";

export interface Loan {
  id?: string;
  propertyTypeCategory: string;
  propertySubCategory: string;
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
