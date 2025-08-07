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
  private draftIdSubject = new BehaviorSubject<string | null>(null);
  public draftId$ = this.draftIdSubject.asObservable();

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

    // AUTO-SAVE DRAFT IF WE HAVE AN EMAIL
    if (section === 'contact' && data?.contactEmail) {
      this.createOrUpdateDraft(data.contactEmail).subscribe({
        next: (draftId) => console.log('Draft saved:', draftId),
        error: (err) => console.error('Error saving draft:', err)
      });
    } else if (this.getCurrentDraftId() && currentData.contact?.contactEmail) {
      // Update existing draft
      this.createOrUpdateDraft(currentData.contact.contactEmail).subscribe({
        next: (draftId) => console.log('Draft updated:', draftId),
        error: (err) => console.error('Error updating draft:', err)
      });
    }
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

  /**
   * Create or update a draft document in Firestore
   */
  createOrUpdateDraft(email: string): Observable<string> {
    const draftId = this.draftIdSubject.getValue() || this.generateDraftId();
    const currentData = this.formDataSubject.getValue();

    const draftData = {
      ...currentData,
      email: email.toLowerCase().trim(),
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    const draftRef = doc(this.firestore, `lenderDrafts/${draftId}`);

    return from(setDoc(draftRef, draftData, { merge: true })).pipe(
      tap(() => {
        this.draftIdSubject.next(draftId);
      }),
      map(() => draftId)
    );
  }

  /**
   * Load draft from Firestore
   */
  loadDraft(draftId: string): Observable<LenderFormData | null> {
    const draftRef = doc(this.firestore, `lenderDrafts/${draftId}`);

    return from(getDoc(draftRef)).pipe(
      map(snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const formData: LenderFormData = {
            contact: data['contact'] || null,
            product: data['product'] || null,
            footprint: data['footprint'] || null,
            payment: data['payment'] || null,
            termsAccepted: data['termsAccepted'] || false,
          };

          // Update our local state
          this.formDataSubject.next(formData);
          this.draftIdSubject.next(draftId);

          return formData;
        }
        return null;
      })
    );
  }

  /**
   * Get current draft ID
   */
  getCurrentDraftId(): string | null {
    return this.draftIdSubject.getValue();
  }

  /**
   * Generate a unique draft ID
   */
  private generateDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear draft data after successful registration
   */
  clearDraft(): void {
    const draftId = this.draftIdSubject.getValue();
    if (draftId) {
      // Optionally delete from Firestore
      const draftRef = doc(this.firestore, `lenderDrafts/${draftId}`);
      setDoc(draftRef, { status: 'completed', completedAt: serverTimestamp() }, { merge: true });
    }

    this.draftIdSubject.next(null);
    this.clearForm();
  }
}