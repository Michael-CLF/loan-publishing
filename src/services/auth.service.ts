// auth.service.ts
import {
  Injectable,
  inject,
  PLATFORM_ID,
  Inject,
  NgZone,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, from, of, Subscription } from 'rxjs';
import {
  switchMap,
  tap,
  catchError,
  map,
  filter,
  first,
  take,
} from 'rxjs/operators';
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
  onIdTokenChanged,
} from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { FirestoreService } from './firestore.service';
import { Router } from '@angular/router';
import { reload } from '@angular/fire/auth';
import { UserData } from '../models/user-data.model'; // or your correct path

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  // Services
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private firestoreService = inject(FirestoreService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private isBrowser: boolean;

  // Auth state
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  // User state
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  // User profile
  private userProfileSubject = new BehaviorSubject<any | null>(null);
  public userProfile$ = this.userProfileSubject.asObservable();

  // Auth initialization state
  private authReadySubject = new BehaviorSubject<boolean>(false);
  public authReady$ = this.authReadySubject.asObservable();

  // Email authentication
  private emailForSignInKey = 'emailForSignIn';
  private actionCodeSettings: ActionCodeSettings;

  // Subscriptions
  private authStateSubscription: Subscription | null = null;
  private tokenRefreshSubscription: Subscription | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);

    // Default action code settings - will be updated with correct URL in browser
    this.actionCodeSettings = {
      url: 'https://loanpub.firebaseapp.com/login',
      handleCodeInApp: true,
    };

    if (this.isBrowser) {
      console.log('AuthService: Initializing in browser environment');

      // Update action code settings with current origin
      this.ngZone.run(() => {
        this.actionCodeSettings = {
          url: window.location.origin + '/login',
          handleCodeInApp: true,
        };
      });

      // Initialize auth state
      this.initializeAuthState();
    } else {
      console.log(
        'AuthService: Running in server environment, skipping auth initialization'
      );
    }
  }
  authState(): Observable<User | null> {
    return authState(this.auth);
  }

  refreshCurrentUser(): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      return reload(currentUser);
    }
    return Promise.resolve();
  }

  ngOnDestroy() {
    // Clean up subscriptions
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }

    if (this.tokenRefreshSubscription) {
      this.tokenRefreshSubscription.unsubscribe();
    }

    console.log('AuthService: Destroyed and cleaned up subscriptions');
  }

  /**
   * Primary method to initialize authentication state
   * Sets up Firebase auth listeners and syncs with local state
   */
  private initializeAuthState(): void {
    console.log('AuthService: Initializing auth state');

    // Set up Firebase auth state listener
    this.authStateSubscription = authState(this.auth).subscribe((user) => {
      this.ngZone.run(() => {
        const wasLoggedIn = this.isLoggedInSubject.value;
        const isNowLoggedIn = !!user;

        console.log(
          `AuthService: Auth state changed - was: ${wasLoggedIn}, now: ${isNowLoggedIn}`
        );
        console.log('AuthService: Current user email:', user?.email);

        // Update user subject
        this.userSubject.next(user);

        // Update login state
        this.isLoggedInSubject.next(isNowLoggedIn);

        if (isNowLoggedIn) {
          // User is logged in
          localStorage.setItem('isLoggedIn', 'true');

          // Fetch and store user profile
          this.loadUserProfile(user.uid);

          // Run migration if needed
          this.migrateUserDocument().subscribe((success) => {
            if (success) {
              console.log('AuthService: User document migration successful');
              this.loadUserProfile(user.uid);
            }
          });
        } else {
          // User is logged out
          localStorage.removeItem('isLoggedIn');
          this.userProfileSubject.next(null);
        }

        // Mark auth as initialized
        this.authReadySubject.next(true);
      });
    });

    // Set up token refresh listener
    this.tokenRefreshSubscription = from(
      new Observable<User | null>((observer) => {
        return onIdTokenChanged(
          this.auth,
          (user) => observer.next(user),
          (error) => observer.error(error)
        );
      })
    ).subscribe((user) => {
      console.log('AuthService: ID token changed, user:', !!user);
      // Token has been refreshed, no additional action needed
      // Firebase handles the refresh automatically
    });
  }

  /**
   * Loads user profile from Firestore and updates the profile subject
   */
  // Add this method to your AuthService

  loadUserProfile(uid: string): void {
    console.log('AuthService: Loading user profile for UID:', uid);

    // First check if user is a lender
    this.firestoreService
      .getDocumentWithLogging<any>(`lenders/${uid}`)
      .pipe(take(1))
      .subscribe({
        next: (profile) => {
          if (profile) {
            console.log(
              'AuthService: User profile loaded from lenders collection:',
              profile
            );
            this.userProfileSubject.next(profile);
          } else {
            // If not found in lenders, check users collection
            this.firestoreService
              .getDocumentWithLogging<any>(`users/${uid}`)
              .pipe(take(1))
              .subscribe({
                next: (userProfile) => {
                  if (userProfile) {
                    console.log(
                      'AuthService: User profile loaded from users collection:',
                      userProfile
                    );
                    this.userProfileSubject.next(userProfile);
                  } else {
                    console.error(
                      'AuthService: No user profile found in any collection'
                    );
                    this.userProfileSubject.next(null);
                  }
                },
                error: (error) => {
                  console.error(
                    'AuthService: Error loading user profile:',
                    error
                  );
                  this.userProfileSubject.next(null);
                },
              });
          }
        },
        error: (error) => {
          console.error('AuthService: Error loading lender profile:', error);
          this.userProfileSubject.next(null);
        },
      });
  }

  /**
   * Helper method to wait for auth initialization
   */
  private waitForAuthInit(): Observable<boolean> {
    return this.authReady$.pipe(
      filter((ready) => ready),
      first()
    );
  }

  /**
   * Helper method to determine if we should redirect after authentication
   */
  private shouldRedirect(): boolean {
    // Only redirect if we're on the login page or login verification page
    const currentPath = this.router.url;
    return currentPath === '/login' || currentPath.includes('/login/verify');
  }

  /**
   * Check authentication state and redirect to login if necessary
   */
  checkAuthAndRedirect(): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    return this.waitForAuthInit().pipe(
      switchMap(() => this.isLoggedIn$),
      take(1),
      switchMap((isLoggedIn) => {
        if (!isLoggedIn) {
          // Get current URL to store for after login
          if (!this.router.url.includes('/login')) {
            localStorage.setItem('redirectUrl', this.router.url);
          }

          // Only redirect if not already on login page
          if (!this.router.url.includes('/login')) {
            this.router.navigate(['/login']);
          }
        } else if (isLoggedIn && this.router.url.includes('/login')) {
          // User is logged in but on login page, redirect to dashboard
          console.log('User already authenticated, redirecting to dashboard');
          this.router.navigate(['/dashboard']);
        }
        return of(isLoggedIn);
      })
    );
  }

  /**
   * Check if current URL is an email sign-in link
   */
  isEmailSignInLink(): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    return this.waitForAuthInit().pipe(
      map(() => {
        try {
          return isSignInWithEmailLink(this.auth, window.location.href);
        } catch (error) {
          console.error(
            'AuthService: Error checking email sign-in link:',
            error
          );
          return false;
        }
      })
    );
  }

  /**
   * Send sign-in link to email
   */
  sendSignInLink(email: string): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        console.log(`AuthService: Sending sign-in link to ${email}`);
        return from(
          sendSignInLinkToEmail(this.auth, email, this.actionCodeSettings)
        ).pipe(
          tap(() => localStorage.setItem(this.emailForSignInKey, email)),
          map(() => true),
          catchError((error) => {
            console.error('AuthService: Error sending sign-in link:', error);
            return of(false);
          })
        );
      })
    );
  }

  /**
   * Sign in with email link
   */
  signInWithEmailLink(email?: string): Observable<User | null> {
    if (!this.isBrowser) return of(null);

    const storedEmail = localStorage.getItem(this.emailForSignInKey);
    const emailToUse = email || storedEmail;
    if (!emailToUse) return of(null);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        return this.ngZone.run(() => {
          const isValidLink = isSignInWithEmailLink(
            this.auth,
            window.location.href
          );

          if (isValidLink) {
            console.log(
              `AuthService: Processing sign-in link for ${emailToUse}`
            );
            return from(
              signInWithEmailLink(this.auth, emailToUse, window.location.href)
            ).pipe(
              tap((userCredential) => {
                localStorage.removeItem(this.emailForSignInKey);
                localStorage.setItem('isLoggedIn', 'true');

                // Only redirect if we're on the login page
                if (this.shouldRedirect()) {
                  const redirectUrl =
                    localStorage.getItem('redirectUrl') || '/dashboard';
                  this.router.navigate([redirectUrl]);
                  localStorage.removeItem('redirectUrl');
                }
              }),
              map((userCredential) => userCredential.user),
              catchError((error) => {
                console.error(
                  'AuthService: Error signing in with email link:',
                  error
                );
                return of(null);
              })
            );
          } else {
            console.log('AuthService: Not a valid email sign-in link');
            return of(null);
          }
        });
      })
    );
  }

  /**
   * Get shortened UID for display
   */
  getShortUid(uid: string): string {
    // Take the first 8 characters of the UID
    return uid.substring(0, 8);
  }

  /**
   * Get stored email for sign-in
   */
  getStoredEmail(): string | null {
    return this.isBrowser ? localStorage.getItem(this.emailForSignInKey) : null;
  }

  /**
   * Register new user with email and password
   */
  registerUser(
    email: string,
    password: string,
    userData: any
  ): Observable<User> {
    if (!this.isBrowser) return of(null as unknown as User);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        console.log(`AuthService: Registering new user: ${email}`);
        return from(
          createUserWithEmailAndPassword(this.auth, email, password)
        ).pipe(
          switchMap((userCredential) => {
            const user = userCredential.user;
            // The key fix is here - making sure we use setDoc with the user's UID as the document ID
            return from(
              this.firestoreService.setDocument(`users/${user.uid}`, {
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
              tap(() => localStorage.setItem('isLoggedIn', 'true')),
              map(() => user)
            );
          }),
          catchError((error) => {
            console.error('AuthService: Error registering user:', error);
            throw error;
          })
        );
      })
    );
  }

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        console.log(`AuthService: Logging in user: ${email}`);
        return from(
          signInWithEmailAndPassword(this.auth, email, password)
        ).pipe(
          tap(() => localStorage.setItem('isLoggedIn', 'true')),
          switchMap(() => {
            // Only redirect if we're on the login page
            if (this.shouldRedirect()) {
              const redirectUrl =
                localStorage.getItem('redirectUrl') || '/dashboard';
              this.router.navigate([redirectUrl]);
              localStorage.removeItem('redirectUrl');
            }
            return of(true);
          }),
          catchError((error) => {
            console.error('AuthService: Error during login:', error);
            return of(false);
          })
        );
      })
    );
  }

  /**
   * Migrate user document to correct path if needed
   */
  migrateUserDocument(): Observable<boolean> {
    return this.getCurrentUser().pipe(
      take(1),
      switchMap((user) => {
        if (!user) return of(false);

        console.log(
          'AuthService: Checking if user document migration is needed for:',
          user.uid
        );

        // Check if document exists at correct path
        return this.firestoreService
          .getDocumentWithLogging<any>(`users/${user.uid}`)
          .pipe(
            take(1),
            switchMap((userDoc) => {
              if (userDoc) {
                console.log(
                  'AuthService: User document exists at correct path, no migration needed'
                );
                return of(true);
              }

              console.log(
                'AuthService: User document not found at expected path, searching by email'
              );

              // Document doesn't exist at correct path, search by email
              const usersCollection = collection(this.firestore, 'users');
              const q = query(
                usersCollection,
                where('email', '==', user.email)
              );

              return from(getDocs(q)).pipe(
                switchMap((snapshot) => {
                  if (snapshot.empty) {
                    console.log(
                      'AuthService: No document found with matching email'
                    );
                    return of(false);
                  }

                  // Found document with matching email
                  const doc = snapshot.docs[0];
                  const userData = doc.data();
                  const oldDocId = doc.id;

                  console.log(
                    `AuthService: Found user document with ID: ${oldDocId}, migrating to: ${user.uid}`
                  );

                  // Create document at correct path
                  return from(
                    this.firestoreService.setDocument(
                      `users/${user.uid}`,
                      userData
                    )
                  ).pipe(
                    switchMap(() => {
                      console.log(
                        'AuthService: Document created at correct path'
                      );

                      // Optionally delete the old document
                      // Uncomment the next line when you're sure everything works
                      // return from(this.firestoreService.deleteDocument(`users/${oldDocId}`));

                      return of(true);
                    }),
                    catchError((error) => {
                      console.error(
                        'AuthService: Error during document migration:',
                        error
                      );
                      return of(false);
                    })
                  );
                })
              );
            })
          );
      })
    );
  }

  /**
   * Logout user and clear all auth-related storage
   */
  logout(): Observable<void> {
    if (!this.isBrowser) return of(undefined);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        console.log('AuthService: Logging out user');
        return from(signOut(this.auth)).pipe(
          tap(() => {
            // Clear all auth-related storage
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('redirectUrl');
            localStorage.removeItem(this.emailForSignInKey);

            // Clear any other potential auth-related items
            try {
              sessionStorage.removeItem('firebase:authUser');

              // Clear auth cookies
              document.cookie.split(';').forEach((c) => {
                document.cookie = c
                  .replace(/^ +/, '')
                  .replace(
                    /=.*/,
                    '=;expires=' + new Date().toUTCString() + ';path=/'
                  );
              });
            } catch (e) {
              console.warn(
                'AuthService: Error clearing additional storage:',
                e
              );
            }

            // Reset state
            this.userProfileSubject.next(null);

            // Always navigate to login after logout
            this.router.navigate(['/login']);
          }),
          catchError((error) => {
            console.error('AuthService: Error during logout:', error);
            throw error;
          })
        );
      })
    );
  }

  // Add this method to your AuthService
  updateUserRole(role: string): Observable<void> {
    return this.getCurrentUser().pipe(
      take(1),
      switchMap((user) => {
        if (!user) {
          throw new Error('No authenticated user');
        }

        return from(
          this.firestoreService.updateDocument(`users/${user.uid}`, { role })
        );
      })
    );
  }

  /**
   * Delete user account
   */
  deleteAccount(): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        // Get current user
        return this.getCurrentUser().pipe(
          take(1),
          switchMap((user) => {
            if (!user) {
              return of(false);
            }

            console.log('AuthService: Deleting user account:', user.email);

            // Delete the current user
            return from(user.delete()).pipe(
              tap(() => {
                // Clear all auth storage
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('redirectUrl');
                localStorage.removeItem(this.emailForSignInKey);

                try {
                  sessionStorage.removeItem('firebase:authUser');

                  // Clear auth cookies
                  document.cookie.split(';').forEach((c) => {
                    document.cookie = c
                      .replace(/^ +/, '')
                      .replace(
                        /=.*/,
                        '=;expires=' + new Date().toUTCString() + ';path=/'
                      );
                  });
                } catch (e) {
                  console.warn(
                    'AuthService: Error clearing additional storage:',
                    e
                  );
                }

                // Reset state
                this.userProfileSubject.next(null);

                // Navigate to login after account deletion
                this.router.navigate(['/login']);
              }),
              map(() => true),
              catchError((error) => {
                console.error(
                  'AuthService: Error deleting user account:',
                  error
                );
                throw error;
              })
            );
          })
        );
      })
    );
  }

  /**
   * Get current authentication status
   */
  getAuthStatus(): Observable<boolean> {
    console.log(
      'AuthService: Getting auth status, current value:',
      this.isLoggedInSubject.value
    );
    return this.isLoggedIn$;
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): Observable<User | null> {
    return this.user$;
  }

  /**
   * Get user profile for specific UID
   */
  // auth.service.ts

  async getUserProfile(uid: string): Promise<UserData | null> {
    try {
      // Try to load from users collection first (for originators)
      const userDocRef = doc(this.firestore, `users/$user.{uid}`);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        console.log('AuthService: Found user document in users collection.');
        const { id, ...userData } = userDocSnap.data() as UserData;
        return { id: userDocSnap.id, ...userData };
      }

      // If not found, try to load from lenders collection
      const lenderDocRef = doc(this.firestore, `lenders/$user.{uid}`);
      const lenderDocSnap = await getDoc(lenderDocRef);

      if (lenderDocSnap.exists()) {
        console.log(
          'AuthService: Found lender document in lenders collection.'
        );
        const { id, ...lenderData } = lenderDocSnap.data() as UserData;
        return { id: lenderDocSnap.id, ...lenderData };
      }

      // If not found in either collection, return null (NO search by email here for lenders)
      console.error(
        'AuthService: No document found for user in users or lenders collection.'
      );
      return null;
    } catch (error) {
      console.error('AuthService: Error loading user profile:', error);
      return null;
    }
  }

  /**
   * Get current user profile (from cached subject)
   */
  getCurrentUserProfile(): Observable<any> {
    return this.userProfile$;
  }
}
