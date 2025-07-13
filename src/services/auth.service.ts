// src/services/auth.service.ts

import { Injectable, inject } from '@angular/core';
import {
  Auth,
  User,
  UserCredential,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  DocumentReference
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { environment } from '../environments/environment';
import { Observable, from, of, throwError } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { docData } from 'rxfire/firestore';
import { UserData } from '../models/user-data.model'; // ✅ make sure this path is correct

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  private registrationSuccess = false;

  /**
   * ✅ Register and store Firestore user profile
   */
  registerUser(email: string, userData: any): Observable<User> {
    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    const uid = firebaseUser.uid;
    const role = userData.role || 'lender'; // fallback if missing

    const userDocRef = doc(this.firestore, `${role}s/${uid}`);

    const newUserData = {
      uid,
      email,
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      subscriptionStatus: 'inactive' // ✅ Default until webhook updates it
    };

    return from(setDoc(userDocRef, newUserData)).pipe(map(() => firebaseUser));
  }

/**
 * Fetch any user profile by UID (used when currentUser not available)
 */
getUserProfileById(uid: string): Observable<UserData | null> {
  const originatorRef = doc(this.firestore, `originators/${uid}`);
  const lenderRef = doc(this.firestore, `lenders/${uid}`);

  return from(getDoc(originatorRef)).pipe(
    switchMap((originatorSnap) => {
      if (originatorSnap.exists()) {
        return of({
          id: originatorSnap.id,
          ...(originatorSnap.data() as any),
        } as UserData);
      }

      return from(getDoc(lenderRef)).pipe(
        map((lenderSnap) => {
          if (lenderSnap.exists()) {
            return {
              id: lenderSnap.id,
              ...(lenderSnap.data() as any),
            } as UserData;
          } else {
            return null;
          }
        })
      );
    }),
    catchError((err) => {
      console.error('❌ Error fetching user profile by ID:', err);
      return of(null);
    })
  );
}


  /**
   * ✅ Send login email link
   */
  sendLoginLink(email: string): Observable<void> {
    const actionCodeSettings = {
      url: `${environment.frontendUrl}/login`,
      handleCodeInApp: true,
    };

    return from(sendSignInLinkToEmail(this.auth, email, actionCodeSettings)).pipe(
      map(() => {
        localStorage.setItem('emailForSignIn', email);
      }),
      catchError((error) => {
        console.error('❌ Error sending login link:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * ✅ Login using email link
   */
  loginWithEmailLink(email?: string): Observable<UserCredential> {
    const storedEmail = email || localStorage.getItem('emailForSignIn');
    if (!storedEmail) {
      return throwError(() => new Error('No email stored for sign-in'));
    }

    if (!isSignInWithEmailLink(this.auth, window.location.href)) {
      return throwError(() => new Error('Invalid sign-in link'));
    }

    return from(signInWithEmailLink(this.auth, storedEmail, window.location.href)).pipe(
      map((credential) => {
        localStorage.removeItem('emailForSignIn');
        return credential;
      }),
      catchError((error) => {
        console.error('❌ Error signing in with email link:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * ✅ Log out current user
   */
  logout(): Observable<void> {
    return from(signOut(this.auth));
  }

  /**
   * ✅ Return the current Firebase user (minimal auth object)
   */
  getCurrentFirebaseUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  /**
   * ✅ Modal flow state controller (used after Stripe return)
   */
  setRegistrationSuccess(value: boolean): void {
    this.registrationSuccess = value;
  }

  getRegistrationSuccess(): boolean {
    return this.registrationSuccess;
  }

  clearRegistrationSuccess(): void {
    this.registrationSuccess = false;
  }
}
