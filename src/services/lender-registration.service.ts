import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Firestore, doc, setDoc, getDoc, serverTimestamp } from '@angular/fire/firestore';
import { inject } from '@angular/core';


// Define interfaces for better type safety
export interface ContactInfo {
  company: string;
  firstName: string;
  lastName: string;
  contactPhone: string;
  contactEmail: string;
  city: string;
  state: string;
}

export interface ProductInfo {
  lenderTypes: any[];
  minLoanAmount: number | string;
  maxLoanAmount: number | string;
  propertyCategories: string[];
  propertyTypes: string[];
  subcategorySelections: string[];
  loanTypes: string[];
  ficoScore: number;
}

export interface FootprintInfo {
  lendingFootprint: string[];
  states: Record<string, any>;
}

export interface PaymentInfo {
  billingInterval: 'monthly' | 'annually';
  couponCode: string;
  couponApplied: boolean;
  appliedCouponDetails: any;
  validatedCouponCode: string;
}

export interface LenderFormData {
  contact: ContactInfo | null;
  product: ProductInfo | null;
  footprint: FootprintInfo | null;
  payment: PaymentInfo | null;
  termsAccepted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LenderFormService {
  // Use BehaviorSubject for reactive state management
  private formDataSubject = new BehaviorSubject<LenderFormData>({
    contact: null,
    product: null,
    footprint: null,
    payment: null,
    termsAccepted: false,
  });

  // Expose as observable for components to subscribe to
  public formData$: Observable<LenderFormData> =
    this.formDataSubject.asObservable();

  // New properties for draft management
  private firestore = inject(Firestore);

  constructor() {}

  // Set a section of the form with persistence
  setFormSection(
    section: 'contact' | 'product' | 'footprint' | 'payment' | 'termsAccepted',
    data: any
  ): void {
    const currentData = this.formDataSubject.getValue();

    // Create a new object with updated section
    const updatedData = {
      ...currentData,
      [section]: data,
    };

    // Update the BehaviorSubject
    this.formDataSubject.next(updatedData);

  }

  // Get a section of the form
  getFormSection(
    section: 'contact' | 'product' | 'footprint' | 'payment' | 'termsAccepted'
  ): any {
    return this.formDataSubject.getValue()[section];
  }

  // Get the full form data as a reactive observable
  getFormData$(): Observable<LenderFormData> {
    return this.formData$;
  }

  // Get current snapshot of form data
  getFullForm(): LenderFormData {
    return this.formDataSubject.getValue();
  }

  // Check if a form section is completed (has data)
  isSectionCompleted(section: 'contact' | 'product' | 'footprint'): boolean {
    const sectionData = this.getFormSection(section);
    return sectionData !== null && Object.keys(sectionData || {}).length > 0;
  }

  // Clear the form and localStorage
  clearForm(): void {
    const emptyData = {
      contact: null,
      product: null,
      footprint: null,
      payment: null,
      termsAccepted: false,
    };

    // Reset the form data
    this.formDataSubject.next(emptyData);
  }
}