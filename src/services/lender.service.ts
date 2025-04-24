// src/app/services/lender.service.ts
import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { AuthService } from './auth.service';
import { Observable, from, of } from 'rxjs';
import { switchMap, map, take } from 'rxjs/operators';
import { DocumentReference, where } from '@angular/fire/firestore';

// Update the Lender interface to make userId optional
export interface Lender {
  id?: string;
  userId?: string;
  role: string;
  contactInfo?: {
    company: string;
    firstName: string;
    lastName: string;
    contactPhone: string;
    contactEmail: string;
    city: string;
    state: string;
  };
  productInfo?: {
    lenderTypes: string[];
    minLoanAmount: number;
    maxLoanAmount: number;
    propertyCategories: string[];
    propertyTypes: string[];
  };
  footprintInfo: {
    lendingFootprint: string[];
    propertyTypes: Record<string, any>;
  };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class LenderService {
  private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);
  private readonly LENDERS_COLLECTION = 'lenders';

  // Create a new lender without requiring authentication
  createLender(
    lender: Omit<Lender, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const now = new Date();

      // Create a new object with all the lender properties plus the metadata
      const lenderWithMetadata: any = {
        ...lender,
        createdAt: now,
        updatedAt: now,
      };

      // Convert loan amounts to numbers
      if (lenderWithMetadata.productInfo) {
        lenderWithMetadata.productInfo = {
          ...lenderWithMetadata.productInfo,
          minLoanAmount:
            typeof lenderWithMetadata.productInfo.minLoanAmount === 'string'
              ? parseFloat(
                  lenderWithMetadata.productInfo.minLoanAmount.replace(
                    /[^0-9.]/g,
                    ''
                  )
                )
              : Number(lenderWithMetadata.productInfo.minLoanAmount || 0),
          maxLoanAmount:
            typeof lenderWithMetadata.productInfo.maxLoanAmount === 'string'
              ? parseFloat(
                  lenderWithMetadata.productInfo.maxLoanAmount.replace(
                    /[^0-9.]/g,
                    ''
                  )
                )
              : Number(lenderWithMetadata.productInfo.maxLoanAmount || 0),
        };
      }

      // Try to get current user, but don't require it
      this.authService
        .getCurrentUser()
        .pipe(take(1))
        .subscribe({
          next: (user) => {
            // Add userId if user is authenticated
            if (user) {
              lenderWithMetadata.userId = user.uid;
            }

            this.firestoreService
              .addDocument(this.LENDERS_COLLECTION, lenderWithMetadata)
              .then((docRef: DocumentReference) => {
                resolve(docRef.id);
              })
              .catch((error: Error) => {
                reject(error);
              });
          },
          error: (error) => {
            reject(error);
          },
        });
    });
  }

  // Get a specific lender
  getLender(id: string): Observable<Lender | null> {
    return this.firestoreService
      .getDocument<Lender>(`${this.LENDERS_COLLECTION}/${id}`)
      .pipe(
        map((lender) => {
          if (lender && lender.productInfo) {
            // Ensure loan amounts are proper numbers
            lender.productInfo.minLoanAmount = Number(
              lender.productInfo.minLoanAmount
            );
            lender.productInfo.maxLoanAmount = Number(
              lender.productInfo.maxLoanAmount
            );
          }
          return lender;
        })
      );
  }

  // Apply similar changes to getAllLenders and getLendersForCurrentUser

  // Update a lender
  updateLender(id: string, lender: Partial<Lender>): Promise<void> {
    return new Promise((resolve, reject) => {
      // Verify lender exists first
      this.getLender(id)
        .pipe(take(1))
        .subscribe({
          next: (existingLender) => {
            if (!existingLender) {
              reject(new Error('Lender not found'));
              return;
            }

            const updateData: Partial<Lender> = {
              ...lender,
              updatedAt: new Date(),
            };
            if (updateData.productInfo) {
              updateData.productInfo.minLoanAmount = Number(
                updateData.productInfo.minLoanAmount ?? 0
              );
              updateData.productInfo.maxLoanAmount = Number(
                updateData.productInfo.maxLoanAmount ?? 0
              );
            }

            this.firestoreService
              .updateDocument(`${this.LENDERS_COLLECTION}/${id}`, updateData)
              .then(() => resolve())
              .catch((error) => reject(error));
          },
          error: (error) => {
            reject(error);
          },
        });
    });
  }

  // Delete a lender
  deleteLender(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Verify lender exists first
      this.getLender(id)
        .pipe(take(1))
        .subscribe({
          next: (existingLender) => {
            if (!existingLender) {
              reject(new Error('Lender not found'));
              return;
            }

            this.firestoreService
              .deleteDocument(`${this.LENDERS_COLLECTION}/${id}`)
              .then(() => resolve())
              .catch((error) => reject(error));
          },
          error: (error) => {
            reject(error);
          },
        });
    });
  }

  // Get all lenders for the current user
  getLendersForCurrentUser(): Observable<Lender[]> {
    return this.authService.getCurrentUser().pipe(
      take(1),
      switchMap((user) => {
        if (!user) {
          return of([]);
        }

        // Get lenders where userId matches the current user
        return this.firestoreService.queryCollection<Lender>(
          this.LENDERS_COLLECTION,
          where('userId', '==', user.uid)
        );
      })
    );
  }

  getAllLenders(): Observable<Lender[]> {
    return this.firestoreService
      .getCollection<Lender>(this.LENDERS_COLLECTION)
      .pipe(
        map((lenders) => {
          return lenders.map((lender) => {
            // Create a copy of the lender to modify
            const updatedLender = { ...lender };

            // Check if productInfo exists
            if (updatedLender.productInfo) {
              // Use a safe method to clean and convert string values
              try {
                // For minLoanAmount
                const minAmount = updatedLender.productInfo.minLoanAmount;
                if (minAmount !== undefined && minAmount !== null) {
                  // Convert to string first, then clean non-numeric characters
                  const minStr = String(minAmount);
                  const cleanMin = minStr.replace(/[^0-9.]/g, '');
                  updatedLender.productInfo.minLoanAmount =
                    Number(cleanMin) || 0;
                }

                // For maxLoanAmount
                const maxAmount = updatedLender.productInfo.maxLoanAmount;
                if (maxAmount !== undefined && maxAmount !== null) {
                  // Convert to string first, then clean non-numeric characters
                  const maxStr = String(maxAmount);
                  const cleanMax = maxStr.replace(/[^0-9.]/g, '');
                  updatedLender.productInfo.maxLoanAmount =
                    Number(cleanMax) || 0;
                }
              } catch (error) {
                console.error('Error converting loan amounts', error);
              }
            }
            return updatedLender;
          });
        })
      );
  }
}
