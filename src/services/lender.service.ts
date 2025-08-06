// lender.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore, serverTimestamp, getDoc, doc } from '@angular/fire/firestore';
import { Observable, of, from } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { UserData } from '../models/user-data.model';

export interface Lender {
  id: string;
  accountNumber?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  createdAt?: any;
  contactInfo?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    contactEmail?: string;
    contactPhone?: string;
    city?: string;
    state?: string;
  };
  productInfo?: {
    lenderTypes?: string[];
    propertyCategories?: string[];
    propertyTypes?: string[];
    loanTypes?: string[];
    minLoanAmount?: string | number;
    maxLoanAmount?: string | number;
    subcategorySelections?: string[];
    ficoScore?: number;
  };
  footprintInfo?: {
    lendingFootprint?: string[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class LenderService {
  private firestoreService = inject(FirestoreService);

  private get db() {
    return this.firestoreService.firestore;
  }

  // Convert UserData to Lender format
  private mapUserToLender(user: UserData): Lender {
    // Create a default Lender object with empty/default values
    const lender: Lender = {
      id: user.id,
      contactInfo: {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        contactPhone: user.phone || '',
        contactEmail: user.email || '',
        city: user.city || '',
        state: user.state || '',
      },
      productInfo: {
        minLoanAmount: user['minLoanAmount'] || 1000000,
        maxLoanAmount: user['maxLoanAmount'] || 1000000,
        lenderTypes: [user['lenderType'] || ''].filter((lt) => lt !== ''),
        propertyCategories: user['propertyCategories'] || [],
        propertyTypes: user['propertyTypes'] || [],
        loanTypes: [],
        ficoScore: user['ficoScore'] || 0,
      },
      footprintInfo: {
        lendingFootprint: user['lendingFootprint'] || user['states'] || [],
      },
    };

    // Log the mapping to help debug
    console.log('Mapped user to lender:', { user, lender });

    return lender;
  }

  // Get all lenders
  getAllLenders(): Observable<Lender[]> {
    return this.firestoreService.getCollection<Lender>('lenders').pipe(
      tap((lenders) => console.log('Found lenders:', lenders.length)),
      catchError((error) => {
        console.error('Error getting lenders:', error);
        return of([]);
      })
    );
  }

getLender(id: string): Observable<Lender | null> {
  const docRef = doc(this.db, `lenders/${id}`);
  return from(getDoc(docRef)).pipe(
    map((docSnap) => {
      if (!docSnap.exists()) {
        return null;
      }

      const data: any = docSnap.data() || {};
      const contactInfo = data.contactInfo || {};
      const productInfo = data.productInfo || {};

      const lender: Lender = {
        id: docSnap.id,
        accountNumber: docSnap.id.substring(0, 8).toUpperCase(),
        firstName: data.firstName || contactInfo.firstName || '',
        lastName: data.lastName || contactInfo.lastName || '',
        company: data.company || contactInfo.company || '',
        email: data.email || contactInfo.contactEmail || contactInfo.email || '',
        phone: data.phone || contactInfo.contactPhone || contactInfo.phone || '',
        city: data.city || contactInfo.city || '',
        state: data.state || contactInfo.state || '',
        createdAt: data.createdAt || null,
        contactInfo: {
          ...contactInfo,
          firstName: contactInfo.firstName || data.firstName || '',
          lastName: contactInfo.lastName || data.lastName || '',
          contactEmail: contactInfo.contactEmail || data.email || '',
          contactPhone: contactInfo.contactPhone || data.phone || '',
          company: contactInfo.company || data.company || '',
          city: contactInfo.city || data.city || '',
          state: contactInfo.state || data.state || ''
        },
        productInfo: {
          ...productInfo,
          lenderTypes: productInfo.lenderTypes || data.lenderTypes || []
        }
      };

      return lender;
    })
  );
}


  private mapLenderData(lender: any): Lender {
    console.log('🔍 Raw Firebase lender data:', lender); // Debug log

    return {
      id: lender.id,
      contactInfo: {
        // ✅ FIXED: Map from ROOT-LEVEL Firebase fields (not nested contactInfo)
        firstName: lender.firstName || '', // Root level → nested
        lastName: lender.lastName || '', // Root level → nested
        company: lender.company || '', // Root level → nested
        contactEmail: lender.email || '', // Root "email" → nested "contactEmail"
        contactPhone: lender.phone || '', // Root "phone" → nested "contactPhone"
        city: lender.city || '', // Root level → nested
        state: lender.state || '', // Root level → nested
      },
      productInfo: {
        minLoanAmount: this.parseNumericValue(
          lender.productInfo?.minLoanAmount
        ),
        maxLoanAmount: this.parseNumericValue(
          lender.productInfo?.maxLoanAmount
        ),
        lenderTypes: lender.productInfo?.lenderTypes || [],
        propertyCategories: lender.productInfo?.propertyCategories || [],
        propertyTypes: lender.productInfo?.propertyTypes || [],
        subcategorySelections: lender.productInfo?.subcategorySelections || [],
        loanTypes: lender.productInfo?.loanTypes || [],
        ficoScore: lender.productInfo?.ficoScore || 0,
      },
      footprintInfo: {
        lendingFootprint: lender.footprintInfo?.lendingFootprint || [],
      },
    };
  }

  private parseNumericValue(value: any): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    const numericString = value.toString().replace(/[^0-9.]/g, '');
    return parseFloat(numericString) || 0;
  }

  // Update an existing lender
  updateLender(id: string, data: Partial<Lender>): Observable<void> {
    // Convert Lender partial to UserData partial as needed
    const userData: Partial<UserData> = {
      // Map the relevant fields from Lender to UserData
      // This is simplified - you'll need to adapt it to your specific needs
      updatedAt: serverTimestamp(), // Use serverTimestamp
    };

    // Change the collection from users to lenders
    return this.firestoreService.updateDocument(`lenders/${id}`, userData);
  }

  searchLenders(
    lenderType: string,
    propertyCategory: string,
    state: string,
    loanAmount: string,
    loanType: string // Added this parameter
  ): Observable<Lender[]> {
    console.log('Searching lenders with criteria:', {
      lenderType,
      propertyCategory,
      state,
      loanAmount,
      loanType,
    });

    // Get all lenders and filter in memory
    return this.getAllLenders().pipe(
      map((lenders) => {
        return lenders.filter((lender) => {
          let includeThisLender = true;

          // Filter by lender type if provided
          if (lenderType && lenderType.trim() !== '') {
            const lenderTypes = lender.productInfo?.lenderTypes || [];
            const hasMatchingType = lenderTypes.some(
              (type) => type.toLowerCase() === lenderType.toLowerCase()
            );

            if (!hasMatchingType) {
              includeThisLender = false;
            }
          }

          // Filter by loan type if provided
          if (loanType && loanType.trim() !== '' && includeThisLender) {
            const loanTypes = lender.productInfo?.loanTypes || [];
            const hasMatchingLoanType = loanTypes.some(
              (type) => type.toLowerCase() === loanType.toLowerCase()
            );

            if (!hasMatchingLoanType) {
              includeThisLender = false;
            }
          }

          // Filter by property category if provided
          if (
            propertyCategory &&
            propertyCategory.trim() !== '' &&
            includeThisLender
          ) {
            const categories = lender.productInfo?.propertyCategories || [];
            const hasMatchingCategory = categories.some(
              (category) =>
                category.toLowerCase() === propertyCategory.toLowerCase()
            );

            if (!hasMatchingCategory) {
              includeThisLender = false;
            }
          }

          // Filter by state if provided
          if (state && state.trim() !== '' && includeThisLender) {
            const states = lender.footprintInfo?.lendingFootprint || [];
            const hasMatchingState = states.some(
              (s) => s.toLowerCase() === state.toLowerCase()
            );

            if (!hasMatchingState) {
              includeThisLender = false;
            }
          }

          // Filter by loan amount if provided
          if (loanAmount && loanAmount.trim() !== '' && includeThisLender) {
            const amount = parseFloat(loanAmount.replace(/[^0-9.]/g, ''));
            if (!isNaN(amount) && amount > 0) {
              const minAmount =
                this.parseNumericValue(lender.productInfo?.minLoanAmount) || 0;
              const maxAmount =
                this.parseNumericValue(lender.productInfo?.maxLoanAmount) ||
                Number.MAX_VALUE;

              if (amount < minAmount || amount > maxAmount) {
                includeThisLender = false;
              }
            }
          }

          return includeThisLender;
        });
      }),
      tap((filteredLenders) => {
        console.log('After filtering:', filteredLenders.length, 'lenders');
      })
    );
  }
}
