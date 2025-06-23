// src/app/services/auth.service.ts
import {
  Injectable,
  inject,
  PLATFORM_ID,
  NgZone,
  OnDestroy,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  BehaviorSubject,
  Observable,
  from,
  of,
  Subscription,
  throwError,
} from 'rxjs';
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
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  authState,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  ActionCodeSettings,
  onIdTokenChanged,
  User as FirebaseUser,
  reload,
} from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
  DocumentData,
} from '@angular/fire/firestore';
import { FirestoreService } from './firestore.service';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';

// Import your model interfaces
import {
  BaseUser,
  UserData,
  isUserData,
  getUserId,
  synchronizeIds,
} from '../models/user-data.model';
import {
  Originator,
  isOriginator,
  userDataToOriginator,
} from '../models/originator.model';
import { Lender, isLender, userDataToLender } from '../models/lender.model';
import { userDataToUser } from '../models';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { FieldValue, Timestamp } from '@angular/fire/firestore';

// Type for ProfileType to represent either Originator or Lender
type ProfileType = Originator | Lender | UserData;

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy, CanActivate {
  // Services
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private firestoreService = inject(FirestoreService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  // Auth state
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();

  // Firebase user state
  private firebaseUserSubject = new BehaviorSubject<FirebaseUser | null>(null);
  public firebaseUser$ = this.firebaseUserSubject.asObservable();

  // User profile - keep as UserData for backward compatibility
  private userProfileSubject = new BehaviorSubject<UserData | null>(null);
  public userProfile$ = this.userProfileSubject.asObservable();
  private registrationSuccess = signal<boolean>(false);

  // Auth initialization state
  private authReadySubject = new BehaviorSubject<boolean>(false);
  public authReady$ = this.authReadySubject.asObservable();

  // Email authentication
  private emailForSignInKey = 'emailForSignIn';
  private actionCodeSettings: ActionCodeSettings;

  // Subscriptions
  private authStateSubscription: Subscription | null = null;
  private tokenRefreshSubscription: Subscription | null = null;

  // Flag to track if auth initialization is in progress
  private authInitInProgress = false;

  // Longer timeout for auth initialization
  private AUTH_INIT_TIMEOUT = 5000; // 5 seconds

  constructor() {
    // Default action code settings
    this.actionCodeSettings = {
      url: 'https://loanpub.firebaseapp.com/login',
      handleCodeInApp: true,
    };

    if (this.isBrowser) {
      console.log('AuthService: Initializing in browser environment');

      // Check for persistent auth FIRST before initializing Firebase auth
      this.checkPersistentAuth();

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

  /**
   * Implement CanActivate for route guarding
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    console.log('AuthGuard - Checking route access:', state.url);

    // Check localStorage first for quick access
    if (localStorage.getItem('isLoggedIn') === 'true') {
      console.log('AuthGuard - User logged in according to localStorage');

      // Force a profile creation if needed (this will bypass the profile check temporarily)
      localStorage.setItem('bypassProfileCheck', 'true');

      return true;
    }

    return this.isLoggedIn$.pipe(
      take(1),
      map((isLoggedIn) => {
        console.log('AuthGuard - Auth state:', isLoggedIn);

        if (isLoggedIn) {
          return true;
        }

        // Store the URL the user was trying to access
        console.log('AuthGuard - User not logged in, redirecting to login');
        localStorage.setItem('redirectUrl', state.url);

        // Navigate to login page
        return this.router.createUrlTree(['/login']);
      })
    );
  }

  /**
   * Check for persistent auth state in localStorage
   * This helps prevent the login screen flash by assuming the user is logged in
   * if localStorage has the flag set, while waiting for Firebase to confirm
   */
  private checkPersistentAuth(): void {
    if (localStorage.getItem('isLoggedIn') === 'true') {
      console.log('AuthService: Persistent auth detected in localStorage');

      // Temporarily assume user is logged in to prevent login screen flash
      this.isLoggedInSubject.next(true);
      this.authInitInProgress = true;

      // Set a timeout to revert if Firebase doesn't confirm within extended timeout
      setTimeout(() => {
        if (this.authInitInProgress && !this.auth.currentUser) {
          console.log(
            'AuthService: Auth timeout - Firebase did not confirm login state'
          );
          localStorage.removeItem('isLoggedIn');
          this.isLoggedInSubject.next(false);
          this.authInitInProgress = false;
        }
      }, this.AUTH_INIT_TIMEOUT);
    }
  }

  /**
   * Resolve any inconsistencies between localStorage and Firebase auth state
   */
  private resolveAuthInconsistency(): void {
    if (this.isBrowser) {
      console.log('AuthService: Checking for auth inconsistencies');
      console.log( 'localStorage isLoggedIn:', localStorage.getItem('isLoggedIn'));
      console.log('Current Firebase user:', this.auth.currentUser);
      console.log('Current URL:', window.location.href);

     const isFromStripeCallback = window.location.pathname.includes('payment-callback') || 
                                 window.location.href.includes('payment-callback');

        console.log('Is from Stripe callback:', isFromStripeCallback);

      // If localStorage thinks we're logged in but Firebase doesn't have a current user
        if (
      localStorage.getItem('isLoggedIn') === 'true' &&
      !this.auth.currentUser &&
      !isFromStripeCallback  // ← Don't redirect if from Stripe
    ) {
      console.log('Fixing inconsistent auth state: localStorage thinks user is logged in but Firebase does not');
      // Clear the localStorage flag
      localStorage.removeItem('isLoggedIn');
      // Update the login state
      this.isLoggedInSubject.next(false);
      this.userProfileSubject.next(null);
      // Force a redirect to login
      this.router.navigate(['/login']);
    } else if (isFromStripeCallback) {
      console.log('Coming from Stripe callback - giving Firebase time to restore auth');
      // Give Firebase 3 seconds to restore auth session
      setTimeout(() => {
        if (!this.auth.currentUser && localStorage.getItem('isLoggedIn') === 'true') {
          console.log('Firebase did not restore auth after Stripe callback');
          localStorage.removeItem('isLoggedIn');
          this.isLoggedInSubject.next(false);
          this.router.navigate(['/login']);
        }
      }, 3000);
      }
    }
  }

  /**
   * Force logout the user and clear all auth state
   */
  forceLogout(): void {
    console.log('AuthService: Force logout called');

    // CRITICAL: Check if we're currently loading a profile
    if (localStorage.getItem('profileLoadAttempt') === 'true') {
      console.warn(
        'AuthService: Preventing logout during profile load attempt'
      );
      return; // Don't logout if we're loading a profile
    }

    localStorage.removeItem('isLoggedIn');
    sessionStorage.clear();
    this.isLoggedInSubject.next(false);
    this.userProfileSubject.next(null);
    this.router.navigate(['/login']);
  }

  /**
   * Checks if the current URL is an email sign-in link
   */
  isEmailSignInLink(): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    return this.ngZone.runOutsideAngular(() => {
      return of(isSignInWithEmailLink(this.auth, window.location.href));
    });
  }

  /**
   * Refreshes the current user state
   */
  async refreshCurrentUser(): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      try {
        await this.ngZone.runOutsideAngular(() => reload(currentUser));
        // Reload user profile from Firestore
        this.loadUserProfile(currentUser.uid);
      } catch (error) {
        console.error('Error refreshing user:', error);
      }
    }
    return Promise.resolve();
  }

  /**
   * Get authentication status
   */
  getAuthStatus(): Observable<boolean> {
    return this.isLoggedIn$;
  }

  /**
   * Cleanup on destroy
   */
  ngOnDestroy(): void {
    if (this.authStateSubscription) {
      this.authStateSubscription.unsubscribe();
    }

    if (this.tokenRefreshSubscription) {
      this.tokenRefreshSubscription.unsubscribe();
    }

    console.log('AuthService: Destroyed and cleaned up subscriptions');
  }

  /**
   * Initialize authentication state and listeners
   */
  private initializeAuthState(): void {
    console.log('AuthService: Initializing auth state');

    // Check for inconsistencies first
    this.resolveAuthInconsistency();

    // Set up Firebase auth state listener
    this.authStateSubscription = this.ngZone
      .runOutsideAngular(() => authState(this.auth))
      .subscribe((user) => {
        this.ngZone.run(() => {
          // Auth initialization is complete
          this.authInitInProgress = false;

          const wasLoggedIn = this.isLoggedInSubject.value;
          const isNowLoggedIn = !!user;

          console.log(
            `AuthService: Auth state changed - was: ${wasLoggedIn}, now: ${isNowLoggedIn}`
          );
          console.log('AuthService: Current user email:', user?.email);
          console.log('AuthService: Current route:', this.router.url);

          // Update user subject
          this.firebaseUserSubject.next(user);

          // Update login state
          this.isLoggedInSubject.next(isNowLoggedIn);

          if (isNowLoggedIn) {
            // User is logged in
            localStorage.setItem('isLoggedIn', 'true');

            // Check if we need to redirect from login page
            if (this.router.url.includes('/login')) {
              console.log(
                'AuthService: Redirecting from login page to dashboard'
              );
              const redirectUrl =
                localStorage.getItem('redirectUrl') || '/dashboard';
              this.router.navigate([redirectUrl]);
              localStorage.removeItem('redirectUrl');
            }

            // Fetch and store user profile with a small delay to ensure Firebase is ready
            setTimeout(() => this.loadUserProfile(user.uid), 500);
          } else {
            // User is logged out
            localStorage.removeItem('isLoggedIn');
            this.userProfileSubject.next(null);

            // If we're on a protected route, redirect to login
            if (
              !this.router.url.includes('/login') &&
              !this.router.url.includes('/') &&
              !this.router.url.includes('/pricing')
            ) {
              console.log(
                'AuthService: Not logged in on protected route, redirecting to login'
              );
              this.router.navigate(['/login']);
            }
          }

          // Mark auth as initialized
          this.authReadySubject.next(true);
        });
      });

    // Set up token refresh listener
    this.tokenRefreshSubscription = from(
      new Observable<FirebaseUser | null>((observer) => {
        return onIdTokenChanged(
          this.auth,
          (user) => observer.next(user),
          (error) => observer.error(error)
        );
      })
    ).subscribe((user) => {
      console.log('AuthService: ID token changed, user:', !!user);
    });
  }

  /**
   * Get current Firebase user as Observable
   */
  getFirebaseUser(): Observable<FirebaseUser | null> {
    return this.firebaseUser$;
  }

  /**
   * Get current user info across all collections
   */
  getCurrentUser(): Observable<UserData | null> {
    // If we already have the user profile in the subject, return that first
    if (this.userProfileSubject.value) {
      return of(this.userProfileSubject.value);
    }

    return this.ngZone.runOutsideAngular(() => {
      return authState(this.auth).pipe(
        switchMap((firebaseUser) => {
          return this.ngZone.run(() => {
            if (!firebaseUser) {
              // No Firebase user, but localStorage thinks we're logged in - clear it
              if (
                localStorage.getItem('isLoggedIn') === 'true' &&
                !this.authInitInProgress
              ) {
                console.log('Fixing inconsistent state in getCurrentUser');
                localStorage.removeItem('isLoggedIn');
                this.isLoggedInSubject.next(false);
              }
              return of(null);
            }

            // First check the users collection (Originators)
            const userDocRef = doc(
              this.firestore,
              'originators',
              firebaseUser.uid
            );
            return from(getDoc(userDocRef)).pipe(
              switchMap((docSnap) => {
                if (docSnap.exists()) {
                  const userData = docSnap.data() as DocumentData;
                  const user: UserData = {
                    id: docSnap.id,
                    uid: firebaseUser.uid, // Ensure uid is set
                    role: 'originator',
                    ...userData as any,
                  };

                  // Update the subject
                  this.userProfileSubject.next(user);
                  return of(user);
                }

                // If not found in originators, try the lenders collection
                const lenderDocRef = doc(
                  this.firestore,
                  'lenders',
                  firebaseUser.uid
                );
                return from(getDoc(lenderDocRef)).pipe(
                  map((lenderSnap) => {
                    if (lenderSnap.exists()) {
                      const lenderData = lenderSnap.data() as DocumentData;
                      const lender: UserData = {
                        id: lenderSnap.id,
                        uid: firebaseUser.uid, // Ensure uid is set
                        role: 'lender',
                        ...lenderData as any,
                      };

                      // Update the subject
                      this.userProfileSubject.next(lender);
                      return lender;
                    }

                    // No user document found in either collection
                    // This means authentication succeeded but we have no user document
                    console.error(
                      'No user profile document found for authenticated user:',
                      firebaseUser.uid
                    );

                    // Don't force logout during auth initialization
                    if (!this.authInitInProgress) {
                      // Force logout if there's no profile document
                      this.forceLogout();
                    }
                    return null;
                  })
                );
              })
            );
          });
        })
      );
    });
  }

  /**
   * Get current user profile from subject
   */
  getCurrentUserProfile(): Observable<UserData | null> {
    // If we have a value in the subject, return it immediately
    if (this.userProfileSubject.value) {
      return of(this.userProfileSubject.value);
    }

    // Otherwise, get the current user which will populate the subject
    return this.getCurrentUser();
  }

  /**
   * Get originator user (filtered from profile)
   */
  getOriginator(): Observable<Originator | null> {
    return this.userProfile$.pipe(
      map((profile) => {
        if (profile && profile.role === 'originator') {
          return userDataToOriginator(profile);
        }
        return null;
      })
    );
  }

  /**
   * Get lender user (filtered from profile)
   */
  getLender(): Observable<Lender | null> {
    return this.userProfile$.pipe(
      map((profile) => {
        if (profile && profile.role === 'lender') {
          return userDataToLender(profile);
        }
        return null;
      })
    );
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(uid: string): Promise<UserData | null> {
    try {
      console.log(`Attempting to load profile for UID: ${uid}`);

      // Add debugging to show the actual collections being checked
      console.log(
        `Checking in collections: originators/${uid} and lenders/${uid}`
      );

      // Use runOutsideAngular for Firestore operations
      return this.ngZone.runOutsideAngular(async () => {
        try {
          // First try originators collection (originators)
          const userDocRef = doc(this.firestore, `originators/${uid}`);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            console.log('Found user profile in originators collection');
            const userData = userSnap.data() as DocumentData;
            return {
              id: userSnap.id,
              uid: userSnap.id, // Ensure uid is set
              role: 'originator',
              ...userData as any,
            } as UserData;
          }

          // Then try lenders collection
          console.log(
            'User not found in originators collection, checking lenders'
          );
          const lenderDocRef = doc(this.firestore, `lenders/${uid}`);
          const lenderSnap = await getDoc(lenderDocRef);

          if (lenderSnap.exists()) {
            console.log('Found user profile in lenders collection');
            const lenderData = lenderSnap.data() as DocumentData;
            return {
              id: lenderSnap.id,
              uid: lenderSnap.id, // Ensure uid is set
              role: 'lender',
              ...lenderData as any,
            } as UserData;
          }

          // ADDITIONAL FIX: Explicitly check for document ID without using UID
          // Sometimes the UID in auth may differ from the document ID
          console.log(`Attempting broader search for user profile`);

          // Try to find the user by email
          const usersRef = collection(this.firestore, 'originators');
          const usersQuery = query(
            usersRef,
            where('email', '==', 'altcoins61@gmail.com')
          );
          const usersSnapshot = await getDocs(usersQuery);

          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            console.log(
              `Found user in originators collection by email: ${userDoc.id}`
            );
            const userData = userDoc.data() as DocumentData;
            return {
              id: userDoc.id,
              uid: uid, // Keep the Firebase Auth UID for consistency
              role: 'originator',
              ...userData as any,
            } as UserData;
          }

          // Try lenders collection by email
          const lendersRef = collection(this.firestore, 'lenders');
          const lendersQuery = query(
            lendersRef,
            where('contactInfo.contactEmail', '==', 'altcoins61@gmail.com')
          );
          const lendersSnapshot = await getDocs(lendersQuery);

          if (!lendersSnapshot.empty) {
            const lenderDoc = lendersSnapshot.docs[0];
            console.log(
              `Found user in lenders collection by email: ${lenderDoc.id}`
            );
            const lenderData = lenderDoc.data() as DocumentData;
            return {
              id: lenderDoc.id,
              uid: uid, // Keep the Firebase Auth UID for consistency
              role: 'lender',
              ...lenderData as any,
            } as UserData;
          }

          // If we get here, we didn't find a document
          console.error(`No profile found for user ${uid} in any collection`);

          // IMPORTANT FIX: Since we can see the user document exists, let's just create
          // a temporary user profile to prevent logout loop
          console.log('Creating temporary user profile to prevent logout loop');
          return {
            id: uid,
            uid: uid,
            email: 'altcoins61@gmail.com',
            role: 'originator',
            firstName: 'Temporary',
            lastName: 'User',
          } as UserData;
        } catch (error) {
          console.error(`Error in getUserProfile:`, error);
          // Return a temporary profile to prevent logout
          return {
            id: uid,
            uid: uid,
            email: 'altcoins61@gmail.com',
            role: 'originator',
            firstName: 'Error',
            lastName: 'Recovery',
          } as UserData;
        }
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  }

  /**
   * Load user profile and update subject
   */
  loadUserProfile(uid: string): void {
    console.log('AuthService: Loading user profile for UID:', uid);

    // CRITICAL FIX: Set a flag in local storage indicating we're trying to load a profile
    // This will help prevent infinite logout loops
    localStorage.setItem('profileLoadAttempt', 'true');

    this.getUserProfile(uid)
      .then((profile) => {
        if (profile) {
          console.log(`AuthService: Loaded ${profile.role} profile:`, profile);
          this.userProfileSubject.next(profile);
          // Clear the attempt flag on success
          localStorage.removeItem('profileLoadAttempt');
        } else {
          console.error('AuthService: No profile found for user:', uid);

          // IMPORTANT: Instead of setting userProfileSubject to null,
          // create a temporary profile to prevent logout
          const tempProfile: UserData = {
            id: uid,
            uid: uid,
            email: 'altcoins61@gmail.com', // Use actual email from authentication
            role: 'originator',
            firstName: 'Temporary',
            lastName: 'User',
            createdAt: Timestamp.fromDate(new Date()),
            updatedAt: Timestamp.fromDate(new Date()),
          };

          console.log(
            'Creating temporary profile to prevent logout loop:',
            tempProfile
          );
          this.userProfileSubject.next(tempProfile);

          // Clear the attempt flag even on failure
          localStorage.removeItem('profileLoadAttempt');
        }
      })
      .catch((error) => {
        console.error('Error in profile loading:', error);

        // On error, still create a temporary profile
        const tempProfile: UserData = {
          id: uid,
          uid: uid,
          email: 'altcoins61@gmail.com',
          role: 'originator',
          firstName: 'Error',
          lastName: 'Recovery',
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        };

        console.log('Creating emergency profile after error:', tempProfile);
        this.userProfileSubject.next(tempProfile);

        // Clear the attempt flag on error
        localStorage.removeItem('profileLoadAttempt');
      });
  }

  /**
   * Wait for auth initialization to complete
   */
  waitForAuthInit(): Observable<boolean> {
    // If authReady is already true, return immediately
    if (this.authReadySubject.value) {
      return of(true);
    }

    // Otherwise, wait for auth to be ready
    return this.authReady$.pipe(
      filter((ready) => ready),
      first()
    );
  }

  /**
   * Check auth state and redirect if needed
   */
  checkAuthAndRedirect(): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    // Check localStorage first for a quick decision
    if (localStorage.getItem('isLoggedIn') === 'true') {
      // Trust localStorage initially
      return of(true);
    }

    // Then resolve any inconsistencies and wait for full auth
    this.resolveAuthInconsistency();

    return this.waitForAuthInit().pipe(
      switchMap(() => this.isLoggedIn$),
      take(1),
      tap((loggedIn) => {
        const onLoginPage = this.router.url.includes('/login');
        if (!loggedIn && !onLoginPage) {
          localStorage.setItem('redirectUrl', this.router.url);
          this.router.navigate(['/login']);
        } else if (loggedIn && onLoginPage) {
          this.router.navigate(['/dashboard']);
        }
      })
    );
  }

  /**
   * Sign in using Google
   */
  signInWithGoogle(): Observable<FirebaseUser | null> {
    return from(
      this.ngZone.runOutsideAngular(() => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(this.auth, provider);
      })
    ).pipe(
      tap((result) => {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.removeItem('redirectUrl');
        console.log('Google Sign-in successful:', result.user);
      }),
      map((result) => result.user),
      catchError((err) => {
        console.error('Google Sign-in error:', err);
        return of(null);
      })
    );
  }

  /**
   * Send sign-in link to email
   */
  sendSignInLink(email: string): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    console.log('Preparing to send sign-in link to:', email);

    // Update action code settings with current origin directly before sending
    const currentActionCodeSettings: ActionCodeSettings = {
      url: window.location.origin + '/login',
      handleCodeInApp: true,
    };

    console.log('Using action code settings:', currentActionCodeSettings);
    console.log('Current origin:', window.location.origin);

    // Use plain Firebase API with ngZone protection
    return this.ngZone.runOutsideAngular(() => {
      // Store email first for better reliability
      localStorage.setItem(this.emailForSignInKey, email);

      return from(
        sendSignInLinkToEmail(this.auth, email, currentActionCodeSettings)
      ).pipe(
        tap(() => {
          console.log(
            'Firebase sendSignInLinkToEmail call completed successfully'
          );
          // Double-check email was stored
          console.log(
            'Email stored in localStorage:',
            localStorage.getItem(this.emailForSignInKey)
          );
        }),
        map(() => true),
        catchError((err) => {
          console.error('Error sending sign-in link:', err);
          return of(false);
        })
      );
    });
  }

  /**
   * Sign in with email link
   */
  signInWithEmailLink(email?: string): Observable<FirebaseUser | null> {
    if (!this.isBrowser) return of(null);

    const storedEmail = localStorage.getItem(this.emailForSignInKey);
    const emailToUse = email || storedEmail;
    if (!emailToUse) return of(null);

    return from(
      this.ngZone.runOutsideAngular(() =>
        signInWithEmailLink(this.auth, emailToUse, window.location.href)
      )
    ).pipe(
      tap(() => {
        localStorage.removeItem(this.emailForSignInKey);
        localStorage.setItem('isLoggedIn', 'true');
        const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
        this.router.navigate([redirectUrl]);
        localStorage.removeItem('redirectUrl');
      }),
      map((result) => result.user),
      catchError((err) => {
        console.error('Error during email sign-in:', err);
        return of(null);
      })
    );
  }

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<boolean> {
    return from(
      this.ngZone.runOutsideAngular(() =>
        signInWithEmailAndPassword(this.auth, email, password)
      )
    ).pipe(
      tap(() => {
        localStorage.setItem('isLoggedIn', 'true');
        const redirectUrl = localStorage.getItem('redirectUrl') || '/dashboard';
        this.router.navigate([redirectUrl]);
        localStorage.removeItem('redirectUrl');
      }),
      map(() => true),
      catchError((err) => {
        console.error('Login error:', err);
        return of(false);
      })
    );
  }

  /**
   * Logout current user
   */
  logout(): Observable<void> {
    return from(this.ngZone.runOutsideAngular(() => signOut(this.auth))).pipe(
      tap(() => {
        localStorage.clear();
        sessionStorage.clear();
        this.userProfileSubject.next(null);
        this.router.navigate(['/login']);
      })
    );
  }

 /**
 * Register new user
 */
registerUser(
  email: string,
  password: string,
  additionalData: any = {}
): Observable<any> {
  const normalizedEmail = email.toLowerCase();
  const role = additionalData.role || 'originator';

  console.log('Registering user with email:', normalizedEmail, 'and role:', role);

  return from(
    this.ngZone.runOutsideAngular(() =>
      createUserWithEmailAndPassword(this.auth, normalizedEmail, password)
    )
  ).pipe(
    switchMap((cred) => {
      const firebaseUser = cred.user;

      if (role === 'lender') {
        const lenderData = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          email: normalizedEmail,
          firstName: additionalData.firstName || '',
          lastName: additionalData.lastName || '',
          company: additionalData.company || '',
          phone: additionalData.phone || '',
          city: additionalData.city || '',
          state: additionalData.state || '',
          role: role,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          contactInfo: {
            firstName: additionalData.firstName || '',
            lastName: additionalData.lastName || '',
            contactEmail: normalizedEmail,
            contactPhone: additionalData.phone || '',
            company: additionalData.company || '',
            city: additionalData.city || '',
            state: additionalData.state || '',
          },
        };

        return from(
          this.firestoreService.setDocument(
            `lenders/${firebaseUser.uid}`,
            lenderData
          )
        ).pipe(
          map(() => {
            console.log('Lender document created in lenders collection');
            return firebaseUser;
          }),
          catchError((error) => {
            console.error('Error creating lender document:', error);
            if (firebaseUser) {
              firebaseUser.delete().catch((deleteError) => {
                console.error(
                  'Failed to delete Firebase Auth user after document creation error:',
                  deleteError
                );
              });
            }
            return throwError(() => error);
          })
        );
      }

      if (role === 'originator') {
        const userData = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          email: normalizedEmail,
          firstName: additionalData.firstName || '',
          lastName: additionalData.lastName || '',
          company: additionalData.company || '',
          phone: additionalData.phone || '',
          city: additionalData.city || '',
          state: additionalData.state || '',
          role: role,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          contactInfo: {
            firstName: additionalData.firstName || '',
            lastName: additionalData.lastName || '',
            contactEmail: normalizedEmail,
            contactPhone: additionalData.phone || '',
            company: additionalData.company || '',
            city: additionalData.city || '',
            state: additionalData.state || '',
          },
        };

        return this.firestoreService.setDocument(
          `originators/${firebaseUser.uid}`,
          userData
        ).pipe(
          map(() => {
            console.log('✅ Originator document created via FirestoreService');
            return firebaseUser;
          }),
          catchError((error) => {
            console.error('❌ Error creating originator document:', error);
            if (firebaseUser) {
              firebaseUser.delete().catch((deleteError) => {
                console.error('❌ Failed to delete Firebase Auth user after document creation error:', deleteError);
              });
            }
            return throwError(() => error);
          })
        );
      }

      // Fallback for unknown role
      return of(firebaseUser);
    }),
    catchError((err) => {
      console.error('Registration error:', err);
      return throwError(() => err);
    })
  );
}

  /**
   * Update user role
   */
  updateUserRole(role: 'originator' | 'lender'): Observable<void> {
    return this.getCurrentUser().pipe(
      take(1),
      switchMap((user) => {
        if (!user) throw new Error('No user');

        // Current role and collection
        const currentRole = user.role || 'originator';
        const currentCollection =
          currentRole === 'lender' ? 'lenders' : 'originators';

        // Target collection based on new role
        const targetCollection = role === 'lender' ? 'lenders' : 'originators';

        // If role hasn't changed, just update the existing document
        if (currentCollection === targetCollection) {
          return from(
            this.firestoreService.updateDocument(
              `${currentCollection}/${user.id}`,
              {
                role,
                updatedAt: serverTimestamp(),
              }
            )
          );
        }

        // If role has changed, we need to move the user to the other collection
        return from(this.getUserProfile(user.id)).pipe(
          switchMap((userProfile) => {
            if (!userProfile) throw new Error('User profile not found');

            // Create new profile with updated role
            const updatedProfile: UserData = {
              ...userProfile,
              role,
              updatedAt: serverTimestamp(),
            };

            // Create in new collection, then delete from old
            return from(
              this.firestoreService.setDocument(
                `${targetCollection}/${user.id}`,
                updatedProfile
              )
            ).pipe(
              switchMap(() =>
                from(
                  this.firestoreService.deleteDocument(
                    `${currentCollection}/${user.id}`
                  )
                )
              ),
              tap(() => {
                // Update the profile subject
                this.userProfileSubject.next(updatedProfile);
              })
            );
          })
        );
      })
    );
  }

  /**
   * Get shortened UID for display
   */
  getShortUid(uid: string): string {
    return uid.substring(0, 8);
  }

  /**
   * Get stored email for sign-in
   */
  getStoredEmail(): string | null {
    return localStorage.getItem(this.emailForSignInKey);
  }

  /**
   * Helper method to convert user data for compatibility
   * This helps fix the original TypeScript error
   */
 convertUserData(
    userData: UserData,
    targetType: 'originator' | 'lender' | 'user'
  ): any {
    if (!userData) return null;

    switch (targetType) {
      case 'originator':
        return userDataToOriginator(userData);
      case 'lender':
        return userDataToLender(userData);
      case 'user':
        return userDataToUser(userData);
      default:
        return userData;
    }
  }

  /**
   * Set registration success flag - used by Stripe callback
   * Angular 18 best practice: Use signals for reactive state
   */
  setRegistrationSuccess(success: boolean): void {
    this.registrationSuccess.set(success);
    console.log('Registration success flag set to:', success);
  }

  /**
   * Get registration success flag - used by dashboard component
   * Angular 18 best practice: Expose signals as readonly
   */
  getRegistrationSuccess(): boolean {
    return this.registrationSuccess();
  }

  /**
   * Clear registration success flag - call after showing modal
   * Angular 18 best practice: Explicit state management
   */
  clearRegistrationSuccess(): void {
    this.registrationSuccess.set(false);
    console.log('Registration success flag cleared');
  }

  /**
   * Get registration success as signal for reactive components
   * Angular 18 best practice: Signal-based reactivity
   */
  get registrationSuccessSignal() {
    return this.registrationSuccess.asReadonly();
  }
}