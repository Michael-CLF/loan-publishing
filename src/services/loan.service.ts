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

// Loan interface based on your form structure
export interface Loan {
  id?: string;
  propertyTypeCategory: string;
  propertySubCategory: string;
  transactionType: string;
  loanAmount: string;
  loanType: string;
  propertyValue: string;
  ltv: number;
  noi?: string;
  city: string;
  state: string;
  numberOfSponsors: number;
  sponsorsLiquidity: string;
  sponsorFico: number;
  experienceInYears: number;
  contact: string;
  phone: string;
  email: string;
  notes?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

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
  createLoan(loanData: Loan): Observable<string> {
    return this.authService.getCurrentUser().pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((user) => {
        if (!user) {
          // Return an error Observable instead of null
          return throwError(() => new Error('User not authenticated'));
        }

        const timestamp = new Date();
        const newLoan: Loan = {
          ...loanData,
          createdBy: user.uid,
          createdAt: timestamp,
          updatedAt: timestamp,
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

  /**
   * Updates an existing loan document
   * @param id The document ID
   * @param loanData The updated loan data
   * @returns Observable of void
   */
  updateLoan(id: string, loanData: Partial<Loan>): Observable<void> {
    const loanDoc = doc(this.firestore, `loans/${id}`);
    const updateData = {
      ...loanData,
      updatedAt: new Date(),
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

  // Add this method to your loan.service.ts file

  /**
   * Get a single loan by ID
   */
  getLoanById(id: string): Observable<Loan | null> {
    if (!id) {
      return of(null);
    }

    const loanDoc = doc(this.firestore, `loans/${id}`);
    return from(getDoc(loanDoc)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return {
            id: docSnap.id,
            ...docSnap.data(),
          } as Loan;
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
  getLoan(id: string): Observable<Loan> {
    const loanDoc = doc(this.firestore, `loans/${id}`);
    return docData(loanDoc).pipe(
      takeUntilDestroyed(this.destroyRef),
      map((data) => {
        if (!data) {
          throw new Error(`Loan with ID ${id} not found`);
        }
        return { id, ...data } as Loan;
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
  getMyLoans(): Observable<Loan[]> {
    return this.authService.getCurrentUser().pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap((user) => {
        if (!user) {
          return throwError(() => new Error('User not authenticated'));
        }

        const myLoansQuery = query(
          this.loansCollection,
          where('createdBy', '==', user.uid),
          orderBy('createdAt', 'desc')
        );

        return collectionData(myLoansQuery, { idField: 'id' }).pipe(
          map((loans) => loans as Loan[]),
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
  getAllLoans(): Observable<Loan[]> {
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
      map((loans) => loans as Loan[]),
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
  searchLoans(propertyCategory?: string, state?: string): Observable<Loan[]> {
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
      map((loans) => loans as Loan[]),
      catchError((error) => {
        console.error('Error searching loans:', error);
        return throwError(() => error);
      })
    );
  }
}
