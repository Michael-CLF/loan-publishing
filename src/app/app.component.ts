import { Component, OnInit, OnDestroy, inject, NgZone, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
import { filter, take, switchMap, tap, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
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
export class AppComponent implements OnInit, OnDestroy {
  // ✅ Angular 18 Best Practice: Use inject() for dependency injection
  private readonly appCheckService = inject(AppCheckService);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  // ✅ Angular 18 Best Practice: Proper cleanup with takeUntil
  private readonly destroy$ = new Subject<void>();

  title = 'Daily Loan Post';
  isRoleSelectionModalOpen = false;
  isAppInitialized = false;

  constructor() {
    // ✅ Angular 18 Best Practice: Keep constructor minimal
  }

  async ngOnInit(): Promise<void> {
    try {
      // ✅ Initialize App Check first for security
     // await this.initializeAppCheck();
      
      this.logEnvironmentInfo();
      this.setupNavigationMonitoring();
      this.setupAuthStateManagement();
      this.handleEmailVerification();
      this.logFirebaseAuthStatus();
      
      this.isAppInitialized = true;
    } catch (error) {
      console.error('Error during app initialization:', error);
      // Still allow app to continue if App Check fails
      this.isAppInitialized = true;
    }
  }

  ngOnDestroy(): void {
    // ✅ Angular 18 Best Practice: Proper cleanup
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * ✅ Angular 18 Best Practice: Initialize App Check with proper error handling
   
  private async initializeAppCheck(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      console.log('⚪ Skipping App Check - not in browser environment');
      return;
    }

    try {
      console.log('🔐 Initializing App Check...');
      await this.appCheckService.initializeAppCheck();
      console.log('✅ App Check initialization completed');
    } catch (error) {
      console.error('❌ App Check initialization failed:', error);
      // Don't throw - allow app to continue
    }
  }

  /**
   * ✅ Angular 18 Best Practice: Extract environment logging to separate method
   */
  private logEnvironmentInfo(): void {
    if (!environment.production) {
      console.log(
        '🌍 Environment:',
        environment.production ? 'Production' : 'Development',
        '🔑 Firebase API Key exists:',
        !!environment.firebase.apiKey,
        '📏 API Key length:',
        environment.firebase.apiKey ? environment.firebase.apiKey.length : 0,
        '🛡️ App Check Key exists:',
        !!environment.appCheckSiteKey
      );
    }
  }

  /**
   * ✅ Angular 18 Best Practice: Extract navigation monitoring with proper cleanup
   */
  private setupNavigationMonitoring(): void {
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationStart || event instanceof NavigationEnd
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          console.log('🧭 Navigation starting to:', event.url);
          if (isPlatformBrowser(this.platformId)) {
            console.log(
              '📍 Redirect URL in storage:',
              localStorage.getItem('redirectUrl')
            );
          }
        }
        
        if (event instanceof NavigationEnd) {
          console.log('✅ Navigation completed to:', event.url);
          
          if (isPlatformBrowser(this.platformId)) {
            // Clear the redirectUrl after successful navigation
            const storedRedirectUrl = localStorage.getItem('redirectUrl');
            if (event.url === storedRedirectUrl) {
              console.log('🗑️ Clearing redirect URL from storage');
              localStorage.removeItem('redirectUrl');
            }
          }
        }
      });
  }

  /**
   * ✅ Angular 18 Best Practice: Extract auth state management with proper cleanup
   */
  private setupAuthStateManagement(): void {
    // Check auth state and handle redirects
    this.authService.authReady$
      .pipe(
        filter((ready) => ready),
        take(1),
        switchMap(() => this.authService.isLoggedIn$),
        takeUntil(this.destroy$)
      )
      .subscribe((isLoggedIn) => {
        console.log('🔐 Auth initialization complete, user logged in:', isLoggedIn);

        if (!isPlatformBrowser(this.platformId)) {
          return; // Skip localStorage operations on server
        }

        // Clear any URL if on home page
        if (this.router.url === '/') {
          localStorage.removeItem('redirectUrl');
        }

        // If user is logged in but on login page, redirect to dashboard/home
        if (isLoggedIn && this.router.url.includes('/login')) {
          console.log('🔄 User is authenticated, redirecting from login');
          const redirectUrl = localStorage.getItem('redirectUrl');

          // Clear the redirect URL before navigating
          localStorage.removeItem('redirectUrl');

          // Navigate to dashboard or home
          this.router.navigate([redirectUrl || '/dashboard']);
        }
        // If user is not logged in and needs auth, redirect to login
        else if (
          !isLoggedIn &&
          !this.isPublicRoute(this.router.url)
        ) {
          console.log('🚫 User not authenticated, redirecting to login');
          localStorage.setItem('redirectUrl', this.router.url);
          this.router.navigate(['/login']);
        }
      });

    // Monitor auth state changes
    this.authService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isLoggedIn) => {
        console.log('🔄 Auth state changed:', isLoggedIn);
        
        if (isPlatformBrowser(this.platformId)) {
          console.log(
            '💾 localStorage isLoggedIn:',
            localStorage.getItem('isLoggedIn')
          );
        }
      });
  }

  /**
   * ✅ Angular 18 Best Practice: Helper method for route checking
   */
  private isPublicRoute(url: string): boolean {
    const publicRoutes = ['/login', '/', '/pricing', '/register', '/forgot-password'];
    return publicRoutes.some(route => url.includes(route));
  }

  /**
   * ✅ Angular 18 Best Practice: Extract Firebase auth status logging
   */
  private logFirebaseAuthStatus(): void {
    if (!environment.production) {
      console.log('🔥 Firebase Auth initialized:', !!this.auth);
      console.log('🛡️ App Check initialized:', this.appCheckService.isInitialized());
    }
  }

  /**
   * ✅ Angular 18 Best Practice: Keep modal methods concise
   */
  openRoleModalFromNavbar(): void {
    console.log('📝 NAVBAR: Opening role selection modal');
    this.isRoleSelectionModalOpen = true;
  }

  /**
   * ✅ Angular 18 Best Practice: Close modal method
   */
  closeRoleModal(): void {
    this.isRoleSelectionModalOpen = false;
  }

  /**
   * ✅ Angular 18 Best Practice: Email verification with proper cleanup and error handling
   */
  private handleEmailVerification(): void {
    console.log('📧 Checking for email verification link...');

    // Check if the current URL is a sign-in link
    this.authService
      .isEmailSignInLink()
      .pipe(
        take(1),
        tap((isSignInLink) => {
          console.log('🔗 Is email sign-in link?', isSignInLink);

          if (isSignInLink) {
            this.handleEmailSignInLink();
          } else if (window.location.pathname === '/') {
            this.handleHomePageAuth();
          }
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  /**
   * ✅ Angular 18 Best Practice: Extract email sign-in link handling
   */
  private handleEmailSignInLink(): void {
    console.log('✉️ Email sign-in link detected, handling authentication flow');

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Get stored email
    const storedEmail = this.authService.getStoredEmail();
    console.log('📨 Stored email found?', !!storedEmail);

    if (storedEmail) {
      // Attempt to sign in with the email link
      this.authService.signInWithEmailLink(storedEmail)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (user: User | null) => {
            if (user) {
              console.log('✅ Sign-in with email link successful:', user.email);
              this.handleSuccessfulAuth();
            } else {
              console.log('❌ Sign-in with email link failed, redirecting to login');
              this.router.navigate(['/login']);
            }
          },
          error: (error: Error) => {
            console.error('❌ Error signing in with email link:', error);
            this.router.navigate(['/login']);
          },
        });
    } else {
      console.log('📧 No stored email found, redirecting to login for manual entry');
      this.router.navigate(['/login']);
    }
  }

  /**
   * ✅ Angular 18 Best Practice: Extract successful auth handling
   */
  private handleSuccessfulAuth(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Set login state explicitly
      localStorage.setItem('isLoggedIn', 'true');
    }

    // Navigate to dashboard
    this.ngZone.run(() => {
      console.log('🏠 Navigating to dashboard after successful auth');
      
      if (
        this.router.url === '/login' ||
        this.router.url.includes('/login/verify')
      ) {
        const redirectUrl = isPlatformBrowser(this.platformId) 
          ? localStorage.getItem('redirectUrl') || '/dashboard'
          : '/dashboard';
          
        this.router.navigate([redirectUrl]);
        
        if (isPlatformBrowser(this.platformId)) {
          localStorage.removeItem('redirectUrl');
        }
      }
    });
  }

  /**
   * ✅ Angular 18 Best Practice: Extract home page auth handling
   */
  private handleHomePageAuth(): void {
    // Check if user is authenticated and at login page, redirect to dashboard if needed
    this.authService.authReady$
      .pipe(
        filter((ready) => ready),
        take(1),
        switchMap(() => this.authService.isLoggedIn$),
        take(1),
        takeUntil(this.destroy$)
      )
      .subscribe((isLoggedIn) => {
        // Only redirect if we're on the login page
        if (
          isLoggedIn &&
          (this.router.url === '/login' ||
            this.router.url.includes('/login/verify'))
        ) {
          console.log('🔄 User is authenticated at login page, redirecting to dashboard');
          this.ngZone.run(() => {
            this.router.navigate(['/dashboard']);
          });
        }
      });
  }
}