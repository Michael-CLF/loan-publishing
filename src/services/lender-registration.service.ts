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
    termsAccepted: false,
  });
  public formData$: Observable<LenderFormData> = this.formDataSubject.asObservable();

  // Firestore
  private firestore = inject(Firestore);

  constructor() {}

  // ----------------------------
  // Form state helpers
  // ----------------------------
  setFormSection(
    section: 'contact' | 'product' | 'footprint' | 'payment' | 'termsAccepted',
    data: any
  ): void {
    const current = this.formDataSubject.getValue();
    this.formDataSubject.next({ ...current, [section]: data });
  }

  getFormSection(
    section: 'contact' | 'product' | 'footprint' | 'payment' | 'termsAccepted'
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
      termsAccepted: false,
    });
  }

  // ----------------------------
  // Firestore write
  // ----------------------------
  /**
   * Create/merge the lender profile at `/lenders/{uid}`.
   * Sets subscription flags for pre-checkout and a YYYY-MM-DD createdAt.
   */
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
      paymentPending: true,
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
