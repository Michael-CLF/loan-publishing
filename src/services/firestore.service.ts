// Firstore service TS
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
  limit,
  QueryConstraint,
  DocumentReference,
  DocumentData,
} from '@angular/fire/firestore';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';

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

  // Add this method to your FirestoreService class

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

  checkIfEmailExists(email: string): Observable<boolean> {
    const usersCollection = collection(this.firestore, 'users');
    const q = query(
      usersCollection,
      where('contactEmail', '==', email.toLowerCase())
    );

    return from(getDocs(q)).pipe(map((snapshot) => !snapshot.empty));
  }

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

  addDocument(path: string, data: any): Promise<DocumentReference> {
    return this.ngZone.run(() => {
      console.log('Adding document to:', path);
      return runInInjectionContext(this.injector, () => {
        const collectionRef = collection(this.firestore, path);
        return addDoc(collectionRef, data);
      });
    });
  }

  setDocument(path: string, data: any): Promise<void> {
    return this.ngZone.run(() => {
      console.log('Setting document at:', path);
      return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, path);
        return setDoc(docRef, data);
      });
    });
  }

  updateDocument(path: string, data: any): Promise<void> {
    return this.ngZone.run(() => {
      console.log('Updating document:', path);
      return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, path);
        return updateDoc(docRef, data);
      });
    });
  }

  deleteDocument(path: string): Promise<void> {
    return this.ngZone.run(() => {
      console.log('Deleting document:', path);
      return runInInjectionContext(this.injector, () => {
        const docRef = doc(this.firestore, path);
        return deleteDoc(docRef);
      });
    });
  }

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
}
