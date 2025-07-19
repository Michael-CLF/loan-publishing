// loan.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  updateDoc,
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
import { Loan as LoanModel } from '../models/loan-model.model';
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

  /**
   * 🔁 Get all loans created by current user
   */
  getMyLoans(): Observable<LoanModel[]> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return of([]);

    const q = query(
      collection(this.db, 'loans'),
      where('createdBy', '==', uid)
    );

    return from(getDocs(q)).pipe(
      map((snap) =>
        snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as LoanModel))
      ),
      catchError((error) => {
        console.error('LoanService: getMyLoans failed', error);
        return of([]);
      })
    );
  }

  /**
   * ➕ Create a new loan
   */
  createLoan(data: Partial<LoanModel>): Observable<string> {
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
  updateLoan(id: string, data: Partial<LoanModel>): Observable<void> {
    return from(
      updateDoc(doc(this.db, 'loans', id), {
        ...data,
        updatedAt: serverTimestamp(),
      })
    );
  }

  /**
   * 📄 Get one loan by ID
   */
  getLoan(id: string): Observable<LoanModel | null> {
    return from(getDoc(doc(this.db, 'loans', id))).pipe(
      map((snap) => {
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() } as LoanModel;
        }
        return null;
      }),
      catchError((error) => {
        console.error('LoanService: getLoan failed', error);
        return of(null);
      })
    );
  }
}
