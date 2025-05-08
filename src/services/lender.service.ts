// lender.service.ts
import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { UserData } from '../models/user-data.model';

export interface Lender {
  id: string;
  lenderType?: string;
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
    lenderTypes?: string[]; // Using value format (e.g., 'agency', 'bank')
    propertyCategories?: string[]; // Using value format (e.g., 'commercial', 'retail')
    propertyTypes?: string[];
    loanTypes?: string[]; // Using value format (e.g., 'agency', 'bridge')
    minLoanAmount?: string | number;
    maxLoanAmount?: string | number;
    subcategorySelections?: string[];
  };
  footprintInfo?: {
    lendingFootprint?: string[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class LenderService {
  private firestore = inject(Firestore);
  private firestoreService = inject(FirestoreService);

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

  // Get a single lender by ID
  getLender(id: string): Observable<Lender | null> {
    return this.firestoreService.getDocument<any>(`lenders/${id}`).pipe(
      map((lender) => {
        if (lender && lender.role === 'lender') {
          return this.mapLenderData(lender);
        }
        console.log('User is not a lender or does not exist');
        return null;
      }),
      catchError((error) => {
        console.error('Error getting lender:', error);
        return of(null);
      })
    );
  }

  private mapLenderData(lender: any): Lender {
    return {
      id: lender.id,
      contactInfo: {
        firstName: lender.contactInfo?.firstName || '',
        lastName: lender.contactInfo?.lastName || '',
        company:
          lender.contactInfo?.company || lender.contactInfo?.company || '', // Map root-level company to contactInfo
        contactEmail: lender.contactInfo?.contactEmail || '',
        contactPhone: lender.contactInfo?.contactPhone || '',
        city: lender.contactInfo?.city || '',
        state: lender.contactInfo?.state || '',
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
      updatedAt: new Date(),
    };

    return this.firestoreService.updateDocument(`users/${id}`, userData);
  }

  // Search lenders with filters
  // src/app/services/lender.service.ts (partial update)
  // Add loanType parameter to searchLenders method
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
