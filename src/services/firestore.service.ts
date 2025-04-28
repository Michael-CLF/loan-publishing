import {
  Injectable,
  inject,
  NgZone,
  DestroyRef,
  Injector,
  runInInjectionContext,
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
import { map, catchError, tap, switchMap } from 'rxjs/operators';
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

  saveFavoriteLoan(lenderUid: string, loan: any) {
    // Use a consistent collection path that matches your dashboard component
    const savedLoansCollectionRef = collection(this.firestore, 'Favorites');

    // Create a document with appropriate fields to match what your loadSavedLoans expects
    return runInInjectionContext(this.injector, () =>
      addDoc(savedLoansCollectionRef, {
        loanId: loan.id,
        loanData: loan,
        savedBy: lenderUid,
        savedAt: new Date(),
      })
    );
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
   * @returns Observable of filtered lenders
   */
  filterLenders(
    lenderType: string = '',
    propertyCategory: string = '',
    state: string = '',
    loanAmount: string = ''
  ): Observable<any[]> {
    const collectionRef = collection(this.firestore, 'lenders');
    const constraints: QueryConstraint[] = [];

    // Add constraints only for non-empty values
    if (lenderType) {
      constraints.push(where('lenderType', '==', lenderType));
    }

    if (propertyCategory) {
      constraints.push(
        where('propertyCategories', 'array-contains', propertyCategory)
      );
    }

    if (state) {
      constraints.push(where('states', 'array-contains', state));
    }

    if (loanAmount && loanAmount.trim() !== '') {
      const amount = Number(loanAmount.replace(/[^0-9.]/g, ''));
      if (!isNaN(amount) && amount > 0) {
        constraints.push(where('productInfo.minLoanAmount', '<=', amount));
        constraints.push(where('productInfo.maxLoanAmount', '>=', amount));
      }
    }

    // If we have constraints, query with them; otherwise, get all documents
    if (constraints.length > 0) {
      const q = query(collectionRef, ...constraints);
      return collectionData(q, { idField: 'id' });
    } else {
      return collectionData(collectionRef, { idField: 'id' });
    }
  }

  /**
   * Check if an email already exists in the users collection
   * @param email Email to check
   * @returns Observable boolean indicating email existence
   */
  checkIfEmailExists(email: string): Observable<boolean> {
    const usersCollection = collection(this.firestore, 'users');
    const q = query(
      usersCollection,
      where('contactEmail', '==', email.toLowerCase())
    );

    return from(getDocs(q)).pipe(map((snapshot) => !snapshot.empty));
  }

  /**
   * Retrieve an entire collection
   * @param path Firestore collection path
   * @returns Observable of collection documents with ids
   */
  getCollection<T extends DocumentData>(
    path: string
  ): Observable<Array<T & { id: string }>> {
    return this.ngZone.run(() => {
      console.log('Getting collection:', path);
      return runInInjectionContext(this.injector, () => {
        const collectionRef = collection(this.firestore, path);
        return collectionData(collectionRef, { idField: 'id' }) as Observable<
          Array<T & { id: string }>
        >;
      });
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
    return this.ngZone.run(() => {
      console.log('Getting document:', path);
      return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, path);
        return docData(docRef, { idField: 'id' }).pipe(
          map((data) => (data ? (data as T & { id: string }) : null)),
          catchError((error) => {
            console.error('Error getting document:', error);
            return of(null);
          })
        );
      });
    });
  }

  async toggleFavoriteLoan(
    userUid: string,
    loan: Loan,
    isFavorite: boolean
  ): Promise<void> {
    const favoritesRef = collection(this.firestore, 'Favorites');

    const q = query(
      favoritesRef,
      where('loanId', '==', loan.id),
      where('savedBy', '==', userUid)
    );

    const querySnapshot = await getDocs(q);

    if (isFavorite) {
      if (querySnapshot.empty) {
        await addDoc(favoritesRef, {
          loanId: loan.id,
          savedBy: userUid,
          loanData: loan,
          createdAt: new Date(),
        });
      }
    } else {
      querySnapshot.forEach(async (document) => {
        await deleteDoc(document.ref);
      });
    }
  }

  /**
   * Retrieve a document with detailed logging
   * @param path Firestore document path
   * @returns Observable of document data with id and detailed logging
   */
  getDocumentWithLogging<T extends DocumentData>(
    path: string
  ): Observable<(T & { id: string }) | null> {
    return this.ngZone.run(() => {
      console.log('Getting document with detailed logging:', path);
      return runInInjectionContext(this.injector, () => {
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
    });
  }

  // In your FirestoreService
  getSavedLoans(userId: string): Observable<any[]> {
    return this.ngZone.run(() => {
      console.log('Getting saved loans with exact userId:', userId);
      return runInInjectionContext(this.injector, () => {
        // Try both collection names to see if either works
        const favoritesCollection = collection(this.firestore, 'Favorites');

        // Log the exact query parameters
        console.log(
          'Query parameters: collection=Favorites, field=savedBy, value=',
          userId
        );

        const q = query(favoritesCollection, where('savedBy', '==', userId));

        return collectionData(q, { idField: 'id' }).pipe(
          tap((data) =>
            console.log('Raw result data from Favorites query:', data)
          )
        );
      });
    });
  }

  /**
   * Wrapper method for safer document operations with comprehensive logging
   * @param operation Operation to perform (add, set, update)
   * @param path Firestore document or collection path
   * @param data Document data
   * @returns Observable or Promise of the operation
   */
  private safeDocumentOperation(
    operation: 'add' | 'set' | 'update',
    path: string,
    data: any
  ): Observable<DocumentReference | void> {
    return this.ngZone.run(() => {
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

      return runInInjectionContext(this.injector, () => {
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
              const docRef = doc(this.firestore, path);
              const setOperation = setDoc(docRef, sanitizedData);
              return from(setOperation).pipe(
                tap(() => {
                  console.log('Document set successfully');
                  console.groupEnd();
                }),
                catchError((error) => {
                  console.error('Set document error:', error);
                  console.groupEnd();
                  return throwError(() => error);
                })
              );

            case 'update':
              const updateDocRef = doc(this.firestore, path);
              const updateOperation = updateDoc(updateDocRef, sanitizedData);
              return from(updateOperation).pipe(
                tap(() => {
                  console.log('Document updated successfully');
                  console.groupEnd();
                }),
                catchError((error) => {
                  console.error('Update document error:', error);
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
   * Update a document with enhanced safety
   * @param path Document path
   * @param data Partial update data
   * @returns Observable of document update operation
   */
  // Add this to your FirestoreService
  // Add this to your FirestoreService
  testFavoritesQuery(): Observable<any[]> {
    return this.ngZone.run(() => {
      console.log('Running test query on Favorites collection');
      return runInInjectionContext(this.injector, () => {
        // Try querying the Favorites collection with no filters
        const favoritesCollection = collection(this.firestore, 'Favorites');

        // Just get all documents from the collection to verify it exists and has data
        return collectionData(favoritesCollection, { idField: 'id' }).pipe(
          tap((data) => console.log('All Favorites collection data:', data))
        );
      });
    });
  }

  updateDocument(path: string, data: any): Observable<void> {
    return this.safeDocumentOperation('update', path, data) as Observable<void>;
  }

  /**
   * Delete a document
   * @param path Document path
   * @returns Promise when document is deleted
   */
  deleteDocument(path: string): Promise<void> {
    return this.ngZone.run(() => {
      console.log('Deleting document:', path);
      return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, path);
        return deleteDoc(docRef);
      });
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
