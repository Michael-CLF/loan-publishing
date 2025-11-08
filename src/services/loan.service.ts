// loan.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  updateDoc,
  docData,
  deleteDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Loan } from '../models/loan-model.model';
import { Auth } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root',
})
export class LoanService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private get db() {
    return this.firestore;
  }
  
loadLoans(userId?: string): Observable<Loan[]> {
  // ✅ Use passed userId or fallback to current user
  const uid = userId || this.auth.currentUser?.uid;
  
  if (!uid) {
    console.warn('LoanService: No user ID available for loadLoans');
    return of([]);
  }

  console.log('LoanService: Loading loans for user:', uid);

  const q = query(
    collection(this.db, 'loans'),
    where('createdBy', '==', uid)
  );

  return from(getDocs(q)).pipe(
    map((snap) => {
      const loans = snap.docs.map((docSnap) => ({ 
        id: docSnap.id, 
        ...docSnap.data() 
      } as Loan));
      
      console.log(`LoanService: Found ${loans.length} loans for user ${uid}`);
      return loans;
    }),
    catchError((error) => {
      console.error('LoanService: loadLoans failed for user:', uid, error);
      return of([]);
    })
  );
}

  /**
   * ➕ Create a new loan
   */
  createLoan(data: Partial<Loan>): Observable<string> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return of('');

    const newId = doc(collection(this.db, 'loans')).id;
    const newLoan = {
      ...data,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    return from(setDoc(doc(this.db, 'loans', newId), newLoan)).pipe(
      map(() => newId),
      catchError((error) => {
        console.error('LoanService: createLoan failed', error);
        return of('');
      })
    );
  }

deleteLoan(id: string): Observable<void> {
  const loanRef = doc(this.db, 'loans', id);
  return from(deleteDoc(loanRef));
}


  /**
   * ✏️ Update loan
   */
  updateLoan(id: string, data: Partial<Loan>): Observable<void> {
    return from(
      updateDoc(doc(this.db, 'loans', id), {
        ...data,
        updatedAt: serverTimestamp(),
      })
    );
  }

  getLoanById(id: string): Observable<Loan | null> {
  const loanDocRef = doc(this.db, 'loans', id);
  return docData(loanDocRef).pipe(
    map((loanData) => {
      if (!loanData) return null;
      return { id, ...loanData } as Loan;
    }),
    catchError((error) => {
      console.error('❌ Error fetching loan by ID:', error);
      return of(null);
    })
  );
}
}
