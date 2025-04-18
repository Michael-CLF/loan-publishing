// src/app/services/lender.service.ts
import { Injectable, inject } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { AuthService } from './auth.service';
import { Observable, from, of } from 'rxjs';
import { switchMap, map, take } from 'rxjs/operators';
import { DocumentReference, where } from '@angular/fire/firestore';

// First, update the Lender interface to include userId
export interface Lender {
  id?: string;
  userId: string; // Add this field
  contactInfo: {
    firstName: string;
    lastName: string;
    contactPhone: string;
    contactEmail: string;
    city: string;
    state: string;
  };
  productInfo: {
    lenderTypes: string[];
    minLoanAmount: string;
    maxLoanAmount: string;
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

  // Create a new lender
  createLender(
    lender: Omit<Lender, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.authService
        .getCurrentUser()
        .pipe(take(1))
        .subscribe({
          next: (user) => {
            if (!user) {
              reject(
                new Error('User must be authenticated to create a lender')
              );
              return;
            }

            const now = new Date();
            const lenderWithMetadata = {
              ...lender,
              userId: user.uid,
              createdAt: now,
              updatedAt: now,
            };

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
        switchMap((lender) => {
          if (!lender) return of(null);

          // Check if this lender belongs to the current user
          return this.authService.getCurrentUser().pipe(
            take(1),
            map((user) => {
              if (!user || lender.userId !== user.uid) {
                console.log('Unauthorized access attempt to lender:', id);
                return null;
              }
              return lender;
            })
          );
        })
      );
  }

  // Update a lender
  updateLender(id: string, lender: Partial<Lender>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.authService
        .getCurrentUser()
        .pipe(
          take(1),
          switchMap((user) => {
            if (!user) {
              throw new Error('User must be authenticated to update a lender');
            }

            // Verify this lender belongs to the user
            return this.getLender(id).pipe(take(1));
          })
        )
        .subscribe({
          next: (existingLender) => {
            if (!existingLender) {
              reject(new Error('Lender not found or unauthorized'));
              return;
            }

            const updateData = {
              ...lender,
              updatedAt: new Date(),
            };

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
      this.authService
        .getCurrentUser()
        .pipe(
          take(1),
          switchMap((user) => {
            if (!user) {
              throw new Error('User must be authenticated to delete a lender');
            }

            // Verify this lender belongs to the user
            return this.getLender(id).pipe(take(1));
          })
        )
        .subscribe({
          next: (existingLender) => {
            if (!existingLender) {
              reject(new Error('Lender not found or unauthorized'));
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
          [where('userId', '==', user.uid)]
        );
      })
    );
  }

  // Get all lenders (admin function)
  getAllLenders(): Observable<Lender[]> {
    return this.firestoreService.getCollection<Lender>(this.LENDERS_COLLECTION);
  }
}
