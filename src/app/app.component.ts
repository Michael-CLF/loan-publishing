import { Component, OnInit, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterOutlet,
  Router,
  NavigationStart,
  NavigationEnd,
} from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { environment } from '../environments/environment';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Auth, User } from '@angular/fire/auth';
import { filter, take, switchMap, tap } from 'rxjs/operators';
import { AppCheckService } from '../services/app-check.service';

declare let gtag: Function;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    HeaderComponent,
    FooterComponent,
    NavbarComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  // ✅ Angular 18 Best Practice: Use inject() for dependency injection
  private readonly appCheckService = inject(AppCheckService);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  title = 'Daily Loan Post';
  isRoleSelectionModalOpen = false;

  constructor() {
    // ✅ Angular 18 Best Practice: Keep constructor minimal
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {});
  }

  async ngOnInit(): Promise<void> {
    // ✅ Angular 18 Best Practice: Initialize App Check first before any Firebase operations
    await this.initializeAppCheck();
    
    // ✅ Continue with rest of initialization after App Check is ready
    this.logEnvironmentInfo();
    this.setupNavigationMonitoring();
    this.setupAuthStateManagement();
    this.handleEmailVerification();
    this.logFirebaseAuthStatus();
  }

  /**
   * ✅ Angular 18 Best Practice: Separate App Check initialization with proper error handling
   */
  private async initializeAppCheck(): Promise<void> {
    try {
      console.log('🟡 Initializing Firebase App Check...');
      await this.appCheckService.initializeAppCheck();
      console.log('✅ App Check initialized successfully - ready for Firebase calls');
    } catch (error) {
      console.error('❌ App Check initialization failed:', error);
      // ✅ Don't throw - allow app to continue with reduced functionality
      console.warn('⚠️ App will continue without App Check - some Firebase operations may fail');
    }
  }

  /**
   * ✅ Angular 18 Best Practice: Extract environment logging to separate method
   */
  private logEnvironmentInfo(): void {
    console.log(
      'Environment check:',
      environment.production ? 'Production' : 'Development',
      'API Key exists:',
      !!environment.firebase.apiKey,
      'API Key length:',
      environment.firebase.apiKey ? environment.firebase.apiKey.length : 0
    );
  }

  /**
   * ✅ Angular 18 Best Practice: Extract navigation monitoring to separate method
   */
  private setupNavigationMonitoring(): void {
    // Monitor navigation events
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationStart || event instanceof NavigationEnd
        )
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          console.log('Navigation starting to:', event.url);
          console.log(
            'Redirect URL in storage:',
            localStorage.getItem('redirectUrl')
          );
        }
        if (event instanceof NavigationEnd) {
          console.log('Navigation completed to:', event.url);
          // Clear the redirectUrl after successful navigation
          if (event.url === localStorage.getItem('redirectUrl')) {
            console.log('Clearing redirect URL from storage');
            localStorage.removeItem('redirectUrl');
          }
        }
      });
  }

  /**
   * ✅ Angular 18 Best Practice: Extract auth state management to separate method
   */
  private setupAuthStateManagement(): void {
    // Check auth state and handle redirects
    this.authService.authReady$
      .pipe(
        filter((ready) => ready),
        take(1),
        switchMap(() => this.authService.isLoggedIn$)
      )
      .subscribe((isLoggedIn) => {
        console.log(
          'Auth initialization complete, user logged in:',
          isLoggedIn
        );

        // Clear any URL if on home page
        if (this.router.url === '/') {
          localStorage.removeItem('redirectUrl');
        }

        // If user is logged in but on login page, redirect to dashboard/home
        if (isLoggedIn && this.router.url.includes('/login')) {
          console.log('User is authenticated, redirecting from login');
          const redirectUrl = localStorage.getItem('redirectUrl');

          // Clear the redirect URL before navigating
          localStorage.removeItem('redirectUrl');

          // Navigate to dashboard or home
          this.router.navigate([redirectUrl || '/dashboard']);
        }
        // If user is not logged in and needs auth, redirect to login
        else if (
          !isLoggedIn &&
          !this.router.url.includes('/login') &&
          !this.router.url.includes('/') &&
          !this.router.url.includes('/pricing')
        ) {
          console.log('User not authenticated, redirecting to login');
          localStorage.setItem('redirectUrl', this.router.url);
          this.router.navigate(['/login']);
        }
      });

    // Check auth state
    this.authService.isLoggedIn$.subscribe((isLoggedIn) => {
      console.log('Auth state:', isLoggedIn);
      console.log(
        'localStorage isLoggedIn:',
        localStorage.getItem('isLoggedIn')
      );
    });
  }

  /**
   * ✅ Angular 18 Best Practice: Extract Firebase auth status logging
   */
  private logFirebaseAuthStatus(): void {
    console.log('Firebase Auth initialized:', !!this.auth);
  }

  /**
   * ✅ Angular 18 Best Practice: Keep modal methods concise
   */
  openRoleModalFromNavbar(): void {
    console.log('NAVBAR: CLICK WORKS');
    this.isRoleSelectionModalOpen = true;
  }

  /**
   * ✅ Angular 18 Best Practice: Email verification as separate method with proper error handling
   */
  private handleEmailVerification(): void {
    console.log('Checking for email verification link...');

    // Check if the current URL is a sign-in link
    this.authService
      .isEmailSignInLink()
      .pipe(
        take(1),
        tap((isSignInLink) => {
          console.log('Is email sign-in link?', isSignInLink);

          if (isSignInLink) {
            console.log(
              'Email sign-in link detected, handling authentication flow'
            );

            // Get stored email
            const storedEmail = this.authService.getStoredEmail();
            console.log('Stored email found?', !!storedEmail);

            if (storedEmail) {
              // Attempt to sign in with the email link
              this.authService.signInWithEmailLink(storedEmail).subscribe({
                next: (user: User | null) => {
                  if (user) {
                    console.log(
                      'Sign-in with email link successful:',
                      user.email
                    );

                    // Set login state explicitly
                    localStorage.setItem('isLoggedIn', 'true');

                    // Navigate to dashboard
                    this.ngZone.run(() => {
                      console.log(
                        'Navigating to dashboard after successful auth'
                      );
                      if (
                        this.router.url === '/login' ||
                        this.router.url.includes('/login/verify')
                      ) {
                        const redirectUrl =
                          localStorage.getItem('redirectUrl') || '/dashboard';
                        this.router.navigate([redirectUrl]);
                        localStorage.removeItem('redirectUrl');
                      }
                    });
                  } else {
                    console.log(
                      'Sign-in with email link failed, redirecting to login'
                    );
                    this.router.navigate(['/login']);
                  }
                },
                error: (error: Error) => {
                  console.error('Error signing in with email link:', error);
                  this.router.navigate(['/login']);
                },
              });
            } else {
              console.log(
                'No stored email found, redirecting to login for manual entry'
              );
              // Redirect to login page to handle the verification there
              this.router.navigate(['/login']);
            }
          } else if (window.location.pathname === '/') {
            // Check if user is authenticated and at login page, redirect to dashboard if needed
            this.authService.authReady$
              .pipe(
                filter((ready) => ready),
                take(1),
                switchMap(() => this.authService.isLoggedIn$),
                take(1)
              )
              .subscribe((isLoggedIn) => {
                // Only redirect if we're on the login page
                if (
                  isLoggedIn &&
                  (this.router.url === '/login' ||
                    this.router.url.includes('/login/verify'))
                ) {
                  console.log(
                    'User is authenticated at login page, redirecting to dashboard'
                  );
                  this.ngZone.run(() => {
                    this.router.navigate(['/dashboard']);
                  });
                }
              });
          }
        })
      )
      .subscribe();
  }
}