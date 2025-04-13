// auth.service.ts
import {
  Injectable,
  inject,
  PLATFORM_ID,
  Inject,
  NgZone,
  DestroyRef,
  Injector,
  runInInjectionContext,
} from '@angular/core';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private firestoreService = inject(FirestoreService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private isBrowser: boolean;

  private emailForSignInKey = 'emailForSignIn';
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();
  private authReadySubject = new BehaviorSubject<boolean>(false);
  public authReady$ = this.authReadySubject.asObservable();

  private actionCodeSettings: ActionCodeSettings;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.actionCodeSettings = {
      url: 'https://loanpub.firebaseapp.com/login',
      handleCodeInApp: true,
    };

    if (this.isBrowser) {
      const storedLoginState = localStorage.getItem('isLoggedIn');
      if (storedLoginState === 'true') {
        this.isLoggedInSubject.next(true);
      }

      this.ngZone.run(() => {
        this.actionCodeSettings = {
          url: window.location.origin + '/login',
          handleCodeInApp: true,
        };

        // Using takeUntilDestroyed to properly clean up subscriptions
        authState(this.auth)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((user) => {
            this.ngZone.run(() => {
              this.userSubject.next(user);
              this.isLoggedInSubject.next(!!user);
              if (user) {
                localStorage.setItem('isLoggedIn', 'true');
              } else {
                localStorage.removeItem('isLoggedIn');
              }
              this.authReadySubject.next(true);
            });
          });
      });
    } else {
      // SSR - immediately mark auth as ready since we'll assume not logged in
      this.authReadySubject.next(true);
    }
  }

  // Helper method to determine if we should redirect after authentication
  private shouldRedirect(): boolean {
    // Only redirect if we're on the login page or login verification page
    const currentPath = this.router.url;
    return currentPath === '/login' || currentPath.includes('/login/verify');
  }

  private waitForAuthInit(): Observable<boolean> {
    return this.authReady$.pipe(
      filter((ready) => ready),
      first()
    );
  }

  isEmailSignInLink(): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    return this.waitForAuthInit().pipe(
      map(() => {
        // Always run Firebase APIs inside NgZone and injection context
        return runInInjectionContext(this.injector, () => {
          try {
            return isSignInWithEmailLink(this.auth, window.location.href);
          } catch (error) {
            console.error('Error checking email sign-in link:', error);
            return false;
          }
        });
      })
    );
  }

  sendSignInLink(email: string): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        return from(
          runInInjectionContext(this.injector, () =>
            sendSignInLinkToEmail(this.auth, email, this.actionCodeSettings)
          )
        ).pipe(
          tap(() => localStorage.setItem(this.emailForSignInKey, email)),
          map(() => true),
          catchError((error) => {
            console.error('Error sending sign-in link:', error);
            return of(false);
          })
        );
      })
    );
  }

  signInWithEmailLink(email?: string): Observable<User | null> {
    if (!this.isBrowser) return of(null);

    const storedEmail = localStorage.getItem(this.emailForSignInKey);
    const emailToUse = email || storedEmail;
    if (!emailToUse) return of(null);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        return this.ngZone.run(() => {
          const isValidLink = runInInjectionContext(this.injector, () =>
            isSignInWithEmailLink(this.auth, window.location.href)
          );

          if (isValidLink) {
            return from(
              runInInjectionContext(this.injector, () =>
                signInWithEmailLink(this.auth, emailToUse, window.location.href)
              )
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
                console.error('Error signing in with email link:', error);
                return of(null);
              })
            );
          } else {
            return of(null);
          }
        });
      })
    );
  }

  // Add this method to AuthService
  getShortUid(uid: string): string {
    // Take the first 8 characters of the UID
    return uid.substring(0, 8);
  }

  getStoredEmail(): string | null {
    return this.isBrowser ? localStorage.getItem(this.emailForSignInKey) : null;
  }

  registerUser(
    email: string,
    password: string,
    userData: any
  ): Observable<User> {
    if (!this.isBrowser) return of(null as unknown as User);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        return from(
          runInInjectionContext(this.injector, () =>
            createUserWithEmailAndPassword(this.auth, email, password)
          )
        ).pipe(
          switchMap((userCredential) => {
            const user = userCredential.user;
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
            console.error('Error registering user:', error);
            throw error;
          })
        );
      })
    );
  }

  login(email: string, password: string): Observable<boolean> {
    if (!this.isBrowser) return of(false);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        return from(
          runInInjectionContext(this.injector, () =>
            signInWithEmailAndPassword(this.auth, email, password)
          )
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
            console.error('Error during login:', error);
            return of(false);
          })
        );
      })
    );
  }

  logout(): Observable<void> {
    if (!this.isBrowser) return of(undefined);

    return this.waitForAuthInit().pipe(
      switchMap(() => {
        return from(
          runInInjectionContext(this.injector, () => signOut(this.auth))
        ).pipe(
          tap(() => {
            localStorage.removeItem('isLoggedIn');
            // Always navigate to login after logout
            this.router.navigate(['/login']);
          }),
          catchError((error) => {
            console.error('Error during logout:', error);
            throw error;
          })
        );
      })
    );
  }

  getAuthStatus(): Observable<boolean> {
    return this.isLoggedIn$;
  }

  getCurrentUser(): Observable<User | null> {
    return this.user$;
  }

  getUserProfile(uid: string): Observable<any> {
    return this.firestoreService.getDocumentWithLogging<any>(`users/${uid}`);
  }
}
