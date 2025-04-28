import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

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
}

export interface FootprintInfo {
  lendingFootprint: string[];
  states: Record<string, any>;
}

export interface LenderFormData {
  contact: ContactInfo | null;
  product: ProductInfo | null;
  footprint: FootprintInfo | null;
  termsAccepted?: boolean;
}

@Injectable({ providedIn: 'root' })
export class LenderFormService {
  // Use BehaviorSubject for reactive state management
  private formDataSubject = new BehaviorSubject<LenderFormData>({
    contact: null,
    product: null,
    footprint: null,
    termsAccepted: false,
  });

  // Expose as observable for components to subscribe to
  public formData$: Observable<LenderFormData> =
    this.formDataSubject.asObservable();

  constructor() {
    // Try to load saved data from localStorage on initialization
    this.loadFromLocalStorage();
  }

  // Set a section of the form with persistence
  setFormSection(
    section: 'contact' | 'product' | 'footprint' | 'termsAccepted',
    data: any
  ): void {
    const currentData = this.formDataSubject.getValue();

    // Create a new object with updated section
    const updatedData = {
      ...currentData,
      [section]: data,
    };

    // Save to local storage
    this.saveToLocalStorage(updatedData);

    // Update the BehaviorSubject
    this.formDataSubject.next(updatedData);
  }

  // Get a section of the form
  getFormSection(
    section: 'contact' | 'product' | 'footprint' | 'termsAccepted'
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
      termsAccepted: false,
    };

    // Clear local storage
    localStorage.removeItem('lenderFormData');

    // Reset the form data
    this.formDataSubject.next(emptyData);
  }

  // Helper method to save form data to localStorage
  private saveToLocalStorage(data: LenderFormData): void {
    try {
      localStorage.setItem('lenderFormData', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving form data to localStorage:', error);
    }
  }

  // Helper method to load form data from localStorage
  private loadFromLocalStorage(): void {
    try {
      const savedData = localStorage.getItem('lenderFormData');
      if (savedData) {
        const parsedData = JSON.parse(savedData) as LenderFormData;
        this.formDataSubject.next(parsedData);
      }
    } catch (error) {
      console.error('Error loading form data from localStorage:', error);
    }
  }
}
