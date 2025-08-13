// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, of, from, BehaviorSubject } from 'rxjs';
import { map, shareReplay, switchMap, catchError, tap, take } from 'rxjs/operators';
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

  // ✅ ADD THESE PROPERTIES for debugging
  private wasLoggedIn = false;
  private lastAuthStateChange = Date.now();

  // ---- Core reactive streams ----
  private readonly _user$ = authState(this.auth).pipe(
    // ✅ ADD THIS DEBUG TAP
    tap(user => {
      const now = Date.now();
      const timeSinceLastChange = now - this.lastAuthStateChange;

      console.log('🔍 AUTH STATE CHANGED:', {
        userId: user?.uid || 'none',
        email: user?.email || 'none',
        wasLoggedIn: this.wasLoggedIn,
        isNowLoggedIn: !!user,
        timeSinceLastChange: `${timeSinceLastChange}ms`,
        timestamp: new Date().toISOString(),
        isNewLogin: !this.wasLoggedIn && !!user,
        isLogout: this.wasLoggedIn && !user
      });

      this.wasLoggedIn = !!user;
      this.lastAuthStateChange = now;
    }),
    shareReplay(1)
  );

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
  const normalized = email.toLowerCase().trim();
  const actionCodeSettings = {
    url: `${environment.frontendUrl}/registration-processing?ml=1&email=${encodeURIComponent(normalized)}`,
    handleCodeInApp: true,
  };

  console.log('🔗 Sending magic link with settings:', actionCodeSettings);

  return from(sendSignInLinkToEmail(this.auth, normalized, actionCodeSettings)).pipe(
    map(() => {
      // Store email for same-device sign-in completion
      localStorage.setItem('emailForSignIn', normalized);

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

  handleEmailLinkAuthentication(): Observable<{ success: boolean; user?: User; error?: string }> {
  const url = window.location.href;
  
  // Check if this is actually a Firebase magic link URL
  if (!isSignInWithEmailLink(this.auth, url)) {
    console.log('📧 Not a Firebase magic link URL, checking if already authenticated');
    return of({ success: false, error: 'Not an email link' });
  }

 // Extract email from the continueUrl parameter in the magic link (different-device case)
let emailFromUrl = '';
try {
  const outer = new URL(url);
  const cont = outer.searchParams.get('continueUrl');
  if (cont) {
    const inner = new URL(decodeURIComponent(cont));
    emailFromUrl = (inner.searchParams.get('email') ?? '').trim();
  }
} catch (e) {
  console.error('Failed to parse continueUrl:', e);
}

// Prefer same-device stored email, else parsed from URL
const stored = (localStorage.getItem('emailForSignIn') ?? '').trim();
const normalized = (stored || emailFromUrl).toLowerCase();

if (!normalized) {
  console.error('❌ No email found for magic link authentication');
  return of({ success: false, error: 'Email not found in link. Please request a new magic link.' });
}

return from(signInWithEmailLink(this.auth, normalized, url)).pipe(

    map((userCredential) => {
      // Clear stored email
      localStorage.removeItem('emailForSignIn');
      
      // Don't clear URL parameters here - let the component handle navigation
      console.log('✅ Magic link authentication successful:', userCredential.user.email);
      
      return { success: true, user: userCredential.user };
    }),
    catchError((error) => {
      console.error('❌ Email link authentication failed:', error);
      localStorage.removeItem('emailForSignIn');
      return of({ success: false, error: error.message });
    })
  );
}

  getUserProfile(): Observable<any | null> {
    return this._user$.pipe(
      // ✅ ADD THIS DEBUG TAP
      tap(user => {
        console.log('🔍 GET USER PROFILE CALLED:', {
          userId: user?.uid || 'none',
          timestamp: new Date().toISOString()
        });
      }),
      switchMap(user => {
        if (!user?.uid) return of(null);
        const uid = user.uid;

        const lenderRef = doc(this.firestore, `lenders/${uid}`);
        const originRef = doc(this.firestore, `originators/${uid}`);

        return from(getDoc(lenderRef)).pipe(
          switchMap(lenderSnap => {
            if (lenderSnap.exists()) {
              // ✅ ADD THIS DEBUG LOG
              console.log('🔍 LOADED LENDER PROFILE:', {
                userId: uid,
                hasData: !!lenderSnap.data(),
                timestamp: new Date().toISOString()
              });
              return of({ id: lenderSnap.id, ...(lenderSnap.data() as any) });
            }
            return from(getDoc(originRef)).pipe(
              map(originSnap => {
                if (originSnap.exists()) {
                  // ✅ ADD THIS DEBUG LOG
                  console.log('🔍 LOADED ORIGINATOR PROFILE:', {
                    userId: uid,
                    hasData: !!originSnap.data(),
                    timestamp: new Date().toISOString()
                  });
                  return { id: originSnap.id, ...(originSnap.data() as any) };
                }

                // ✅ ADD THIS DEBUG LOG
                console.log('🔍 NO PROFILE FOUND:', {
                  userId: uid,
                  timestamp: new Date().toISOString()
                });
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

  
checkAccountExists(email: string): Observable<{
    exists: boolean;
    userType?: 'originator' | 'lender';
    userId?: string;
    subscriptionStatus?: string;
    needsPayment?: boolean;
  }> {
    const normalized = email.toLowerCase().trim();

    // Check both possible email field locations
    const originQ = query(
      collection(this.firestore, 'originators'),
      where('email', '==', normalized)
    );
    const originContactQ = query(
      collection(this.firestore, 'originators'),
      where('contactInfo.contactEmail', '==', normalized)
    );
    const lenderQ = query(
      collection(this.firestore, 'lenders'),
      where('email', '==', normalized)
    );
    const lenderContactQ = query(
      collection(this.firestore, 'lenders'),
      where('contactInfo.contactEmail', '==', normalized)
    );

  return from(Promise.all([
      getDocs(originQ),
      getDocs(originContactQ),
      getDocs(lenderQ),
      getDocs(lenderContactQ)
    ])).pipe(
      map(([originSnap, originContactSnap, lenderSnap, lenderContactSnap]) => {
        // Check originators (either email field)
        const originDoc = !originSnap.empty ? originSnap.docs[0] : 
                         !originContactSnap.empty ? originContactSnap.docs[0] : null;
        
        if (originDoc) {
          const data = originDoc.data() as any;
          const subscriptionStatus = data.subscriptionStatus || 'inactive';
          return {
            exists: true,
            userType: 'originator' as const,
            userId: originDoc.id,
            subscriptionStatus,
            needsPayment: !['active', 'grandfathered'].includes(subscriptionStatus),
          };
        }

        // Check lenders (either email field)
        const lenderDoc = !lenderSnap.empty ? lenderSnap.docs[0] : 
                         !lenderContactSnap.empty ? lenderContactSnap.docs[0] : null;
        
        if (lenderDoc) {
          const data = lenderDoc.data() as any;
          const subscriptionStatus = data.subscriptionStatus || 'inactive';
          return {
            exists: true,
            userType: 'lender' as const,
            userId: lenderDoc.id,
            subscriptionStatus,
            needsPayment: !['active', 'grandfathered'].includes(subscriptionStatus),
          };
        }

        return { exists: false };
      }),
      catchError(err => {
        console.error('❌ Error checking account:', err);
        return of({ exists: false });
      })
    );
  }
}