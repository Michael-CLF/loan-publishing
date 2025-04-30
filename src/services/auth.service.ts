// src/app/services/auth.service.ts
import {
  Injectable,
  inject,
  PLATFORM_ID,
  Inject,
  NgZone,
  OnDestroy,
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
  query,
  where,
} from '@angular/fire/firestore';
import { FirestoreService } from './firestore.service';
import { Router } from '@angular/router';

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

// Type for ProfileType to represent either Originator or Lender
type ProfileType = Originator | Lender | UserData;

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
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

  // Auth initialization state
  private authReadySubject = new BehaviorSubject<boolean>(false);
  public authReady$ = this.authReadySubject.asObservable();

  // Email authentication
  private emailForSignInKey = 'emailForSignIn';
  private actionCodeSettings: ActionCodeSettings;

  // Subscriptions
  private authStateSubscription: Subscription | null = null;
  private tokenRefreshSubscription: Subscription | null = null;

  constructor() {
    // Default action code settings
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

  /**
   * Checks if the current URL is an email sign-in link
   */
  isEmailSignInLink(): Observable<boolean> {
    if (!this.isBrowser) return of(false);
    return of(isSignInWithEmailLink(this.auth, window.location.href));
  }

  /**
   * Refreshes the current user state
   */
  async refreshCurrentUser(): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      try {
        await reload(currentUser);
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
        this.firebaseUserSubject.next(user);

        // Update login state
        this.isLoggedInSubject.next(isNowLoggedIn);

        if (isNowLoggedIn) {
          // User is logged in
          localStorage.setItem('isLoggedIn', 'true');

          // Fetch and store user profile
          this.loadUserProfile(user.uid);
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
    return authState(this.auth).pipe(
      switchMap((firebaseUser) => {
        if (!firebaseUser) return of(null);

        // First check the users collection (Originators)
        const userDocRef = doc(this.firestore, 'users', firebaseUser.uid);
        return from(getDoc(userDocRef)).pipe(
          switchMap((docSnap) => {
            if (docSnap.exists()) {
              const userData = docSnap.data() as any;
              const user: UserData = {
                id: docSnap.id,
                uid: firebaseUser.uid, // Ensure uid is set
                role: 'originator',
                ...userData,
              };
              return of(user);
            }

            // If not found in users, try the lenders collection
            const lenderDocRef = doc(
              this.firestore,
              'lenders',
              firebaseUser.uid
            );
            return from(getDoc(lenderDocRef)).pipe(
              map((lenderSnap) => {
                if (lenderSnap.exists()) {
                  const lenderData = lenderSnap.data() as any;
                  const lender: UserData = {
                    id: lenderSnap.id,
                    uid: firebaseUser.uid, // Ensure uid is set
                    role: 'lender',
                    ...lenderData,
                  };
                  return lender;
                }
                return null;
              })
            );
          })
        );
      })
    );
  }

  /**
   * Get current user profile from subject
   */
  getCurrentUserProfile(): Observable<UserData | null> {
    return this.userProfile$;
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
      // First try users collection (originators)
      const userDocRef = doc(this.firestore, `users/${uid}`);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as any;
        return {
          id: userSnap.id,
          uid: userSnap.id, // Ensure uid is set
          role: 'originator',
          ...userData,
        } as UserData;
      }

      // Then try lenders collection
      const lenderDocRef = doc(this.firestore, `lenders/${uid}`);
      const lenderSnap = await getDoc(lenderDocRef);
      if (lenderSnap.exists()) {
        const lenderData = lenderSnap.data() as any;
        return {
          id: lenderSnap.id,
          uid: lenderSnap.id, // Ensure uid is set
          role: 'lender',
          ...lenderData,
        } as UserData;
      }

      return null;
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
    this.getUserProfile(uid).then((profile) => {
      if (profile) {
        console.log(`AuthService: Loaded ${profile.role} profile:`, profile);
        this.userProfileSubject.next(profile);
      } else {
        console.error('AuthService: No profile found for user:', uid);
        this.userProfileSubject.next(null);
      }
    });
  }

  /**
   * Wait for auth initialization to complete
   */
  waitForAuthInit(): Observable<boolean> {
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
   * Send sign-in link to email
   */
  sendSignInLink(email: string): Observable<boolean> {
    if (!this.isBrowser) return of(false);
    return from(
      sendSignInLinkToEmail(this.auth, email, this.actionCodeSettings)
    ).pipe(
      tap(() => localStorage.setItem(this.emailForSignInKey, email)),
      map(() => true),
      catchError((err) => {
        console.error('Error sending sign-in link:', err);
        return of(false);
      })
    );
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
      signInWithEmailLink(this.auth, emailToUse, window.location.href)
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
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
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
    return from(signOut(this.auth)).pipe(
      tap(() => {
        localStorage.clear();
        sessionStorage.clear();
        this.userProfileSubject.next(null);
        this.router.navigate(['/login']);
      })
    );
  }

  /**
   * Register a new user
   */
  registerUser(
    email: string,
    password: string,
    userData: Partial<UserData>
  ): Observable<FirebaseUser> {
    // Determine role, default to originator if not specified
    const role = userData.role || 'originator';
    const collection = role === 'lender' ? 'lenders' : 'users';

    return from(
      createUserWithEmailAndPassword(this.auth, email, password)
    ).pipe(
      switchMap((cred) => {
        const firebaseUser = cred.user;
        const profileData = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          email,
          ...userData,
          role, // Ensure role is set
          createdAt: new Date(),
        };

        return from(
          this.firestoreService.setDocument(
            `${collection}/${firebaseUser.uid}`,
            profileData
          )
        ).pipe(map(() => firebaseUser));
      }),
      catchError((err) => {
        console.error('Registration error:', err);
        return throwError(() => err);
      })
    );
  }
  // src/app/services/auth.service.ts (continued)

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
          currentRole === 'lender' ? 'lenders' : 'users';

        // Target collection based on new role
        const targetCollection = role === 'lender' ? 'lenders' : 'users';

        // If role hasn't changed, just update the existing document
        if (currentCollection === targetCollection) {
          return from(
            this.firestoreService.updateDocument(
              `${currentCollection}/${user.id}`,
              {
                role,
                updatedAt: new Date(),
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
              updatedAt: new Date(),
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
   * Update user profile
   */
  updateUserProfile(profile: UserData): Observable<void> {
    if (!profile || !profile.id) {
      return throwError(() => new Error('Invalid profile data'));
    }

    const collection = profile.role === 'lender' ? 'lenders' : 'users';

    return from(
      this.firestoreService.updateDocument(`${collection}/${profile.id}`, {
        ...profile,
        updatedAt: new Date(),
      })
    ).pipe(
      tap(() => {
        // Update the profile subject
        this.userProfileSubject.next(profile);
      }),
      catchError((err) => {
        console.error('Error updating user profile:', err);
        return throwError(() => err);
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
}
