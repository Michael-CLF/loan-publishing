import { Injectable, inject, PLATFORM_ID, Inject, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { switchMap, tap, catchError, map } from 'rxjs/operators';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  authState,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  ActionCodeSettings,
} from '@angular/fire/auth';
import { FirestoreService } from './firestore.service';
import { Router } from '@angular/router';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private firestoreService = inject(FirestoreService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private isBrowser: boolean;

  // Email for email link authentication
  private emailForSignInKey = 'emailForSignIn';

  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  // User data observable
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  // Action code settings for email link - initialized in constructor
  private actionCodeSettings: ActionCodeSettings = {
    url: 'https://loanpub.firebaseapp.com/login/verify', // Default value
    handleCodeInApp: true,
  };

  // Track if auth is initialized
  private authInitialized = false;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      console.log(
        'Firebase Config Check:',
        environment.firebase.apiKey ? 'API Key exists' : 'API Key missing',
        'Auth Domain:',
        environment.firebase.authDomain
      );

      // Check localStorage first
      const storedLoginState = localStorage.getItem('isLoggedIn');
      if (storedLoginState === 'true') {
        // Set initial state from storage while waiting for Firebase
        this.isLoggedInSubject.next(true);
      }

      // Update actionCodeSettings with browser info
      this.actionCodeSettings = {
        url:
          window.location.protocol +
          '//' +
          window.location.hostname +
          '/login/verify',
        handleCodeInApp: true,
      };

      // Initialize the auth state inside NgZone to ensure proper change detection
      this.ngZone.run(() => {
        // Wait until auth is fully available
        setTimeout(() => {
          // Mark auth as initialized
          this.authInitialized = true;

          // Subscribe to Firebase auth state
          authState(this.auth).subscribe((user) => {
            console.log(
              'Firebase auth state changed:',
              user ? 'User logged in' : 'No user'
            );

            this.ngZone.run(() => {
              this.userSubject.next(user);
              this.isLoggedInSubject.next(!!user);

              if (user) {
                localStorage.setItem('isLoggedIn', 'true');
              } else {
                localStorage.removeItem('isLoggedIn');
              }
            });
          });
        }, 100); // Small delay to ensure Firebase is ready
      });
    }
  }

  // Helper to ensure auth is initialized
  private ensureAuthInitialized(): boolean {
    if (!this.isBrowser || !this.authInitialized) {
      console.warn('Auth not initialized yet');
      return false;
    }
    return true;
  }

  // Send email link for passwordless sign-in
  sendSignInLink(email: string): Observable<boolean> {
    if (!this.ensureAuthInitialized()) {
      return of(false);
    }

    console.log(
      'Sending sign-in link to:',
      email,
      'with settings:',
      this.actionCodeSettings
    );

    return from(
      sendSignInLinkToEmail(this.auth, email, this.actionCodeSettings)
    ).pipe(
      tap(() => {
        localStorage.setItem(this.emailForSignInKey, email);
      }),
      map(() => true),
      catchError((error) => {
        console.error('Error sending sign-in link:', error);
        throw error;
      })
    );
  }

  // Check if current URL is a sign-in link
  isEmailSignInLink(): boolean {
    if (!this.ensureAuthInitialized()) {
      return false;
    }

    try {
      return isSignInWithEmailLink(this.auth, window.location.href);
    } catch (error) {
      console.error('Error checking email sign-in link:', error);
      return false;
    }
  }

  // Complete sign-in with email link
  signInWithEmailLink(email?: string): Observable<User | null> {
    if (!this.ensureAuthInitialized()) {
      return of(null);
    }

    // Get email from storage if not provided
    const storedEmail = localStorage.getItem(this.emailForSignInKey);
    const emailToUse = email || storedEmail;

    if (!emailToUse) {
      return of(null);
    }

    try {
      // Check if current URL is a sign-in link
      if (isSignInWithEmailLink(this.auth, window.location.href)) {
        return from(
          signInWithEmailLink(this.auth, emailToUse, window.location.href)
        ).pipe(
          tap(() => {
            // Clear email from storage
            localStorage.removeItem(this.emailForSignInKey);
          }),
          map((userCredential) => userCredential.user),
          catchError((error) => {
            console.error('Error signing in with email link:', error);
            return of(null);
          })
        );
      } else {
        return of(null);
      }
    } catch (error) {
      console.error('Error in signInWithEmailLink:', error);
      return of(null);
    }
  }

  // Get stored email for sign-in
  getStoredEmail(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    return localStorage.getItem(this.emailForSignInKey);
  }

  // Register a user with password
  registerUser(
    email: string,
    password: string,
    userData: any
  ): Observable<User> {
    if (!this.ensureAuthInitialized()) {
      return of(null as unknown as User);
    }

    return from(
      createUserWithEmailAndPassword(this.auth, email, password)
    ).pipe(
      switchMap((userCredential) => {
        const user = userCredential.user;

        return from(
          this.firestoreService.addDocument('users', {
            uid: user.uid,
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            company: userData.company,
            phone: userData.phone,
            city: userData.city,
            state: userData.state,
            createdAt: new Date(),
          })
        ).pipe(switchMap(() => of(user)));
      })
    );
  }

  // Login a user with password
  login(email: string, password: string): Observable<boolean> {
    if (!this.ensureAuthInitialized()) {
      return of(false);
    }

    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(() => of(true)),
      catchError((error) => {
        console.error('Login error:', error);
        return of(false);
      })
    );
  }

  // Register a new user with just email (for email link authentication)
  registerWithEmailOnly(email: string, userData: any): Observable<boolean> {
    if (!this.ensureAuthInitialized()) {
      return of(false);
    }

    return this.sendSignInLink(email).pipe(
      tap((success) => {
        if (success) {
          localStorage.setItem('pendingUserData', JSON.stringify(userData));
        }
      })
    );
  }

  // Complete registration after email verification
  completeRegistration(): Observable<User | null> {
    if (!this.ensureAuthInitialized()) {
      return of(null);
    }

    const pendingUserData = localStorage.getItem('pendingUserData');

    if (!pendingUserData) {
      return of(null);
    }

    return this.getCurrentUser().pipe(
      switchMap((user) => {
        if (user) {
          const userData = JSON.parse(pendingUserData);

          return from(
            this.firestoreService.addDocument('users', {
              uid: user.uid,
              firstName: userData.firstName,
              lastName: userData.lastName,
              email: user.email,
              company: userData.company,
              phone: userData.phone,
              city: userData.city,
              state: userData.state,
              createdAt: new Date(),
            })
          ).pipe(
            tap(() => {
              localStorage.removeItem('pendingUserData');
            }),
            map(() => user)
          );
        }

        return of(null);
      }),
      catchError(() => of(null))
    );
  }

  // Logout the user
  logout(): Observable<void> {
    if (!this.ensureAuthInitialized()) {
      return of(undefined);
    }

    return from(signOut(this.auth)).pipe(
      tap(() => {
        localStorage.removeItem('isLoggedIn');
      })
    );
  }

  getAuthStatus(): Observable<boolean> {
    return this.isLoggedIn$;
  }

  // Get the current user
  getCurrentUser(): Observable<User | null> {
    return this.user$;
  }

  // Get user profile data from Firestore
  getUserProfile(uid: string): Observable<any> {
    return this.firestoreService.getDocument<any>(`users/${uid}`);
  }
}
