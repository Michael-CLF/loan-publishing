import { Injectable, inject, PLATFORM_ID, Inject, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { switchMap, tap, catchError, map, filter, first } from 'rxjs/operators';
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

  // Auth ready state
  private authReadySubject = new BehaviorSubject<boolean>(false);
  public authReady$ = this.authReadySubject.asObservable();

  // Action code settings for email link - initialized in constructor
  private actionCodeSettings: ActionCodeSettings;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Initialize with default values
    this.actionCodeSettings = {
      url: 'https://loanpub.firebaseapp.com/login',
      handleCodeInApp: true,
    };

    if (this.isBrowser) {
      console.log('Auth Service initializing...');

      // Check localStorage first
      const storedLoginState = localStorage.getItem('isLoggedIn');
      if (storedLoginState === 'true') {
        // Set initial state from storage while waiting for Firebase
        this.isLoggedInSubject.next(true);
      }

      // Update actionCodeSettings with browser info - do this inside NgZone
      this.ngZone.run(() => {
        this.actionCodeSettings = {
          url: window.location.origin + '/login',
          handleCodeInApp: true,
        };
        console.log('Action code settings URL:', this.actionCodeSettings.url);

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

            // Mark auth as ready
            this.authReadySubject.next(true);
          });
        });
      });
    }
  }

  // Helper to ensure auth is initialized or wait for it
  private waitForAuthInit(): Observable<boolean> {
    return this.authReady$.pipe(
      filter((ready) => ready),
      first()
    );
  }

  // Check if current URL is a sign-in link - FIXED to run inside NgZone
  isEmailSignInLink(): Observable<boolean> {
    if (!this.isBrowser) {
      return of(false);
    }

    // Ensure we're inside NgZone when checking
    return this.ngZone.run(() => {
      return this.waitForAuthInit().pipe(
        map(() => {
          try {
            const isLink = isSignInWithEmailLink(
              this.auth,
              window.location.href
            );
            console.log('Checking if URL is sign-in link:', isLink);
            return isLink;
          } catch (error) {
            console.error('Error checking email sign-in link:', error);
            return false;
          }
        })
      );
    });
  }

  // Send email link for passwordless sign-in - FIXED to run inside NgZone
  sendSignInLink(email: string): Observable<boolean> {
    if (!this.isBrowser) {
      return of(false);
    }

    return this.ngZone.run(() => {
      return this.waitForAuthInit().pipe(
        switchMap(() => {
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
              return of(false);
            })
          );
        })
      );
    });
  }

  // Complete sign-in with email link - FIXED to run inside NgZone
  signInWithEmailLink(email?: string): Observable<User | null> {
    if (!this.isBrowser) {
      return of(null);
    }

    return this.ngZone.run(() => {
      // Get email from storage if not provided
      const storedEmail = localStorage.getItem(this.emailForSignInKey);
      const emailToUse = email || storedEmail;

      if (!emailToUse) {
        console.error('No email available for sign-in with email link');
        return of(null);
      }

      return this.waitForAuthInit().pipe(
        switchMap(() => {
          try {
            // Check if current URL is a sign-in link
            if (isSignInWithEmailLink(this.auth, window.location.href)) {
              console.log(
                'Attempting sign-in with email link for:',
                emailToUse
              );

              return from(
                signInWithEmailLink(this.auth, emailToUse, window.location.href)
              ).pipe(
                tap((userCredential) => {
                  console.log(
                    'Successfully signed in with email link:',
                    userCredential.user?.email
                  );
                  // Clear email from storage
                  localStorage.removeItem(this.emailForSignInKey);
                  // Set login state
                  localStorage.setItem('isLoggedIn', 'true');
                  // Redirect to dashboard immediately
                  const redirectUrl =
                    localStorage.getItem('redirectUrl') || '/dashboard';
                  console.log('Redirecting to:', redirectUrl);
                  this.router.navigate([redirectUrl]);
                  localStorage.removeItem('redirectUrl');
                }),
                map((userCredential) => userCredential.user),
                catchError((error) => {
                  console.error('Error signing in with email link:', error);
                  return of(null);
                })
              );
            } else {
              console.log('URL is not a sign-in link');
              return of(null);
            }
          } catch (error) {
            console.error('Error in signInWithEmailLink:', error);
            return of(null);
          }
        })
      );
    });
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
    if (!this.isBrowser) {
      return of(null as unknown as User);
    }

    return this.ngZone.run(() => {
      return this.waitForAuthInit().pipe(
        switchMap(() => {
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
              ).pipe(
                tap(() => {
                  localStorage.setItem('isLoggedIn', 'true');
                }),
                switchMap(() => of(user))
              );
            })
          );
        })
      );
    });
  }

  // Login a user with password
  login(email: string, password: string): Observable<boolean> {
    if (!this.isBrowser) {
      return of(false);
    }

    return this.ngZone.run(() => {
      return this.waitForAuthInit().pipe(
        switchMap(() => {
          console.log('Attempting login for:', email);

          return from(
            signInWithEmailAndPassword(this.auth, email, password)
          ).pipe(
            tap(() => {
              console.log('Login successful, setting localStorage');
              localStorage.setItem('isLoggedIn', 'true');
            }),
            switchMap(() => {
              // Check for a stored redirect URL
              const redirectUrl =
                localStorage.getItem('redirectUrl') || '/dashboard';
              console.log('Redirecting to:', redirectUrl);
              this.router.navigate([redirectUrl]);
              localStorage.removeItem('redirectUrl');
              return of(true);
            }),
            catchError((error) => {
              console.error('Login error:', error);
              return of(false);
            })
          );
        })
      );
    });
  }

  // Logout the user
  logout(): Observable<void> {
    if (!this.isBrowser) {
      return of(undefined);
    }

    return this.ngZone.run(() => {
      return this.waitForAuthInit().pipe(
        switchMap(() => {
          console.log('Logging out user');

          return from(signOut(this.auth)).pipe(
            tap(() => {
              console.log('Removing isLoggedIn from localStorage');
              localStorage.removeItem('isLoggedIn');
              this.router.navigate(['/login']);
            })
          );
        })
      );
    });
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
