import {
  Injectable,
  inject,
  NgZone,
  Injector,
  runInInjectionContext,
  DestroyRef,
} from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  docData,
  collectionData,
  query,
  where,
  Timestamp,
  serverTimestamp,
  DocumentReference,
  DocumentData,
  QueryConstraint,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, from, of, throwError } from 'rxjs';
import { map, catchError, tap, switchMap, share } from 'rxjs/operators';
import { Originator } from 'src/models';
import { Loan } from './loan.service';
import { LocationService } from './location.service';

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private locationService = inject(LocationService);

  private runSafely<T>(fn: () => Observable<T>): Observable<T> {
    return this.ngZone.run(() => {
      return runInInjectionContext(this.injector, () => fn());
    });
  }

  private sanitizeData<T = Record<string, unknown>>(data: T): Partial<T> {
    if (data === null || data === undefined) return {} as Partial<T>;

    // If it's an array, sanitize each item recursively
    if (Array.isArray(data)) {
      return data
        .map((item) => this.sanitizeData(item))
        .filter((item) => item !== null && item !== undefined) as unknown as Partial<T>;
    }

    // Handle Firestore FieldValue instances like serverTimestamp
    const isFieldValue =
      typeof data === 'object' &&
      data !== null &&
      (data as any)._methodName === 'serverTimestamp';

    if (isFieldValue) {
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      const sanitizedObject: Partial<T> = {};

      Object.entries(data).forEach(([key, value]) => {
        const sanitizedValue = this.sanitizeData(value);

        if (
          key === 'createdAt' ||
          key === 'updatedAt' ||
          typeof sanitizedValue !== 'object' ||
          (Array.isArray(sanitizedValue) && sanitizedValue.length > 0) ||
          (typeof sanitizedValue === 'object' && Object.keys(sanitizedValue).length > 0)
        ) {
          (sanitizedObject as Record<string, unknown>)[key] = sanitizedValue;
        }
      });

      return sanitizedObject;
    }

    return data;
  }

  /**
   * Fix timestamps for unresolved documents in the originators collection
   * @returns Promise with count of fixed documents and total documents
   */
  fixOriginatorTimestamps(): Promise<{ fixed: number, total: number }> {
    return new Promise<{ fixed: number, total: number }>((resolve, reject) => {
      const originatorsRef = collection(this.firestore, 'originators');
      
      getDocs(originatorsRef)
        .then(snapshot => {
          let fixedCount = 0;
          const totalCount = snapshot.size;
          const batch = writeBatch(this.firestore);
          let batchHasUpdates = false;
          
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const createdAt = data['createdAt'];
            
            // Check if createdAt is NOT a proper Firestore Timestamp
            const needsUpdate = 
              !createdAt || 
              (typeof createdAt === 'object' && 
               '_methodName' in createdAt && 
               createdAt._methodName === 'serverTimestamp');
            
            if (needsUpdate) {
              console.warn(`🛠 Fixing createdAt for ${docSnap.id}`);
              batch.update(docSnap.ref, {
                // IMPORTANT: Use serverTimestamp() for proper server-side timestamp
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              fixedCount++;
              batchHasUpdates = true;
            }
          });
          
          if (batchHasUpdates) {
            batch.commit()
              .then(() => {
                console.log(`✅ Updated ${fixedCount} documents`);
                resolve({ fixed: fixedCount, total: totalCount });
              })
              .catch(error => {
                console.error('❌ Error committing batch:', error);
                reject(error);
              });
          } else {
            console.log('No documents needed updating');
            resolve({ fixed: 0, total: totalCount });
          }
        })
        .catch(err => {
          console.error('❌ Error fixing timestamps:', err);
          reject(err);
        });
    });
  }

  /**
   * Creates or replaces a document with proper timestamps
   */
  setDocument(path: string, data: any): Observable<void> {
    return this.runSafely(() => {
      // Add standard timestamps if not present
      const dataWithTimestamps = {
        ...data,
        createdAt: data.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const sanitizedData = this.sanitizeData(dataWithTimestamps);
      console.log('🔥 Sanitized Data Being Saved:', sanitizedData);
      
      const docRef = doc(this.firestore, path);
      return from(setDoc(docRef, sanitizedData)).pipe(
        catchError(error => {
          console.error(`Error setting document at ${path}:`, error);
          return throwError(() => error);
        })
      );
    });
  }

  /**
   * Updates a document with a proper updatedAt timestamp
   */
  updateDocument(path: string, data: any): Observable<void> {
    return this.runSafely(() => {
      // Always update the timestamp
      const dataWithTimestamp = {
        ...data,
        updatedAt: serverTimestamp()
      };
      
      const sanitizedData = this.sanitizeData(dataWithTimestamp);
      const docRef = doc(this.firestore, path);
      
      return from(updateDoc(docRef, sanitizedData)).pipe(
        catchError(error => {
          console.error(`Error updating document at ${path}:`, error);
          return throwError(() => error);
        })
      );
    });
  }

 /**
 * Deletes a document 
 * @returns Promise that resolves when document is deleted
 */
deleteDocument(path: string): Promise<void> {
  return runInInjectionContext(this.injector, async () => {
    try {
      const docRef = doc(this.firestore, path);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting document at ${path}:`, error);
      throw error;
    }
  });
}

  getDocument<T extends DocumentData>(path: string): Observable<(T & { id: string }) | null> {
    return this.runSafely(() => {
      const docRef = doc(this.firestore, path);
      return docData(docRef, { idField: 'id' }).pipe(
        map((data) => (data ? (data as T & { id: string }) : null)),
        catchError((error) => {
          console.error('Error getting document:', error);
          return of(null);
        })
      );
    });
  }

  getCollection<T extends DocumentData>(path: string): Observable<Array<T & { id: string }>> {
    return this.runSafely(() => {
      const collectionRef = collection(this.firestore, path);
      return collectionData(collectionRef, { idField: 'id' }).pipe(
        // Fix the TypeScript error with proper type assertion
        map(items => items as Array<T & { id: string }>),
        catchError((error) => {
          console.error(`Error getting collection at ${path}:`, error);
          return of([] as Array<T & { id: string }>);
        })
      );
    });
  }

  getSavedLoans(userId: string): Observable<any[]> {
    return this.runSafely(() => {
      const loanFavoritesCollection = collection(this.firestore, 'loanFavorites');
      const q = query(loanFavoritesCollection, where('userId', '==', userId));
      return collectionData(q, { idField: 'id' }).pipe(
        catchError((error) => {
          console.error('Error getting saved loans:', error);
          return of([]);
        })
      );
    });
  }

  getOriginatorLenderFavorites(originatorId: string): Observable<any[]> {
    return this.runSafely(() => {
      const favoritesRef = collection(this.firestore, 'originatorLenderFavorites');
      const q = query(favoritesRef, where('originatorId', '==', originatorId));
      return collectionData(q, { idField: 'id' }).pipe(
        catchError((error) => {
          console.error('Error getting originator-lender favorites:', error);
          return of([]);
        })
      );
    });
  }

  toggleFavoriteLoan(userUid: string, loan: Loan, isFavorite: boolean): Promise<void> {
    return runInInjectionContext(this.injector, async () => {
      try {
        const favoritesRef = collection(this.firestore, 'loanFavorites');
        const q = query(favoritesRef, where('loanId', '==', loan.id), where('userId', '==', userUid));
        const querySnapshot = await getDocs(q);

        if (isFavorite) {
          if (querySnapshot.empty) {
            await setDoc(doc(favoritesRef), {
              loanId: loan.id,
              userId: userUid,
              loanData: loan,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          const batch = writeBatch(this.firestore);
          let hasDocuments = false;
          
          querySnapshot.forEach(docSnap => {
            batch.delete(docSnap.ref);
            hasDocuments = true;
          });
          
          if (hasDocuments) {
            await batch.commit();
          }
        }

        return Promise.resolve();
      } catch (error) {
        console.error('Error toggling favorite loan:', error);
        return Promise.reject(error);
      }
    });
  }

  checkIfEmailExists(email: string): Observable<boolean> {
    const normalizedEmail = email.toLowerCase();
    return this.runSafely(() => {
      const usersCollection = collection(this.firestore, 'users');
      const lendersCollection = collection(this.firestore, 'lenders');

      const userQuery = query(usersCollection, where('email', '==', normalizedEmail));
      const lenderQuery = query(lendersCollection, where('contactInfo.contactEmail', '==', normalizedEmail));

      return from(getDocs(userQuery)).pipe(
        switchMap((userSnapshot) => {
          if (!userSnapshot.empty) return of(true);
          return from(getDocs(lenderQuery)).pipe(map((lenderSnapshot) => !lenderSnapshot.empty));
        }),
        catchError(error => {
          console.error('Error checking if email exists:', error);
          return of(false);
        }),
        share()
      );
    });
  }

  filterLenders(
    lenderType: string = '',
    propertyCategory: string = '',
    state: string = '',
    loanAmount: string = '',
    loanType: string = ''
  ): Observable<any[]> {
    return this.runSafely(() => {
      const collectionRef = collection(this.firestore, 'lenders');
      let q = query(collectionRef);
      const queryConstraints: QueryConstraint[] = [];

      if (lenderType) {
        queryConstraints.push(where('productInfo.lenderTypes', 'array-contains', lenderType));
      }

      if (queryConstraints.length > 0) {
        q = query(q, ...queryConstraints);
      }

      return collectionData(q, { idField: 'id' }).pipe(
        map((lenders) => lenders.filter((lender: any) => {
          if (propertyCategory) {
            const category = propertyCategory.toLowerCase();
            const categories = (lender.productInfo?.propertyCategories || []).map((c: string) => c.toLowerCase());
            if (!categories.includes(category)) return false;
          }

          if (state) {
            const stateKey = state.toLowerCase();
            const states = Object.keys(lender.footprintInfo?.states || {}).map((s) => s.toLowerCase());
            if (!states.includes(stateKey)) return false;
          }

          if (loanAmount) {
            const amount = Number(loanAmount.replace(/[^0-9.]/g, ''));
            const min = Number(lender.productInfo?.minLoanAmount) || 0;
            const max = Number(lender.productInfo?.maxLoanAmount) || Infinity;
            if (amount < min || amount > max) return false;
          }

          if (loanType) {
            const selectedLoanType = loanType.toLowerCase();
            const loanTypes = (lender.productInfo?.loanTypes || []).map((t: any) => typeof t === 'string' ? t.toLowerCase() : (t?.value || '').toLowerCase());
            if (!loanTypes.includes(selectedLoanType)) return false;
          }

          return true;
        })),
        catchError((error) => {
          console.error('Error filtering lenders:', error);
          return of([]);
        })
      ) as Observable<any[]>;
    });
  }
}