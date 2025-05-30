// loan.service.ts
import {
  Injectable,
  inject,
  DestroyRef,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  docData,
  query,
  where,
  orderBy,
  limit,
} from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import {
  Observable,
  from,
  of,
  switchMap,
  map,
  catchError,
  throwError,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Loan as LoanModel } from '../models/loan-model.model';
import { createTimestamp, createServerTimestamp } from '../utils/firebase.utils';
import { Timestamp, FieldValue } from '@angular/fire/firestore';



@Injectable({
  providedIn: 'root',
})
export class LoanService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);

  // Collection reference
  private loansCollection = collection(this.firestore, 'loans');

  /**
   * Creates a new loan document in Firestore
   * @param loanData The loan data to create
   * @returns Observable with the created document reference ID
   */
  createLoan(loanData: LoanModel): Observable<string> {
  return this.authService.getCurrentUser().pipe(
    takeUntilDestroyed(this.destroyRef),
    switchMap((user) => {
      if (!user) {
        // Return an error Observable instead of null
        return throwError(() => new Error('User not authenticated'));
      }

      const newLoan: LoanModel = {
        ...loanData,
        createdBy: user['uid'],
        createdAt: createTimestamp(),  // Use utility function instead of new Date()
        updatedAt: createTimestamp(),  // Use utility function instead of new Date()
      };

      return from(
        runInInjectionContext(this.injector, () =>
          addDoc(this.loansCollection, newLoan)
        )
      ).pipe(
        map((docRef) => docRef.id),
        catchError((error) => {
          console.error('Error creating loan:', error);
          return throwError(() => error);
        })
      );
    })
  );
}

  updateLoanFavorite(loanId: string, isFavorite: boolean) {
    // Fix the collection name from 'loan' to 'loans'
    const loanRef = doc(this.firestore, 'loans', loanId);
    return from(
      runInInjectionContext(this.injector, () =>
        updateDoc(loanRef, { isFavorite })
      )
    );
  }

  /**
   * Updates an existing loan document
   * @param id The document ID
   * @param loanData The updated loan data
   * @returns Observable of void
   */
  updateLoan(id: string, loanData: Partial<LoanModel>): Observable<void> {
  const loanDoc = doc(this.firestore, `loans/${id}`);
  const updateData = {
    ...loanData,
    updatedAt: createTimestamp(),  // Use utility function instead of new Date()
  };

  return from(
    runInInjectionContext(this.injector, () => updateDoc(loanDoc, updateData))
  ).pipe(
    catchError((error) => {
      console.error(`Error updating loan ${id}:`, error);
      return throwError(() => error);
    })
  );
}

  /**
   * Get a single loan by ID
   */
 getLoanById(id: string): Observable<LoanModel | null> {
  if (!id) {
    return of(null);
  }

  const loanDoc = doc(this.firestore, `loans/${id}`);
  return from(getDoc(loanDoc)).pipe(
    map((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          ...data,
          createdAt: data['createdAt'].toDate?.() || undefined,
          updatedAt: data['updatedAt'].toDate?.() || undefined,
        } as LoanModel;
      } else {
        console.log(`Loan with ID ${id} not found`);
        return null;
      }
    }),
    catchError((error) => {
      console.error('Error fetching loan:', error);
      return of(null);
    })
  );
}

  /**
   * Deletes a loan document
   * @param id The document ID to delete
   * @returns Observable of void
   */
  deleteLoan(id: string): Observable<void> {
    const loanDoc = doc(this.firestore, `loans/${id}`);
    return from(
      runInInjectionContext(this.injector, () => deleteDoc(loanDoc))
    ).pipe(
      catchError((error) => {
        console.error(`Error deleting loan ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Gets a single loan by ID
   * @param id The document ID
   * @returns Observable of the Loan
   */
  getLoan(id: string): Observable<LoanModel> {
    const loanDoc = doc(this.firestore, `loans/${id}`);
    return docData(loanDoc).pipe(
      takeUntilDestroyed(this.destroyRef),
      map((data) => {
        if (!data) {
          throw new Error(`Loan with ID ${id} not found`);
        }
        return { id, ...data } as LoanModel;
      }),
      catchError((error) => {
        console.error(`Error fetching loan ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Gets all loans created by the current user
   * @returns Observable of Loan array
   */
  getMyLoans(): Observable<LoanModel[]> {
    return this.authService.getCurrentUser().pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((user) => {
        if (!user) {
          return throwError(() => new Error('User not authenticated'));
        }

        const myLoansQuery = query(
          this.loansCollection,
          where('createdBy', '==', user['uid']),
          orderBy('createdAt', 'desc')
        );

        return collectionData(myLoansQuery, { idField: 'id' }).pipe(
          map((loans) => loans as LoanModel[]),
          catchError((error) => {
            console.error('Error fetching my loans:', error);
            return throwError(() => error);
          })
        );
      })
    );
  }

  /**
   * Gets all loans in the system
   * @returns Observable of Loan array
   */
  getAllLoans(): Observable<LoanModel[]> {
    return from(
      runInInjectionContext(this.injector, () => {
        const loansQuery = query(
          this.loansCollection,
          orderBy('createdAt', 'desc')
        );

        return collectionData(loansQuery, { idField: 'id' });
      })
    ).pipe(
      // Flatten the nested observable
      switchMap((observable) => observable),
      // Ensure we're returning an array of Loans
      map((loans) => loans as LoanModel[]),
      catchError((error) => {
        console.error('Error fetching all loans:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Search loans by property type and location
   * @param propertyCategory Optional category filter
   * @param state Optional state filter
   * @returns Observable of filtered Loan array
   */
  searchLoans(propertyCategory?: string, state?: string): Observable<LoanModel[]> {
    let loansQuery: any = this.loansCollection;

    // Build query dynamically based on provided filters
    const constraints = [];

    if (propertyCategory) {
      constraints.push(where('propertyTypeCategory', '==', propertyCategory));
    }

    if (state) {
      constraints.push(where('state', '==', state));
    }

    // Add default ordering
    constraints.push(orderBy('createdAt', 'desc'));

    // Apply all constraints
    if (constraints.length > 0) {
      loansQuery = query(this.loansCollection, ...constraints);
    }

    return collectionData(loansQuery, { idField: 'id' }).pipe(
      map((loans) => loans as LoanModel[]),
      catchError((error) => {
        console.error('Error searching loans:', error);
        return throwError(() => error);
      })
    );
  }
}
