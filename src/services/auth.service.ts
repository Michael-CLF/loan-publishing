// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import {  map, switchMap, catchError, shareReplay, take  } from 'rxjs/operators';
import {
  Firestore,
  doc,
  getDoc,
} from '@angular/fire/firestore';
import {
  Auth,
  authState,
  User,
  UserCredential,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  browserLocalPersistence,
  setPersistence,
} from '@angular/fire/auth';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);


  /** Emits the current Firebase user (or null) and replays latest value. */
readonly users$: Observable<User | null> = authState(this.auth).pipe(shareReplay(1));

/** True when a Firebase user is signed in. */
readonly isLoggedIn$: Observable<boolean> = this.users$.pipe(map(u => !!u));

/** Convenience getter for current UID (null if signed out). */
getCurrentUserUid(): string | null {
  return this.auth.currentUser?.uid ?? null;
}

/** COMPAT: what your code calls in multiple places */
getCurrentFirebaseUser(): Observable<User | null> {
  return this.users$;
}

/** COMPAT: pricing.component.ts calls this */
getAuthStatus(): Observable<boolean> {
  return this.isLoggedIn$;
}

/** COMPAT: main.ts calls this at bootstrap */
isEmailSignInLink(): Observable<boolean> {
  const link = typeof window !== 'undefined' ? window.location.href : '';
  return of(isSignInWithEmailLink(this.auth, link));
}

/** COMPAT: main.ts calls this */
getStoredEmail(): string | null {
  return localStorage.getItem('emailForSignIn');
}

/** COMPAT: main.ts calls this */
loginWithEmailLink(email: string): Observable<UserCredential> {
  const link = typeof window !== 'undefined' ? window.location.href : '';
  if (!email) {
    return from(Promise.reject(new Error('No email provided for sign-in')));
  }
  if (!isSignInWithEmailLink(this.auth, link)) {
    return from(Promise.reject(new Error('Email link is invalid or expired')));
  }
  return from(signInWithEmailLink(this.auth, email, link));
}

/** COMPAT: many places treat logout as Observable so keep that shape */
logout(): Observable<void> {
  return from(signOut(this.auth));
}

/** COMPAT: navbar & others call this to load a Firestore profile doc */
getUserProfile(): Observable<any | null> {
  return this.getCurrentFirebaseUser().pipe(
    take(1),
    switchMap(user => {
      if (!user?.uid) return of(null);
      const uid = user.uid;

      const lenderRef = doc(this.firestore, `lenders/${uid}`);
      const originatorRef = doc(this.firestore, `originators/${uid}`);

      return from(getDoc(lenderRef)).pipe(
        switchMap(lenderSnap => {
          if (lenderSnap.exists()) {
            return of({ id: lenderSnap.id, ...(lenderSnap.data() as any) });
          }
          return from(getDoc(originatorRef)).pipe(
            map(originatorSnap => {
              if (originatorSnap.exists()) {
                return { id: originatorSnap.id, ...(originatorSnap.data() as any) };
              }
              return null;
            })
          );
        })
      );
    }),
    catchError(err => {
      console.error('getUserProfile error:', err);
      return of(null);
    })
  );
}

/** Keep this around so sessions survive redirects (optional but nice). */
async ensureSignedIn(): Promise<User> {
  // If already signed in, use that user.
  if (this.auth.currentUser) return this.auth.currentUser as User;

  try {
    await setPersistence(this.auth, browserLocalPersistence);
  } catch (e) {
    console.warn('Could not set persistence to local:', e);
  }

  // No anonymous sign-in here (passwordless app) — just reject.
  throw new Error('Not signed in');
}

  /**
   * Emits the current Firebase user (or null) and replays the latest value.
   * Use this everywhere for reactive auth state.
   */
  readonly user$: Observable<User | null> = authState(this.auth).pipe(shareReplay(1));

  /** Convenience getter for the current UID (null if not signed in). */
  get currentUserUid(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }
}
