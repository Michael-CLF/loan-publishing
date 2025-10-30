import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, from } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';

// ----------------------------
// Interfaces
// ----------------------------
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
  registrationMeta?: {
    userId?: string;
    email?: string;
    currentStep?: number;
    otpVerified?: boolean;
    timestamp?: string;
  };
  termsAccepted?: boolean;
}

// Minimal lender payload used for creation
export interface Lender {
  id?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  contactInfo?: Partial<ContactInfo>;
  productInfo?: Partial<ProductInfo>;
  footprintInfo?: Partial<FootprintInfo>;
  // any other fields you pass along from the form
}

@Injectable({ providedIn: 'root' })
export class LenderFormService {
  // Reactive form state
  private formDataSubject = new BehaviorSubject<LenderFormData>({
    contact: null,
    product: null,
    footprint: null,
    payment: null,
    registrationMeta: {
      currentStep: 0,
      otpVerified: false,
      timestamp: new Date().toISOString()
    },
    termsAccepted: false,
  });
  public formData$: Observable<LenderFormData> = this.formDataSubject.asObservable();

  // Firestore
  private firestore = inject(Firestore);

  constructor() {
     this.loadFromSessionStorage();
  }

  // ----------------------------
  // Form state helpers
  // ----------------------------
 setFormSection(
    section: 'contact' | 'product' | 'footprint' | 'payment' | 'termsAccepted' | 'registrationMeta',
    data: any
  ): void {
    const current = this.formDataSubject.getValue();
    this.formDataSubject.next({ ...current, [section]: data });
    this.saveToSessionStorage(); 
  }

  getFormSection(
    section: 'contact' | 'product' | 'footprint' | 'payment' | 'termsAccepted' |'registrationMeta',
  ): any {
    return this.formDataSubject.getValue()[section];
  }

  getFormData$(): Observable<LenderFormData> {
    return this.formData$;
  }

  getFullForm(): LenderFormData {
    return this.formDataSubject.getValue();
  }

  isSectionCompleted(section: 'contact' | 'product' | 'footprint'): boolean {
    const sectionData = this.getFormSection(section);
    return sectionData !== null && Object.keys(sectionData || {}).length > 0;
  }

 clearForm(): void {
    this.formDataSubject.next({
      contact: null,
      product: null,
      footprint: null,
      payment: null,
      registrationMeta: {
        currentStep: 0,
        otpVerified: false,
        timestamp: new Date().toISOString()
      },
      termsAccepted: false,
    });
    this.clearSessionStorage();
  }

  // Session Storage Management
  private readonly STORAGE_KEY = 'lender_registration_form';
  
  saveToSessionStorage(): void {
    const formData = this.formDataSubject.getValue();
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(formData));
    console.log('💾 Saved form to sessionStorage');
  }

  loadFromSessionStorage(): boolean {
    const stored = sessionStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const formData = JSON.parse(stored);
        // Check if data is not stale (24 hours)
        const timestamp = formData.registrationMeta?.timestamp;
        if (timestamp) {
          const hoursSinceCreated = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
          if (hoursSinceCreated > 24) {
            console.log('🗑️ Clearing stale form data (>24 hours old)');
            this.clearSessionStorage();
            return false;
          }
        }
        this.formDataSubject.next(formData);
        console.log('📂 Loaded form from sessionStorage', formData);
        return true;
      } catch (e) {
        console.error('Failed to parse stored form data', e);
        this.clearSessionStorage();
        return false;
      }
    }
    return false;
  }

  clearSessionStorage(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
    console.log('🗑️ Cleared sessionStorage');
  }

  updateRegistrationMeta(meta: Partial<LenderFormData['registrationMeta']>): void {
    const current = this.formDataSubject.getValue();
    const updatedMeta = {
      ...current.registrationMeta,
      ...meta
    };
    this.formDataSubject.next({
      ...current,
      registrationMeta: updatedMeta
    });
    this.saveToSessionStorage();
  }

  // ----------------------------
  // Firestore write
  // ----------------------------
 
createLenderProfile(uid: string, data: Partial<Lender>): Observable<void> {
    if (!uid) {
      console.error('❌ No UID provided when creating lender profile');
      return of(undefined) as unknown as Observable<void>;
    }

    // YYYY-MM-DD (UTC-based ISO date)
    const createdAt = new Date().toISOString().split('T')[0];

    const ref = doc(this.firestore, `lenders/${uid}`);
    const payload = {
      uid,
      ...data,
      createdAt,                     // e.g., 2025-08-08
      subscriptionStatus: 'inactive',
      // Removed paymentPending - only using subscriptionStatus
    };

    console.log('📝 Creating/merging lender profile:', payload);

    return from(setDoc(ref, payload, { merge: true })).pipe(
      tap(() => console.log(`✅ Lender profile saved for UID: ${uid}`)),
      catchError((err) => {
        console.error('🔥 Error creating lender profile:', err);
        throw err;
      })
    );
  }
}
