// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, of, from, BehaviorSubject } from 'rxjs';
import { map, shareReplay, switchMap, catchError } from 'rxjs/operators';

import {
  Auth,
  User,
  UserCredential,
  authState,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  browserLocalPersistence,
  setPersistence,
  onAuthStateChanged,
} from '@angular/fire/auth';

import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from '@angular/fire/firestore';

import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  // ---- Core reactive streams ----
  private readonly _user$ = authState(this.auth).pipe(shareReplay(1));
  /** Emits the current Firebase user (or null). */
  users$: Observable<User | null> = this._user$;

  /** Emits true/false when logged in changes. */
  isLoggedIn$: Observable<boolean> = this._user$.pipe(map(u => !!u), shareReplay(1));

  /**
   * Emits "auth init ready" as boolean.
   * We convert the first emission of authState into `true` and share it.
   */
  authReady$: Observable<boolean> = this._user$.pipe(
    map(() => true),
    shareReplay(1)
  );

  /** Convenience getter for the current UID (or null). */
  get currentUserUid(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  // ---- Persistence ----
  initAuthPersistence(): void {
    setPersistence(this.auth, browserLocalPersistence)
      .then(() => console.log('✅ Firebase Auth persistence set to local'))
      .catch(err => console.error('❌ Failed to set Firebase persistence:', err));
  }

  // ---- Compatibility helpers used around the app ----

  /** Old name used around your codebase. */
  getCurrentFirebaseUser(): Observable<User | null> {
    return this._user$;
  }

  /** Force-refresh the current user from Firebase. */
  refreshCurrentUser(): Promise<void> {
    const u = this.auth.currentUser;
    return u ? u.reload() : Promise.resolve();
  }

  /** Observable alias used by some places. */
  getFirebaseUser(): Observable<User | null> {
    return this._user$;
  }

sendLoginLink(email: string): Observable<void> {
  const actionCodeSettings = {
    url: `${environment.frontendUrl}/dashboard`,
    handleCodeInApp: true,
  };

  console.log('🔗 Sending magic link with settings:', actionCodeSettings);

  return from(sendSignInLinkToEmail(this.auth, email, actionCodeSettings)).pipe(
    map(() => {
      // Don't store email in localStorage for this flow
      console.log('✅ Email link sent successfully');
    }),
    catchError((error) => {
      console.error('❌ Error sending login link:', error);
      throw error;
    })
  );
}

  isEmailSignInLink(): Observable<boolean> {
    return of(isSignInWithEmailLink(this.auth, window.location.href));
  }

  getStoredEmail(): string | null {
    return localStorage.getItem('emailForSignIn');
  }

  loginWithEmailLink(email: string): Observable<UserCredential> {
    const stored = email || localStorage.getItem('emailForSignIn');
    if (!stored) {
      throw new Error('No email stored for sign-in');
    }
    const url = window.location.href;
    if (!isSignInWithEmailLink(this.auth, url)) {
      throw new Error('Email link is invalid or expired');
    }
    return from(signInWithEmailLink(this.auth, stored, url)).pipe(
      map((cred) => {
        localStorage.removeItem('emailForSignIn');
        return cred;
      })
    );
  }

  // ---- Google sign-in (used in login component) ----
  loginWithGoogle(): Observable<User | null> {
    const provider = new GoogleAuthProvider();
    return from(signInWithPopup(this.auth, provider)).pipe(map(res => res.user));
  }

  // ---- Logout ----
  logout(): Observable<void> {
    return from(signOut(this.auth));
  }

  /**
 * Check if the current URL is an email sign-in link and handle authentication
 */
handleEmailLinkAuthentication(): Observable<{ success: boolean; user?: User; error?: string }> {
  const url = window.location.href;
  
  if (!isSignInWithEmailLink(this.auth, url)) {
    return of({ success: false, error: 'Not an email link' });
  }

  // Try to get email from URL params or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  let email = urlParams.get('email') || localStorage.getItem('emailForSignIn');

  if (!email) {
    // If no email found, we can't complete the sign-in
    return of({ success: false, error: 'Email not found for sign-in' });
  }

  return from(signInWithEmailLink(this.auth, email, url)).pipe(
    map((userCredential) => {
      // Clear stored email
      localStorage.removeItem('emailForSignIn');
      
      // Clear URL parameters
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      
      return { success: true, user: userCredential.user };
    }),
    catchError((error) => {
      console.error('❌ Email link authentication failed:', error);
      return of({ success: false, error: error.message });
    })
  );
}

  // ---- Firestore profile helpers ----

  /**
   * Returns merged “UserData-like” object by checking lenders then originators.
   * Matches previous behavior your navbar and other places rely on.
   */
  getUserProfile(): Observable<any | null> {
    return this._user$.pipe(
      switchMap(user => {
        if (!user?.uid) return of(null);
        const uid = user.uid;

        const lenderRef = doc(this.firestore, `lenders/${uid}`);
        const originRef = doc(this.firestore, `originators/${uid}`);

        return from(getDoc(lenderRef)).pipe(
          switchMap(lenderSnap => {
            if (lenderSnap.exists()) {
              return of({ id: lenderSnap.id, ...(lenderSnap.data() as any) });
            }
            return from(getDoc(originRef)).pipe(
              map(originSnap => {
                if (originSnap.exists()) {
                  return { id: originSnap.id, ...(originSnap.data() as any) };
                }
                return null;
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

  /** Update role field on the signed-in user's doc. */
  updateUserRole(role: 'lender' | 'originator'): Observable<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');
    const collectionName = role === 'lender' ? 'lenders' : 'originators';
    const ref = doc(this.firestore, `${collectionName}/${uid}`);
    return from(setDoc(ref, { role }, { merge: true })).pipe(map(() => void 0));
  }

  /**
   * Check if an account exists by email across both collections,
   * returning type and subscription info.
   */
  checkAccountExists(email: string): Observable<{
    exists: boolean;
    userType?: 'originator' | 'lender';
    userId?: string;
    subscriptionStatus?: string;
    needsPayment?: boolean;
  }> {
    const normalized = email.toLowerCase().trim();

    const originQ = query(
      collection(this.firestore, 'originators'),
      where('contactInfo.contactEmail', '==', normalized)
    );
    const lenderQ = query(
      collection(this.firestore, 'lenders'),
      where('contactInfo.contactEmail', '==', normalized)
    );

    return from(getDocs(originQ)).pipe(
      switchMap(originSnap => {
        if (!originSnap.empty) {
          const d = originSnap.docs[0];
          const data = d.data() as any;
          const subscriptionStatus = data.subscriptionStatus || 'inactive';
          return of({
            exists: true,
            userType: 'originator' as const,
            userId: d.id,
            subscriptionStatus,
            needsPayment: !['active', 'grandfathered'].includes(subscriptionStatus),
          });
        }
        return from(getDocs(lenderQ)).pipe(
          map(lenderSnap => {
            if (!lenderSnap.empty) {
              const d = lenderSnap.docs[0];
              const data = d.data() as any;
              const subscriptionStatus = data.subscriptionStatus || 'inactive';
              return {
                exists: true,
                userType: 'lender' as const,
                userId: d.id,
                subscriptionStatus,
                needsPayment: !['active', 'grandfathered'].includes(subscriptionStatus),
              };
            }
            return { exists: false };
          })
        );
      }),
      catchError(err => {
        console.error('❌ Error checking account:', err);
        return of({ exists: false });
      })
    );
  }
}
