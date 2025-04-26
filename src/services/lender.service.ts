// lender.service.ts
import { Injectable } from '@angular/core';
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
  collectionData,
  docData,
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

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
  constructor(private firestore: Firestore) {}

  // Get all lenders
  getAllLenders(): Observable<Lender[]> {
    const lendersRef = collection(this.firestore, 'lenders');
    return collectionData(lendersRef, { idField: 'id' }) as Observable<
      Lender[]
    >;
  }
  // Get a single lender by ID
  getLender(id: string): Observable<Lender> {
    const lenderDocRef = doc(this.firestore, `lenders/${id}`);
    return docData(lenderDocRef, { idField: 'id' }).pipe(
      map((data) => data as Lender),
      catchError((error) => {
        console.error('Error getting lender:', error);
        throw error;
      })
    );
  }

  // Create a new lender
  async createLender(lender: Lender): Promise<string> {
    try {
      const lendersRef = collection(this.firestore, 'lenders');
      const docRef = await addDoc(lendersRef, lender);
      return docRef.id;
    } catch (error) {
      console.error('Error adding lender:', error);
      throw error;
    }
  }

  // Update an existing lender
  async updateLender(id: string, lender: Partial<Lender>): Promise<void> {
    try {
      const lenderDocRef = doc(this.firestore, `lenders/${id}`);
      await updateDoc(lenderDocRef, lender);
    } catch (error) {
      console.error('Error updating lender:', error);
      throw error;
    }
  }

  // Delete a lender
  async deleteLender(id: string): Promise<void> {
    try {
      const lenderDocRef = doc(this.firestore, `lenders/${id}`);
      await deleteDoc(lenderDocRef);
    } catch (error) {
      console.error('Error deleting lender:', error);
      throw error;
    }
  }

  searchLenders(
    lenderType: string,
    propertyCategory: string,
    state: string,
    loanAmount: string
  ): Observable<Lender[]> {
    const lendersRef = collection(this.firestore, 'lenders');

    // First get all lenders, then filter in memory
    return this.getAllLenders().pipe(
      map((lenders) => {
        return lenders.filter((lender) => {
          // Filter by lender type if provided
          if (lenderType && lender.productInfo?.lenderTypes) {
            if (!lender.productInfo.lenderTypes.includes(lenderType)) {
              return false;
            }
          }

          // Filter by property category if provided
          if (propertyCategory && lender.propertyCategories) {
            if (!lender.propertyCategories.includes(propertyCategory)) {
              return false;
            }
          }

          // Filter by state if provided
          if (state && lender.states) {
            if (!lender.states.includes(state)) {
              return false;
            }
          }

          // Filter by loan amount if provided
          if (loanAmount) {
            const cleanedAmount = loanAmount.replace(/[^0-9.]/g, '');
            const amount = Number(cleanedAmount);

            if (!isNaN(amount) && amount > 0) {
              const minAmount = lender.productInfo?.minLoanAmount || 0;
              const maxAmount =
                lender.productInfo?.maxLoanAmount || Number.MAX_VALUE;

              if (amount < minAmount || amount > maxAmount) {
                return false;
              }
            }
          }

          // If all filters pass or no filters provided, include the lender
          return true;
        });
      })
    );
  }
}
