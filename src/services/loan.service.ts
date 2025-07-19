// loan.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  doc,
  deleteDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  DocumentData,
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { Loan } from '../models/loan-model.model'; 

@Injectable({
  providedIn: 'root',
})
export class LoanService {
  private firestoreService = inject(FirestoreService);

  private get db() {
    return this.firestoreService.firestore;
  }

  private loansCollection = collection(this.db, 'loans');

  getAllLoans(): Observable<Loan[]> {
    const q = query(this.loansCollection, orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Loan))
      ),
      catchError((error) => {
        console.error('Error fetching loans:', error);
        return of([]);
      })
    );
  }

  getLoanById(id: string): Observable<Loan | null> {
    const docRef = doc(this.db, 'loans', id);

    return from(getDoc(docRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Loan;
        }
        return null;
      }),
      catchError((error) => {
        console.error('Error getting loan by ID:', error);
        return of(null);
      })
    );
  }

  addLoan(loanData: Partial<Loan>): Promise<void> {
    return addDoc(this.loansCollection, {
      ...loanData,
      createdAt: serverTimestamp(),
    }).then(() => void 0);
  }

  updateLoan(id: string, data: Partial<Loan>): Promise<void> {
    const docRef = doc(this.db, 'loans', id);
    return updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  deleteLoan(id: string): Promise<void> {
    const docRef = doc(this.db, 'loans', id);
    return deleteDoc(docRef);
  }

  getLoansByOriginator(originatorId: string): Observable<Loan[]> {
    const q = query(
      this.loansCollection,
      where('originatorId', '==', originatorId),
      orderBy('createdAt', 'desc')
    );

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Loan))
      ),
      catchError((error) => {
        console.error('Error fetching loans by originator:', error);
        return of([]);
      })
    );
  }
}
