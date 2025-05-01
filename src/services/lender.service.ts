// lender.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  QueryConstraint,
  docData,
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { UserData } from '../models/user-data.model';

// Keep your original Lender interface
// In lender.service.ts, update the productInfo type within the Lender interface:
export interface Lender {
  id?: string;
  name: string;
  lenderType: string;
  propertyCategories?: string[];
  states?: string[];
  productInfo?: {
    minLoanAmount?: number;
    maxLoanAmount?: number;
    lenderTypes?: string[];
    propertyCategories?: string[];
    propertyTypes?: string[];
    subcategorySelections?: string[]; // Add this line
    loanTypes?: string[]; // Add this if needed
  };
  contactInfo?: any;
  footprintInfo?: {
    lendingFootprint: string[];
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
      name: `${user['firstName'] || ''} ${user.lastName || ''}`.trim(),
      lenderType: user['lenderType'] || 'default',
      propertyCategories: user['propertyCategories'] || [],
      states: user['states'] || [user.state || ''].filter((s) => s !== ''),
      productInfo: {
        minLoanAmount: user['minLoanAmount'] || 1000000,
        maxLoanAmount: user['maxLoanAmount'] || 1000000,
        lenderTypes: [user['lenderType'] || ''].filter((lt) => lt !== ''),
        propertyCategories: user['propertyCategories'] || [],
        propertyTypes: user['propertyTypes'] || [],
      },
      contactInfo: {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        contactPhone: user.phone || '',
        contactEmail: user.email || '',
        city: user.city || '',
        state: user.state || '',
      },
      footprintInfo: {
        lendingFootprint: user['lendingFootprint'] || [],
      },
    };

    // Log the mapping to help debug
    console.log('Mapped user to lender:', { user, lender });

    return lender;
  }

  // Modify the methods in LenderService to get data from lenders collection

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

  // Helper method to map lender data
  private mapLenderData(lender: any): Lender {
    return {
      id: lender.id,
      name: `${lender.contactInfo?.firstName || ''} ${
        lender.contactInfo?.lastName || ''
      }`.trim(),
      lenderType: lender.productInfo?.lenderTypes?.[0] || 'default',
      propertyCategories: lender.productInfo?.propertyCategories || [],
      states: lender.footprintInfo?.lendingFootprint || [],
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
      contactInfo: lender.contactInfo || {},
      footprintInfo: lender.footprintInfo || { lendingFootprint: [] },
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

  // In lender.service.ts
  searchLenders(
    lenderType: string = '',
    propertyCategory: string = '',
    state: string = '',
    loanAmount: string = ''
  ): Observable<Lender[]> {
    console.log('Search criteria:', {
      lenderType,
      propertyCategory,
      state,
      loanAmount,
    });

    // If all filters are empty, just return all lenders
    if (!lenderType && !propertyCategory && !state && !loanAmount) {
      return this.getAllLenders();
    }

    // Get all lenders and filter in memory
    return this.getAllLenders().pipe(
      map((lenders) => {
        console.log('Filtering lenders:', lenders.length);

        return lenders.filter((lender) => {
          // Filter by lender type if provided
          if (lenderType && lenderType !== '') {
            const lenderTypes = lender.productInfo?.lenderTypes || [];
            if (!lenderTypes.includes(lenderType)) {
              return false;
            }
          }

          // Filter by property category if provided
          if (propertyCategory && propertyCategory !== '') {
            const categories = lender.productInfo?.propertyCategories || [];
            if (!categories.includes(propertyCategory)) {
              return false;
            }
          }

          // Filter by state if provided
          if (state && state !== '') {
            const states = lender.footprintInfo?.lendingFootprint || [];
            if (!states.includes(state)) {
              return false;
            }
          }

          // Filter by loan amount if provided
          if (loanAmount && loanAmount !== '') {
            const amount = parseFloat(loanAmount.replace(/[^0-9.]/g, ''));
            if (!isNaN(amount) && amount > 0) {
              const minAmount =
                this.parseNumericValue(lender.productInfo?.minLoanAmount) || 0;
              const maxAmount =
                this.parseNumericValue(lender.productInfo?.maxLoanAmount) ||
                Number.MAX_VALUE;

              if (amount < minAmount || amount > maxAmount) {
                return false;
              }
            }
          }

          // If all filters pass, include the lender
          return true;
        });
      }),
      tap((filteredLenders) => {
        console.log('After filtering:', filteredLenders.length, 'lenders');
      })
    );
  }
}
