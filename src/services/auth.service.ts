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
  getDocs,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  query,
  where,
  DocumentReference
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { environment } from '../environments/environment';
import { Observable, from, of, throwError } from 'rxjs';
import { switchMap, map, tap, catchError } from 'rxjs/operators';
import { docData } from 'rxfire/firestore';
import { UserData } from '../models/user-data.model';
import { BehaviorSubject } from 'rxjs';
import { authState, signInWithCustomToken } from '@angular/fire/auth';
import { HttpClient } from '@angular/common/http';
import { FirestoreService } from './firestore.service';
import { httpsCallable } from '@angular/fire/functions';
import { Functions } from '@angular/fire/functions';
import { browserLocalPersistence, setPersistence } from '@firebase/auth';



@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(
    private firestoreService: FirestoreService
  ) { }

  private auth = inject(Auth);
  private router = inject(Router);
  private http = inject(HttpClient);
  private registrationSuccess = false;
  private firestore = inject(Firestore);


  private get db() {
    return this.firestoreService.firestore;
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
authenticateNewUser(email: string, sessionId: string): Observable<void> {
  console.log('🔍 Generating custom token for user:', email);

  const tokenUrl = 'https://us-central1-loanpub.cloudfunctions.net/generateAuthToken';

  return this.http.post<{ token: string }>(
    tokenUrl,
    { email: email.toLowerCase().trim(), sessionId },
    { headers: { 'Content-Type': 'application/json' } }
  ).pipe(
    switchMap((response) => {
      console.log('✅ Custom token received, signing in user...');

      return from(signInWithCustomToken(this.auth, response.token)).pipe(
        tap(() => {
          console.log('✅ User authenticated with custom token');
          localStorage.setItem('isLoggedIn', 'true');
        }),
        map(() => void 0) // Return void
      );
    }),
    catchError((error) => {
      console.error('❌ Error authenticating with custom token:', error);
      return throwError(() => error);
    })
  );
}

  // Emits whether auth has initialized
  authReady$ = authState(this.auth).pipe(map(user => !!user));

  // Emits whether the user is currently logged in
  isLoggedIn$ = authState(this.auth).pipe(map(user => !!user));


  getUserProfile(): Observable<UserData | null> {
  return this.getCurrentFirebaseUser().pipe(
    switchMap(user => {
      if (!user) return of(null);
      const uid = user.uid;

      const lenderRef = doc(this.db, `lenders/${uid}`);
      const originatorRef = doc(this.db, `originators/${uid}`);

      // Check lenders first
      return from(getDoc(lenderRef)).pipe(
        switchMap(lenderSnap => {
          if (lenderSnap.exists()) {
            return of({
              id: lenderSnap.id,
              ...(lenderSnap.data() as any),
            } as UserData);
          }

          // Fallback to originators
          return from(getDoc(originatorRef)).pipe(
            map(originatorSnap => {
              if (originatorSnap.exists()) {
                return {
                  id: originatorSnap.id,
                  ...(originatorSnap.data() as any),
                } as UserData;
              } else {
                console.warn('❌ No lender or originator profile found.');
                return null;
              }
            })
          );
        })
      );
    }),
    catchError(err => {
      console.error('❌ Error fetching user profile:', err);
      return of(null);
    })
  );
}

  checkAccountExists(email: string): Observable<{
    exists: boolean;
    userType?: 'originator' | 'lender';
    userId?: string;
    subscriptionStatus?: string;
    needsPayment?: boolean;
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    console.log('🔍 Checking if account exists for:', normalizedEmail);

    // Check both collections for the email
    const originatorQuery = query(
      collection(this.db, 'originators'),
      where('contactInfo.contactEmail', '==', normalizedEmail)
    );

    const lenderQuery = query(
      collection(this.db, 'lenders'),
      where('contactInfo.contactEmail', '==', normalizedEmail)
    );

    // Check originators first
    return from(getDocs(originatorQuery)).pipe(
      switchMap(originatorSnap => {
        if (!originatorSnap.empty) {
          const doc = originatorSnap.docs[0];
          const data = doc.data();
          const subscriptionStatus = (data as any).subscriptionStatus || 'inactive';

          console.log('✅ Found originator account:', {
            userId: doc.id,
            subscriptionStatus,
            email: normalizedEmail
          });

          return of({
            exists: true,
            userType: 'originator' as const,
            userId: doc.id,
            subscriptionStatus,
            needsPayment: !['active', 'grandfathered'].includes(subscriptionStatus)
          });
        }

        // If not found in originators, check lenders
        return from(getDocs(lenderQuery)).pipe(
          map(lenderSnap => {
            if (!lenderSnap.empty) {
              const doc = lenderSnap.docs[0];
              const data = doc.data();
              const subscriptionStatus = (data as any).subscriptionStatus || 'inactive';

              console.log('✅ Found lender account:', {
                userId: doc.id,
                subscriptionStatus,
                email: normalizedEmail
              });

              return {
                exists: true,
                userType: 'lender' as const,
                userId: doc.id,
                subscriptionStatus,
                needsPayment: !['active', 'grandfathered'].includes(subscriptionStatus)
              };
            }

            console.log('❌ No account found for:', normalizedEmail);
            return {
              exists: false
            };
          })
        );
      }),
      catchError(error => {
        console.error('❌ Error checking account existence:', error);
        return of({
          exists: false,
          error: 'Unable to verify account status'
        });
      })
    );
  }

  updateUserRole(role: 'lender' | 'originator'): Observable<void> {
    const user = this.auth.currentUser;
    if (!user) {
      return throwError(() => new Error('User not authenticated'));
    }

    const collection = `${role}s`; // results in "lenders" or "originators"
    const docRef = doc(this.db, `${collection}/${user.uid}`);

    return from(setDoc(docRef, { role }, { merge: true })).pipe(map(() => { }));
  }

  loginWithGoogle(): Observable<User | null> {
    const provider = new GoogleAuthProvider();
    return from(
      signInWithPopup(this.auth, provider).then(result => result.user)
    );
  }

 sendLoginLink(email: string): Observable<void> {
  const actionCodeSettings = {
    url: `${environment.frontendUrl}/dashboard`,
    handleCodeInApp: true,
  };

  // ✅ ADD THIS LOGGING
  console.log('🔗 Sending magic link with settings:', actionCodeSettings);
  console.log('🔗 Frontend URL from environment:', environment.frontendUrl);

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
      return throwError(() => new Error('Email link is invalid or expired'));
    }

    return from(signInWithEmailLink(this.auth, storedEmail, url)).pipe(
      switchMap((userCredential: UserCredential) => {
        window.localStorage.removeItem('emailForSignIn');

        // ✅ Return the full credential for further handling
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
  initAuthPersistence(): void {
  setPersistence(this.auth, browserLocalPersistence)
    .then(() => console.log('✅ Firebase Auth persistence set to local'))
    .catch(err => console.error('❌ Failed to set Firebase persistence:', err));
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
