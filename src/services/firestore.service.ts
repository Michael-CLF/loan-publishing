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
  collectionData,
  docData,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  QueryConstraint,
  DocumentReference,
  DocumentData,
} from '@angular/fire/firestore';
import { Observable, from, of, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap, switchMap, share } from 'rxjs/operators';
import { Loan } from './loan.service';

export interface LenderFilter {
  lenderType?: string;
  propertyCategory?: string;
  state?: string;
  loanAmount?: number | string;
}

@Injectable({
  providedIn: 'root',
})
export class FirestoreService {
  private firestore = inject(Firestore);
  private ngZone = inject(NgZone);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);

  private lenderFiltersSubject = new BehaviorSubject<LenderFilter>({});
  private validatedEmails = new Set<string>();
  private existingEmails = new Set<string>();

  /**
   * Helper method to safely run Firebase operations within the injection context
   * @param fn Function that returns an Observable
   * @returns Observable from the function wrapped in proper injection context
   */
  private runSafely<T>(fn: () => Observable<T>): Observable<T> {
    return this.ngZone.run(() => {
      return runInInjectionContext(this.injector, () => {
        return fn();
      });
    });
  }

  /**
   * Helper method to safely run async Firebase operations within the injection context
   * @param fn Function that returns a Promise
   * @returns Promise from the function wrapped in proper injection context
   */
  private async runSafelyAsync<T>(fn: () => Promise<T>): Promise<T> {
    return this.ngZone.run(() => {
      return runInInjectionContext(this.injector, async () => {
        return await fn();
      });
    });
  }

  saveFavoriteLoan(lenderUid: string, loan: any) {
    return this.runSafely(() => {
      const savedLoansCollectionRef = collection(
        this.firestore,
        'loanFavorites'
      );
      return from(
        addDoc(savedLoansCollectionRef, {
          loanId: loan.id,
          loanData: loan,
          userId: lenderUid,
          savedAt: new Date(),
        })
      );
    });
  }

  /**
   * Advanced data sanitization with comprehensive type handling
   * @param data Input data to sanitize
   * @returns Sanitized data with undefined and null values removed
   */
  private sanitizeData<T = Record<string, unknown>>(data: T): Partial<T> {
    // Handle null or undefined input
    if (data === null || data === undefined) return {} as Partial<T>;

    // Handle arrays - preserve arrays even with empty values for form arrays
    if (Array.isArray(data)) {
      // For form arrays, we should preserve the array structure
      // even if it contains empty values to maintain form state
      if (data.length === 0) {
        return data as unknown as Partial<T>; // Return empty array as-is
      }

      return data
        .map((item) => this.sanitizeData(item))
        .filter((item) => {
          // Be less aggressive with filtering array items
          // Empty arrays and objects should be preserved for form state
          if (Array.isArray(item) && item.length === 0) return true;
          if (item === null || item === undefined) return false;
          if (
            typeof item === 'object' &&
            Object.keys(item as object).length === 0
          )
            return true;
          return true;
        }) as unknown as Partial<T>;
    }

    // Handle objects
    if (typeof data === 'object' && data !== null) {
      const sanitizedObject: Partial<T> = {};

      Object.keys(data).forEach((key) => {
        const value = (data as Record<string, unknown>)[key];

        // Special handling for form control values that might be empty but important
        if (
          key === 'lenderTypes' ||
          key === 'propertyCategories' ||
          key === 'lendingFootprint' ||
          key === 'states' ||
          key.includes('_counties') ||
          key === 'subcategorySelections'
        ) {
          // Preserve empty arrays and objects for these special form fields
          if (Array.isArray(value)) {
            (sanitizedObject as Record<string, unknown>)[key] = value;
            return;
          }
          // Preserve empty objects for counties data
          if (value !== null && typeof value === 'object') {
            (sanitizedObject as Record<string, unknown>)[key] = value;
            return;
          }
        }

        // Handle the value recursively
        const sanitizedValue = this.sanitizeData(value);

        // Only add meaningful values or special form values
        if (
          sanitizedValue !== undefined &&
          sanitizedValue !== null &&
          // Keep special form values regardless of emptiness
          (key === 'lenderTypes' ||
            key === 'propertyCategories' ||
            key === 'lendingFootprint' ||
            key === 'states' ||
            key.includes('_counties') ||
            key === 'subcategorySelections' ||
            // For other keys, only keep if they have content
            typeof sanitizedValue !== 'object' ||
            Object.keys(sanitizedValue as object).length > 0 ||
            (Array.isArray(sanitizedValue) && sanitizedValue.length > 0))
        ) {
          (sanitizedObject as Record<string, unknown>)[key] = sanitizedValue;
        }
      });

      return sanitizedObject;
    }

    // Return primitive values as-is
    return data;
  }

  /**
   * Filter lenders based on multiple criteria
   * @param lenderType Optional lender type filter
   * @param propertyCategory Optional property category filter
   * @param state Optional state filter
   * @param loanAmount Optional loan amount filter
   * @param loantype
   * @returns Observable of filtered lenders
   */
  filterLenders(
    lenderType: string = '',
    propertyCategory: string = '',
    state: string = '',
    loanAmount: string = '',
    loanType: string = ''
  ): Observable<any[]> {
    return this.runSafely(() => {
      console.log('Filtering lenders with criteria:', {
        lenderType,
        propertyCategory,
        state,
        loanAmount,
      });

      const collectionRef = collection(this.firestore, 'lenders');
      let q = query(collectionRef);
      const queryConstraints: QueryConstraint[] = [];

      // Add constraints for server-side filtering
      // Use advanced Firestore query capabilities where possible
      if (lenderType && lenderType.trim() !== '') {
        // For lender type, we need to query for objects in array that match this value
        queryConstraints.push(
          where('productInfo.lenderTypes', 'array-contains', lenderType)
        );
      }

      // Apply any constraints to our query
      if (queryConstraints.length > 0) {
        q = query(q, ...queryConstraints);
      }

      // Execute the base query
      return collectionData(q, { idField: 'id' }).pipe(
        map((lenders) => {
          console.log('Initial lenders found:', lenders.length);

          // Apply client-side filtering for more complex criteria
          return lenders.filter((lender) => {
            // Log the structure for debugging
            if (lenders.length > 0 && lender === lenders[0]) {
              console.log(
                'Sample lender structure:',
                JSON.stringify(lender, null, 2)
              );
            }

            // Filter by property category
            if (propertyCategory && propertyCategory.trim() !== '') {
              const categories = lender['productInfo'].propertyCategories || [];
              const hasCategory = categories.includes(propertyCategory);
              if (!hasCategory) return false;
            }

            // Filter by state
            if (state && state.trim() !== '') {
              // Check if state is in the states object
              const states = lender['footprintInfo'].states || {};
              const hasState = states[state] === true;
              if (!hasState) return false;
            }

            // Filter by loan amount
            if (loanAmount && loanAmount.trim() !== '') {
              const amount = Number(loanAmount.replace(/[^0-9.]/g, ''));
              if (!isNaN(amount) && amount > 0) {
                const minAmount =
                  Number(lender['productInfo'].minLoanAmount) || 0;
                const maxAmount =
                  Number(lender['productInfo'].maxLoanAmount) || 0;

                // Check if amount is in range
                if (
                  amount < minAmount ||
                  (maxAmount > 0 && amount > maxAmount)
                ) {
                  return false;
                }
              }
            }

            return true;
          });
        }),
        tap((filteredLenders) => {
          console.log('Filtered lenders count:', filteredLenders.length);
        })
      );
    });
  }

  /**
   * Check if a lender exists with the given email
   * @param email Email to check
   * @returns Observable boolean indicating lender existence
   */
  checkIfLenderExists(email: string): Observable<boolean> {
    return this.runSafely(() => {
      const lendersCollection = collection(this.firestore, 'lenders');
      const q = query(
        lendersCollection,
        where('contactInfo.contactEmail', '==', email.toLowerCase())
      );

      return from(getDocs(q)).pipe(map((snapshot) => !snapshot.empty));
    });
  }

  /**
   * Check if an email already exists in users or lenders collections
   * @param email Email to check
   * @returns Observable boolean indicating email existence
   */
  checkIfEmailExists(email: string): Observable<boolean> {
    // Normalize the email to lowercase for consistent checking
    const normalizedEmail = email.toLowerCase();

    // If we already know this email exists, return true immediately
    if (this.existingEmails.has(normalizedEmail)) {
      console.log('Email already known to exist (cached):', normalizedEmail);
      return of(true);
    }

    // If we already validated this email and know it doesn't exist, return false immediately
    if (this.validatedEmails.has(normalizedEmail)) {
      console.log(
        'Email already validated as unique (cached):',
        normalizedEmail
      );
      return of(false);
    }

    // Only perform the check if the email hasn't been validated either way
    return this.runSafely(() => {
      console.log('Checking if email exists:', normalizedEmail);
      const usersCollection = collection(this.firestore, 'users');
      const lendersCollection = collection(this.firestore, 'lenders');

      const userQuery = query(
        usersCollection,
        where('email', '==', normalizedEmail)
      );

      const lenderQuery = query(
        lendersCollection,
        where('contactInfo.contactEmail', '==', normalizedEmail)
      );

      return from(getDocs(userQuery)).pipe(
        switchMap((userSnapshot) => {
          if (!userSnapshot.empty) {
            // Add to existing emails cache
            this.existingEmails.add(normalizedEmail);
            return of(true);
          }

          return from(getDocs(lenderQuery)).pipe(
            map((lenderSnapshot) => {
              const exists = !lenderSnapshot.empty;

              // Update the appropriate cache based on result
              if (exists) {
                this.existingEmails.add(normalizedEmail);
              } else {
                this.validatedEmails.add(normalizedEmail);
              }

              return exists;
            })
          );
        }),
        // Add the share operator to ensure multiple subscriptions use the same result
        share()
      );
    });
  }

  /**
   * Clear the email validation cache
   */
  clearEmailCache(): void {
    this.validatedEmails.clear();
    this.existingEmails.clear();
    console.log('Email validation cache cleared');
  }

  /**
   * Retrieve an entire collection
   * @param path Firestore collection path
   * @returns Observable of collection documents with ids
   */
  getCollection<T extends DocumentData>(
    path: string
  ): Observable<Array<T & { id: string }>> {
    return this.runSafely(() => {
      console.log('Getting collection:', path);
      const collectionRef = collection(this.firestore, path);
      return collectionData(collectionRef, { idField: 'id' }) as Observable<
        Array<T & { id: string }>
      >;
    });
  }

  /**
   * Retrieve a single document
   * @param path Firestore document path
   * @returns Observable of document data with id
   */
  getDocument<T extends DocumentData>(
    path: string
  ): Observable<(T & { id: string }) | null> {
    return this.runSafely(() => {
      console.log('Getting document:', path);
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

  /**
   * Toggle favorite status for a loan
   * @param userUid User ID
   * @param loan Loan object
   * @param isFavorite Whether to mark as favorite or not
   */
  async toggleFavoriteLoan(
    userUid: string,
    loan: Loan,
    isFavorite: boolean
  ): Promise<void> {
    return this.runSafelyAsync(async () => {
      const favoritesRef = collection(this.firestore, 'loanFavorites');

      const q = query(
        favoritesRef,
        where('loanId', '==', loan.id),
        where('userId', '==', userUid)
      );

      const querySnapshot = await getDocs(q);

      if (isFavorite) {
        if (querySnapshot.empty) {
          await addDoc(favoritesRef, {
            loanId: loan.id,
            userId: userUid,
            loanData: loan,
            createdAt: new Date(),
          });
        }
      } else {
        querySnapshot.forEach(async (document) => {
          await deleteDoc(document.ref);
        });
      }
    });
  }

  /**
   * Retrieve a document with detailed logging
   * @param path Firestore document path
   * @returns Observable of document data with id and detailed logging
   */
  getDocumentWithLogging<T extends DocumentData>(
    path: string
  ): Observable<(T & { id: string }) | null> {
    return this.runSafely(() => {
      console.log('Getting document with detailed logging:', path);
      const docRef = doc(this.firestore, path);
      return docData(docRef, { idField: 'id' }).pipe(
        tap((data) => console.log('Raw document data received:', data)),
        map((data) => {
          if (data) {
            console.log('Document exists with data keys:', Object.keys(data));
            return data as T & { id: string };
          } else {
            console.log('Document does not exist at path:', path);
            return null;
          }
        }),
        catchError((error) => {
          console.error('Error getting document:', error);
          console.error('Error details:', error.code, error.message);
          return of(null);
        })
      );
    });
  }

  /**
   * Get saved loans for a user
   * @param userId User ID
   * @returns Observable of saved loans
   */
  getSavedLoans(userId: string): Observable<any[]> {
    return this.runSafely(() => {
      console.log('Getting saved loans with exact userId:', userId);
      // Try both collection names to see if either works
      const loanFavoritesCollection = collection(
        this.firestore,
        'loanFavorites'
      );

      // Log the exact query parameters
      console.log(
        'Query parameters: collection=loanFavorites, field=userId, value=',
        userId
      );

      const q = query(loanFavoritesCollection, where('userId', '==', userId));

      return collectionData(q, { idField: 'id' }).pipe(
        tap((data) =>
          console.log('Raw result data from loanFavorites query:', data)
        )
      );
    });
  }

  /**
   * Save a favorite lender for an originator
   * @param originatorId Originator ID
   * @param lenderId Lender ID
   * @returns Observable of document reference
   */
  saveOriginatorLenderFavorite(
    originatorId: string,
    lenderId: string
  ): Observable<DocumentReference<DocumentData>> {
    return this.runSafely(() => {
      const originatorFavoritesRef = collection(
        this.firestore,
        'originatorLenderFavorites'
      );

      return from(
        addDoc(originatorFavoritesRef, {
          originatorId: originatorId,
          lenderId: lenderId,
          createdAt: new Date(),
        })
      );
    });
  }

  /**
   * Remove a favorite lender for an originator
   * @param originatorId Originator ID
   * @param lenderId Lender ID
   */
  async removeOriginatorLenderFavorite(
    originatorId: string,
    lenderId: string
  ): Promise<void> {
    return this.runSafelyAsync(async () => {
      const originatorFavoritesRef = collection(
        this.firestore,
        'originatorLenderFavorites'
      );

      const q = query(
        originatorFavoritesRef,
        where('originatorId', '==', originatorId),
        where('lenderId', '==', lenderId)
      );

      const querySnapshot = await getDocs(q);

      for (const docSnap of querySnapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
    });
  }

  /**
   * Get favorite lenders for an originator
   * @param originatorId Originator ID
   * @returns Observable of favorite lenders
   */
  getOriginatorLenderFavorites(originatorId: string): Observable<any[]> {
    return this.runSafely(() => {
      const originatorFavoritesRef = collection(
        this.firestore,
        'originatorLenderFavorites'
      );

      const q = query(
        originatorFavoritesRef,
        where('originatorId', '==', originatorId)
      );

      return collectionData(q, { idField: 'id' });
    });
  }

  /**
   * Save a favorite lender for an originator
   * @param originatorId Originator ID
   * @param lenderId Lender ID
   * @returns Observable of document reference
   */
  private safeDocumentOperation(
    operation: 'add' | 'set' | 'update',
    path: string,
    data: any
  ): Observable<DocumentReference<DocumentData> | void> {
    return this.runSafely<DocumentReference<DocumentData> | void>(() => {
      // Sanitize the data
      const sanitizedData = this.sanitizeData(data);

      console.group(`Firestore ${operation.toUpperCase()} Operation`);
      console.log('Path:', path);
      console.log('Original Data:', data);
      console.log('Sanitized Data:', sanitizedData);

      // Validate sanitized data
      if (Object.keys(sanitizedData).length === 0) {
        console.warn(`No valid data to ${operation}`);
        console.groupEnd();
        return throwError(() => new Error(`No valid data to ${operation}`));
      }

      try {
        switch (operation) {
          case 'add':
            const collectionRef = collection(this.firestore, path);
            const addOperation = addDoc(collectionRef, sanitizedData);
            return from(addOperation).pipe(
              tap(() => {
                console.log('Document added successfully');
                console.groupEnd();
              }),
              catchError((error) => {
                console.error('Add document error:', error);
                console.groupEnd();
                return throwError(() => error);
              })
            );

          case 'set':
          case 'update':
            const docRef = doc(this.firestore, path);
            const operation2 =
              operation === 'set'
                ? setDoc(docRef, sanitizedData)
                : updateDoc(docRef, sanitizedData);

            return from(operation2).pipe(
              tap(() => {
                console.log(`Document ${operation}d successfully`);
                console.groupEnd();
              }),
              catchError((error) => {
                console.error(`${operation} document error:`, error);
                console.groupEnd();
                return throwError(() => error);
              })
            );

          default:
            throw new Error('Invalid operation');
        }
      } catch (error) {
        console.error('Firestore operation error:', error);
        console.groupEnd();
        return throwError(() => error);
      }
    });
  }

  /**
   * Add a document to a collection with enhanced safety
   * @param path Collection path
   * @param data Document data
   * @returns Observable of created document reference
   */
  addDocument(path: string, data: any): Observable<DocumentReference> {
    return this.safeDocumentOperation(
      'add',
      path,
      data
    ) as Observable<DocumentReference>;
  }

  /**
   * Set a document with enhanced safety
   * @param path Document path
   * @param data Document data
   * @returns Observable of document set operation
   */
  setDocument(path: string, data: any): Observable<void> {
    return this.safeDocumentOperation('set', path, data) as Observable<void>;
  }

  /**
   * Test query for favorites collection
   * @returns Observable of all favorites
   */
  testFavoritesQuery(): Observable<any[]> {
    return this.runSafely(() => {
      console.log('Running test query on Favorites collection');
      const loanFavoritesCollection = collection(
        this.firestore,
        'loanFavorites'
      );

      // Just get all documents from the collection to verify it exists and has data
      return collectionData(loanFavoritesCollection, { idField: 'id' }).pipe(
        tap((data) => console.log('All Favorites collection data:', data))
      );
    });
  }

  /**
   * Update a document
   * @param path Document path
   * @param data Document data
   * @returns Observable of update operation
   */
  updateDocument(path: string, data: any): Observable<void> {
    return this.runSafely(() => {
      const docRef = doc(this.firestore, path);
      return from(updateDoc(docRef, data));
    });
  }

  /**
   * Delete a document
   * @param path Document path
   * @returns Promise when document is deleted
   */
  async deleteDocument(path: string): Promise<void> {
    return this.runSafelyAsync(async () => {
      console.log('Deleting document:', path);
      const docRef = doc(this.firestore, path);
      return await deleteDoc(docRef);
    });
  }

  /**
   * Query a collection with custom constraints
   * @param path Collection path
   * @param queryConstraints Query constraints
   * @returns Observable of query results
   */
  queryCollection<T>(
    path: string,
    ...queryConstraints: QueryConstraint[]
  ): Observable<T[]> {
    return this.runSafely(() => {
      const collectionRef = collection(this.firestore, path);
      const q = query(collectionRef, ...queryConstraints);

      return from(getDocs(q)).pipe(
        map((snapshot) => {
          const results: T[] = [];
          snapshot.forEach((doc) => {
            results.push({ id: doc.id, ...doc.data() } as T);
          });
          return results;
        }),
        catchError((error) => {
          console.error(`Error querying collection at ${path}:`, error);
          return of([]);
        })
      );
    });
  }

  /**
   * Comprehensive debug method for complex objects
   * @param data Data to be sanitized and logged
   * @returns Sanitized data for further inspection
   */
  debugSanitization<T = Record<string, unknown>>(data: T): Partial<T> {
    console.group('Enhanced Data Sanitization Debug');
    console.log('Original Data:', JSON.parse(JSON.stringify(data)));
    const sanitizedData = this.sanitizeData(data);
    console.log('Sanitized Data:', JSON.parse(JSON.stringify(sanitizedData)));
    console.log('Sanitization Details:');
    console.log('- Original Keys:', Object.keys(data || {}));
    console.log('- Sanitized Keys:', Object.keys(sanitizedData));
    console.groupEnd();
    return sanitizedData;
  }
}
