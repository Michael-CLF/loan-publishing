import { Injectable, inject, PLATFORM_ID, Inject } from '@angular/core';
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

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private firestoreService = inject(FirestoreService);
  private router = inject(Router);
  private isBrowser: boolean;

  // Email for email link authentication
  private emailForSignInKey = 'emailForSignIn';

  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  // User data observable
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  // Action code settings for email link - initialized in constructor
  private actionCodeSettings: ActionCodeSettings;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Initialize actionCodeSettings safely
    this.actionCodeSettings = {
      // URL you want to redirect to after email link sign-in
      url: this.isBrowser
        ? window.location.origin + '/login/verify'
        : 'https://yourdomain.com/login/verify',
      handleCodeInApp: true,
    };

    // Only subscribe to auth state in browser environment
    if (this.isBrowser) {
      // Subscribe to Firebase auth state changes
      authState(this.auth).subscribe((user) => {
        this.userSubject.next(user);
        this.isLoggedInSubject.next(!!user);

        if (user) {
          localStorage.setItem('isLoggedIn', 'true');
        } else {
          localStorage.removeItem('isLoggedIn');
        }
      });
    }
  }

  // Send email link for passwordless sign-in
  sendSignInLink(email: string): Observable<boolean> {
    if (!this.isBrowser) {
      return of(false); // Can't send email links in SSR
    }

    return from(
      sendSignInLinkToEmail(this.auth, email, this.actionCodeSettings)
    ).pipe(
      tap(() => {
        // Save the email locally to remember the user when they return
        localStorage.setItem(this.emailForSignInKey, email);
      }),
      map(() => true),
      catchError((error) => {
        console.error('Error sending sign-in link:', error);
        return of(false);
      })
    );
  }

  // Complete sign-in with email link
  signInWithEmailLink(email?: string): Observable<User | null> {
    if (!this.isBrowser) {
      return of(null); // Can't sign in with email link in SSR
    }

    // Get email from storage if not provided
    const storedEmail = localStorage.getItem(this.emailForSignInKey);
    const emailToUse = email || storedEmail;

    if (!emailToUse) {
      return of(null);
    }

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
  }

  // Check if current URL is a sign-in link
  isEmailSignInLink(): boolean {
    if (!this.isBrowser) {
      return false; // Can't check email sign-in link in SSR
    }
    return isSignInWithEmailLink(this.auth, window.location.href);
  }

  // Get stored email for sign-in
  getStoredEmail(): string | null {
    if (!this.isBrowser) {
      return null; // Can't get stored email in SSR
    }
    return localStorage.getItem(this.emailForSignInKey);
  }

  // Register a user with password (your existing method)
  registerUser(
    email: string,
    password: string,
    userData: any
  ): Observable<User> {
    return from(
      createUserWithEmailAndPassword(this.auth, email, password)
    ).pipe(
      switchMap((userCredential) => {
        const user = userCredential.user;

        // Store additional user data in Firestore (NOT the password)
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
        ).pipe(
          // Return the user object after saving to Firestore
          switchMap(() => of(user))
        );
      })
    );
  }

  // Login a user with password (your existing method)
  login(email: string, password: string): Observable<boolean> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      // Map the user credential to a success boolean
      switchMap(() => of(true)),
      catchError((error) => {
        console.error('Login error:', error);
        return of(false);
      })
    );
  }

  // Register a new user with just email (for email link authentication)
  registerWithEmailOnly(email: string, userData: any): Observable<boolean> {
    if (!this.isBrowser) {
      return of(false); // Can't register with email only in SSR
    }

    // First, send the email link
    return this.sendSignInLink(email).pipe(
      tap((success) => {
        if (success) {
          // Also store user data temporarily
          localStorage.setItem('pendingUserData', JSON.stringify(userData));
        }
      })
    );
  }

  // Complete registration after email verification
  completeRegistration(): Observable<User | null> {
    if (!this.isBrowser) {
      return of(null); // Can't complete registration in SSR
    }

    const pendingUserData = localStorage.getItem('pendingUserData');

    if (!pendingUserData) {
      return of(null);
    }

    return this.getCurrentUser().pipe(
      switchMap((user) => {
        if (user) {
          const userData = JSON.parse(pendingUserData);

          // Store user data in Firestore
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
              // Clear stored data
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

  // Logout the user (your existing method)
  logout(): Observable<void> {
    if (!this.isBrowser) {
      return of(undefined); // Can't logout in SSR
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
