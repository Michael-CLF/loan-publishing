// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, of, from, BehaviorSubject } from 'rxjs';
import { map, shareReplay, switchMap, catchError, tap, take } from 'rxjs/operators';
import {
  Auth,
  User,
  UserCredential,
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

  /**
 * Starts listening to user document changes (REAL-TIME)
 */
startUserDocumentListener(): void {
  this._user$.pipe(
    switchMap(user => {
      if (!user?.uid) {
        this.userDocumentSubject.next(null);
        return of(null);
      }

      const userRef = doc(this.firestore, `users/${user.uid}`);
      
      // Use Firestore real-time listener
      return new Observable(observer => {
        // Real-time Firestore listener using onSnapshot
        const unsubscribe = onSnapshot(userRef, 
          (snap) => {
            if (snap.exists()) {
              const userData = { id: snap.id, ...snap.data() };
              console.log('📄 User document updated (real-time):', userData);
              this.userDocumentSubject.next(userData);
              observer.next(userData);
            } else {
              console.log('📄 User document does not exist');
              this.userDocumentSubject.next(null);
              observer.next(null);
            }
          },
          (error) => {
            console.error('Error in user document listener:', error);
            observer.error(error);
          }
        );

        // Cleanup function
        return () => {
          console.log('🔌 Unsubscribing from user document listener');
          unsubscribe();
        };
      });
    })
  ).subscribe();
}

  /**
   * Helper to check if user needs to complete payment
   */
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
  // ---- Logout ----
  logout(): Observable<void> {
    return from(signOut(this.auth));
  }


  getUserProfile(userId?: string): Observable<any | null> {
    return this._user$.pipe(
      tap(user => {
        console.log('GET USER PROFILE CALLED:', {
          currentUserId: user?.uid || 'none',
          requestedUserId: userId || 'using current user',
          timestamp: new Date().toISOString()
        });
      }),
      switchMap(user => {
        const uid = userId || user?.uid;
        if (!uid) return of(null);

        const userRef = doc(this.firestore, `users/${uid}`);

        return from(getDoc(userRef)).pipe(
          map(userSnap => {
            if (userSnap.exists()) {
              console.log('LOADED USER PROFILE:', {
                userId: uid,
                hasData: !!userSnap.data(),
                timestamp: new Date().toISOString()
              });
              return { id: userSnap.id, ...(userSnap.data() as any) };
            }

            console.log('NO PROFILE FOUND:', {
              userId: uid,
              timestamp: new Date().toISOString()
            });
            return null;
          })
        );
      }),
      catchError(err => {
        console.error('Error fetching user profile:', err);
        return of(null);
      })
    );
  }
  updateUserRole(role: 'lender' | 'originator'): Observable<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');
    const ref = doc(this.firestore, `users/${uid}`);
    return from(setDoc(ref, { role }, { merge: true })).pipe(map(() => void 0));
  }
  checkAccountExists(email: string): Observable<{
    exists: boolean;
    userType?: 'originator' | 'lender';
    userId?: string;
    status?: string;
    subscriptionStatus?: string;
    needsPayment?: boolean;
  }> {
    const normalized = email.toLowerCase().trim();

    const usersQ = query(
      collection(this.firestore, 'users'),
      where('email', '==', normalized)
    );

    return from(getDocs(usersQ)).pipe(
      map(snapshot => {
        if (snapshot.empty) {
          return { exists: false };
        }

        const userDoc = snapshot.docs[0];
        const data = userDoc.data() as any;

        return {
          exists: true,
          userType: data.role || 'originator',
          userId: userDoc.id,
          status: data.status,
          subscriptionStatus: data.subscriptionStatus || 'inactive',
          needsPayment: data.status !== 'active',
        };
      }),
      catchError(err => {
        console.error('Error checking account:', err);
        return of({ exists: false });
      })
    );
  }
}