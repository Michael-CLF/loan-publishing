// src/app/services/auth.service.ts
import { Injectable, inject } from '@angular/core';
import {
  Auth,
  User,
  authState,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
} from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { setPersistence, browserLocalPersistence } from 'firebase/auth';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);

  /**
   * Emits the current Firebase user (or null) and replays the latest value.
   * Use this everywhere for reactive auth state.
   */
  readonly user$: Observable<User | null> = authState(this.auth).pipe(shareReplay(1));

  /** True when a Firebase user is signed in. */
  readonly isLoggedIn$: Observable<boolean> = this.user$.pipe(map(u => !!u));

  /** Convenience getter for the current UID (null if not signed in). */
  get currentUserUid(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

async ensureSignedIn(): Promise<User> {
  // Already signed in? Use that UID.
  if (this.auth.currentUser) {
    return this.auth.currentUser as User;
  }

  // Make sure persistence is local so session survives redirects
  try {
    await setPersistence(this.auth, browserLocalPersistence);
  } catch (e) {
    console.warn('Could not set persistence to local:', e);
  }

  // Create an anonymous session to guarantee a UID
  const cred = await signInAnonymously(this.auth);
  if (!cred.user) {
    throw new Error('Failed to establish an authenticated session.');
  }
  return cred.user;
}

  /** Optional: sign out helper. */
  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
