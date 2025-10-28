// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, of, from, BehaviorSubject } from 'rxjs';
import { map, shareReplay, switchMap, catchError, tap, take } from 'rxjs/operators';
import {
  Auth,
  User,
  signInWithCustomToken,
  authState,
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
  onSnapshot
} from '@angular/fire/firestore';

import { environment } from '../environments/environment';
import { UserActivityService } from './user-activity.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly userActivityService = inject(UserActivityService);


  private wasLoggedIn = false;
  private lastAuthStateChange = Date.now();

  // ---- Core reactive streams ----
  private readonly _user$ = authState(this.auth).pipe(
    tap(user => {
      const now = Date.now();
      const timeSinceLastChange = now - this.lastAuthStateChange;

      const isNewLogin = !this.wasLoggedIn && !!user;
      const isLogout = this.wasLoggedIn && !user;

      console.log('AUTH STATE CHANGED:', {
        userId: user?.uid || 'none',
        email: user?.email || 'none',
        wasLoggedIn: this.wasLoggedIn,
        isNowLoggedIn: !!user,
        timeSinceLastChange: `${timeSinceLastChange}ms`,
        timestamp: new Date().toISOString(),
        isNewLogin,
        isLogout
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
  /**
 * Real-time user document listener with Signal
 * Listens to Firestore user document for status changes
 */
  private userDocumentSubject = new BehaviorSubject<any | null>(null);
  userDocument$ = this.userDocumentSubject.asObservable();

  startUserDocumentListener(): void {
    this._user$.pipe(
      switchMap(user => {
        if (!user?.uid) {
          this.userDocumentSubject.next(null);
          return of(null);
        }

        const uid = user.uid;

        // ✅ Try lenders first, then originators
        return new Observable(observer => {
          let unsubscribe: (() => void) | null = null;

          // Check lender first
          const lenderRef = doc(this.firestore, `lenders/${uid}`);

          getDoc(lenderRef).then(lenderSnap => {
            if (lenderSnap.exists()) {
              // Listen to lender document
              unsubscribe = onSnapshot(lenderRef,
                (snap) => {
                  if (snap.exists()) {
                    const userData = { id: snap.id, ...snap.data() };
                    console.log('📄 Lender document updated (real-time):', userData);
                    this.userDocumentSubject.next(userData);
                    observer.next(userData);
                  }
                },
                (error) => observer.error(error)
              );
            } else {
              // Try originator
              const originatorRef = doc(this.firestore, `originators/${uid}`);

              unsubscribe = onSnapshot(originatorRef,
                (snap) => {
                  if (snap.exists()) {
                    const userData = { id: snap.id, ...snap.data() };
                    console.log('📄 Originator document updated (real-time):', userData);
                    this.userDocumentSubject.next(userData);
                    observer.next(userData);
                  } else {
                    console.log('📄 No user document found');
                    this.userDocumentSubject.next(null);
                    observer.next(null);
                  }
                },
                (error) => observer.error(error)
              );
            }
          });

          return () => {
            if (unsubscribe) {
              console.log('🔌 Unsubscribing from user document listener');
              unsubscribe();
            }
          };
        });
      })
    ).subscribe();
  }

  userNeedsPayment$: Observable<boolean> = this.userDocument$.pipe(
    map(doc => {
      if (!doc) return false;
      return doc.status === 'pending_payment' && doc.emailVerified === true;
    })
  );

  /**
   * Helper to check if user is fully active
   */
  userIsActive$: Observable<boolean> = this.userDocument$.pipe(
    map(doc => {
      if (!doc) return false;
      return doc.status === 'active' && doc.paymentStatus === 'paid';
    })
  );

  /** Convenience getter for the current UID (or null). */
  get currentUserUid(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  // ---- Persistence ----
  initAuthPersistence(): void {
    setPersistence(this.auth, browserLocalPersistence)
      .then(() => console.log('Firebase Auth persistence set to local'))
      .catch(err => console.error('Failed to set Firebase persistence:', err));
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

  loginWithGoogle(): Observable<User | null> {
    const provider = new GoogleAuthProvider();

    // CRITICAL: Force account selection every time
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    return from(signInWithPopup(this.auth, provider)).pipe(
      map(res => res.user),
      tap(user => {
        if (user?.uid) {
          console.log('AuthService: Google login completed, user state will update via authState listener');
        }
      })
    );
  }
  /**
 * Sign in with Firebase customToken
 * Used after OTP verification
 */
  signInWithCustomToken(customToken: string): Observable<any> {
    return from(signInWithCustomToken(this.auth, customToken)).pipe(
      tap((result) => {
        console.log('✅ Signed in with custom token:', result.user.uid);
      }),
      catchError((error) => {
        console.error('❌ Error signing in with custom token:', error);
        throw error;
      })
    );
  }
  // ---- Logout ----
  logout(): Observable<void> {
    return from(signOut(this.auth));
  }

 // ========================================
// FIX 1: getUserProfile() - LINE 147
// ========================================
getUserProfile(userId?: string): Observable<any | null> {
  return this._user$.pipe(
    tap(user => {
      console.log('🔍 getUserProfile called for UID:', userId || user?.uid);
    }),
    switchMap(user => {
      const uid = userId || user?.uid;
      if (!uid) {
        console.log('❌ No UID available');
        return of(null);
      }

      // Check lenders collection first
      const lenderRef = doc(this.firestore, `lenders/${uid}`);
      
      return from(getDoc(lenderRef)).pipe(
        switchMap(lenderSnap => {
          if (lenderSnap.exists()) {
            console.log('✅ Found user in LENDERS collection');
            return of({ id: lenderSnap.id, ...lenderSnap.data() });
          }

          // Not in lenders, check originators
          console.log('🔍 Not in lenders, checking originators...');
          const originatorRef = doc(this.firestore, `originators/${uid}`);
          
          return from(getDoc(originatorRef)).pipe(
            map(originatorSnap => {
              if (originatorSnap.exists()) {
                console.log('✅ Found user in ORIGINATORS collection');
                return { id: originatorSnap.id, ...originatorSnap.data() };
              }

              console.log('❌ User not found in lenders OR originators');
              return null;
            })
          );
        }),
        catchError(err => {
          console.error('❌ Error in getUserProfile:', err);
          return of(null);
        })
      );
    })
  );
}

// ========================================
// FIX 2: checkAccountExists() - LINE 180
// ========================================
checkAccountExists(email: string): Observable<{
  exists: boolean;
  userType?: 'originator' | 'lender';
  userId?: string;
  status?: string;
  subscriptionStatus?: string;
  needsPayment?: boolean;
}> {
  const normalized = email.toLowerCase().trim();
  console.log('🔍 Checking account exists for:', normalized);

  // Check lenders first
  const lendersQ = query(
    collection(this.firestore, 'lenders'),
    where('contactInfo.contactEmail', '==', normalized)
  );

  return from(getDocs(lendersQ)).pipe(
    switchMap(lenderSnapshot => {
      if (!lenderSnapshot.empty) {
        const userDoc = lenderSnapshot.docs[0];
        const data = userDoc.data() as any;
        console.log('✅ Found in LENDERS:', userDoc.id);
        
        return of({
          exists: true,
          userType: 'lender' as const,
          userId: userDoc.id,
          status: data.status,
          subscriptionStatus: data.subscriptionStatus || 'inactive',
          needsPayment: data.subscriptionStatus !== 'active' && data.subscriptionStatus !== 'grandfathered',
        });
      }

      // Not in lenders, check originators
      console.log('🔍 Not in lenders, checking originators...');
      const originatorsQ = query(
        collection(this.firestore, 'originators'),
        where('contactInfo.contactEmail', '==', normalized)
      );

      return from(getDocs(originatorsQ)).pipe(
        map(originatorSnapshot => {
          if (!originatorSnapshot.empty) {
            const userDoc = originatorSnapshot.docs[0];
            const data = userDoc.data() as any;
            console.log('✅ Found in ORIGINATORS:', userDoc.id);
            
            return {
              exists: true,
              userType: 'originator' as const,
              userId: userDoc.id,
              status: data.status,
              subscriptionStatus: data.subscriptionStatus || 'inactive',
              needsPayment: data.subscriptionStatus !== 'active' && data.subscriptionStatus !== 'grandfathered',
            };
          }

          console.log('❌ Account not found in lenders OR originators');
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

  updateUserRole(role: 'lender' | 'originator'): Observable<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');

    // ✅ Update in the correct collection based on role
    const collectionName = role === 'lender' ? 'lenders' : 'originators';
    const ref = doc(this.firestore, `${collectionName}/${uid}`);

    return from(setDoc(ref, { role }, { merge: true })).pipe(map(() => void 0));
  }
}