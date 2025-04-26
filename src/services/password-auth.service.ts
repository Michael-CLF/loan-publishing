import { Injectable, inject } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from '@angular/fire/auth';
import { FirestoreService } from './firestore.service';
import { Observable, from, of, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class PasswordAuthService {
  private auth = inject(Auth);
  private firestoreService = inject(FirestoreService);

  constructor() {}

  registerUser(
    email: string,
    password: string,
    userData: any
  ): Observable<any> {
    return from(
      createUserWithEmailAndPassword(this.auth, email, password)
    ).pipe(
      switchMap((userCredential) => {
        const user = userCredential.user;

        // Generate account number from the first 8 characters of UID
        const accountNumber = user.uid.substring(0, 8);

        return from(
          this.firestoreService.addDocument('users', {
            uid: user.uid,
            accountNumber: accountNumber, // Add the account number
            ...userData,
            createdAt: new Date(),
          })
        ).pipe(switchMap(() => of(user)));
      }),
      catchError((error) => {
        console.error('Error registering user:', error);
        // Instead of returning of(null), throw the error to propagate it
        return throwError(() => error);
      })
    );
  }

  login(email: string, password: string): Observable<boolean> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(() => of(true)),
      catchError((error) => {
        console.error('Login error:', error);
        return of(false);
      })
    );
  }

  logout(): Observable<void> {
    return from(signOut(this.auth)).pipe(
      catchError((error) => {
        console.error('Logout error:', error);
        return of(undefined);
      })
    );
  }
}
