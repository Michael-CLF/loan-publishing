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
  signOut,
  signInWithPopup,
  GoogleAuthProvider
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
import { UserData } from '../models/user-data.model';
import { BehaviorSubject } from 'rxjs';
import { authState, user } from '@angular/fire/auth';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private http = inject(HttpClient);
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
   * ✅ Register user via HTTP API (creates user with inactive status, no App Check required)
   */
  registerUserViaAPI(email: string, userData: any): Observable<{ success: boolean, uid: string }> {
    console.log('🔍 Calling registerUser function');

    const registrationData = {
      email: email.toLowerCase().trim(),
      role: userData.role || 'originator',
      userData: {
        firstName: userData.firstName,
        lastName: userData.lastName,
        company: userData.company,
        phone: userData.phone,
        city: userData.city,
        state: userData.state,
      }
    };

    // ✅ Call the new registerUser function (no App Check required)
    const registerUserUrl = 'https://us-central1-loanpub.cloudfunctions.net/registerUser';

    return this.http.post<{ success: boolean, uid: string }>(
      registerUserUrl,
      registrationData,
      {
        headers: { 'Content-Type': 'application/json' }
        // ✅ No App Check headers needed for user registration
      }
    ).pipe(
      catchError((error) => {
        console.error('❌ Error registering user via API:', error);
        return throwError(() => error);
      })
    );
  }


  // Emits whether auth has initialized
  authReady$ = authState(this.auth).pipe(map(user => !!user));

  // Emits whether the user is currently logged in
  isLoggedIn$ = authState(this.auth).pipe(map(user => !!user));


  getUserProfileById(uid: string): Observable<UserData | null> {
    console.log('🔥 Firebase user authenticated:', uid);

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

        // ⏭️ Originator not found → check lender
        return from(getDoc(lenderRef)).pipe(
          map((lenderSnap) => {
            if (lenderSnap.exists()) {
              return {
                id: lenderSnap.id,
                ...(lenderSnap.data() as any),
              } as UserData;
            } else {
              console.warn('❌ No originator or lender profile found.');
              return null;
            }
          })
        );
      }),
      catchError((err) => {
        console.error('❌ Error fetching user profile:', err);
        return of(null);
      })
    );
  }


  updateUserRole(role: 'lender' | 'originator'): Observable<void> {
    const user = this.auth.currentUser;
    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    const collection = `${role}s`; // results in "lenders" or "originators"
    const docRef = doc(this.firestore, `${collection}/${user.uid}`);

    return from(setDoc(docRef, { role }, { merge: true })).pipe(map(() => { }));
  }

  loginWithGoogle(): Observable<User | null> {
    const provider = new GoogleAuthProvider();
    return from(
      signInWithPopup(this.auth, provider).then(result => result.user)
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

  loginWithEmailLink(email: string): Observable<UserCredential> {
    const storedEmail = email || localStorage.getItem('emailForSignIn');
    if (!storedEmail) {
      return throwError(() => new Error('No email stored for sign-in'));
    }

    const url = window.location.href;
    if (!isSignInWithEmailLink(this.auth, url)) {
      throw new Error('Email link is invalid or expired');
    }

    return from(signInWithEmailLink(this.auth, storedEmail, url)).pipe(
      switchMap((userCredential: UserCredential) => {
        window.localStorage.removeItem('emailForSignIn');

        // ✅ Determine redirect URL from localStorage or default to dashboard
        const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
        this.router.navigate([redirectUrl]);
        localStorage.removeItem('redirectUrl');


        // ✅ RETURN full UserCredential
        return of(userCredential);
      }),
      catchError((err) => {
        console.error('Email link sign-in failed', err);
        return throwError(() => err);
      })
    );
  }


  /**
 * ✅ Check if current URL is a sign-in email link
 */
  isEmailSignInLink(): Observable<boolean> {
    const link = window.location.href;
    return of(isSignInWithEmailLink(this.auth, link));
  }


  getAuthStatus(): Observable<boolean> {
    return this.isLoggedIn$;
  }

  /**
   * ✅ Retrieve stored email from localStorage
   */
  getStoredEmail(): string | null {
    return localStorage.getItem('emailForSignIn');
  }

  /**
   * ✅ Log out current user
   */
  logout(): Observable<void> {
    return from(signOut(this.auth));
  }

  getCurrentFirebaseUser(): Observable<User | null> {
    return authState(this.auth); // already imported from '@angular/fire/auth'
  }


  /**
 * ✅ Force reload of the current Firebase user object
 */
  refreshCurrentUser(): Promise<void> {
    const user = this.auth.currentUser;
    if (user) {
      return user.reload();
    }
    return Promise.resolve();
  }

  /**
   * ✅ Get the current Firebase user as an Observable (for use in pipes)
   */
  getFirebaseUser(): Observable<User | null> {
    return new Observable((subscriber) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        subscriber.next(user);
        subscriber.complete();
      });

      // Cleanup on unsubscribe
      return () => unsubscribe();
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
