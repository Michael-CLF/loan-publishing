import { Injectable, inject } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from '@angular/fire/auth';
import { FirestoreService } from './firestore.service';
import { Observable, from, of } from 'rxjs';
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
        return from(
          this.firestoreService.addDocument('users', {
            uid: user.uid,
            ...userData,
            createdAt: new Date(),
          })
        ).pipe(switchMap(() => of(user)));
      })
    );

    catchError((error) => {
      console.error('Error registering user:', error);
      return of(null);
    });
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
