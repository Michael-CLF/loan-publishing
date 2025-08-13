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
import { signInWithEmailLink } from '@angular/fire/auth';

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

  async ngOnInit(): Promise<void> {
    this.checkForEmailLink();

    try {
      // ✅ Initialize App Check first for security
      // await this.initializeAppCheck();

      this.logEnvironmentInfo();
      this.setupNavigationMonitoring();
      this.logFirebaseAuthStatus();
      this.authService.initAuthPersistence();

      this.isAppInitialized = true;
    } catch (error) {
      console.error('Error during app initialization:', error);
      // Still allow app to continue if App Check fails
      this.isAppInitialized = true;
    }
  }

  private checkForEmailLink(): void {
    // Don't handle email links if we're on the auth action page
    // The registration-processing component will handle it
    const currentUrl = window.location.href;
    if (currentUrl.includes('/__/auth/action')) {
      console.log('📧 Skipping email link check in app.component - handled by route');
      console.log('🔐 Firebase auth action detected, completing sign-in...');

      // Only check for email links on other pages (for backward compatibility)
      this.authService.handleEmailLinkAuthentication().subscribe({
        next: (result) => {
          if (result.success && result.user) {
            console.log('✅ Email link authentication successful');

            // ✅ Verify account exists and has proper access
            this.authService.checkAccountExists(result.user.email!).subscribe({
              next: (accountInfo) => {
                if (!accountInfo.exists) {
                  console.error('❌ Account not found after auth');
                  this.router.navigate(['/login'], {
                    queryParams: { error: 'Account not found. Please contact support.' }
                  });
                  return;
                }
                if (currentUrl.includes('/registration-processing')) {
                  console.log('📧 On registration-processing page, skipping email link check');
                  return;
                }
                if (accountInfo.needsPayment) {
                  console.error('❌ Account needs payment');
                  this.router.navigate(['/login'], {
                    queryParams: { error: 'Payment required to access your account.' }
                  });
                  return;
                }

                // ✅ SUCCESS: Redirect to dashboard
                console.log('✅ Email link auth complete, redirecting to dashboard');
                this.router.navigate(['/dashboard']);
              },
              error: (error) => {
                console.error('❌ Error validating account:', error);
                this.router.navigate(['/login'], {
                  queryParams: { error: 'Unable to verify account. Please try again.' }
                });
              }
            });
          } else if (result.error && result.error !== 'Not an email link') {
            console.error('❌ Email link authentication failed:', result.error);
            // Don't redirect on email link failure - let the login page handle it
          }
          // If it's not an email link, do nothing (normal app startup)
        },
        error: (error) => {
          console.error('❌ Email link handling error:', error);
        }
      });
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
  // ✅ REPLACE your setupAuthStateManagement method with this simplified version:
  private setupAuthStateManagement(): void {
    // Check auth state and handle basic redirects
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

        // ✅ Simple redirect logic for authenticated users
        if (isLoggedIn) {
          // If user is on any public page, redirect to dashboard
          if (this.isPublicRoute(this.router.url)) {
            console.log('🔄 Authenticated user on public page, redirecting to dashboard');
            this.router.navigate(['/dashboard']);
          }
        }
        // If user is not logged in and needs auth, redirect to login
        else if (!isLoggedIn && !this.isPublicRoute(this.router.url)) {
          console.log('🚫 User not authenticated, redirecting to login');
          localStorage.setItem('redirectUrl', this.router.url);
          this.router.navigate(['/login']);
        }
      });

    // Monitor auth state changes (keep this for debugging)
    this.authService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isLoggedIn) => {
        console.log('🔄 Auth state changed:', isLoggedIn);
        if (isPlatformBrowser(this.platformId)) {
          console.log('💾 localStorage isLoggedIn:', localStorage.getItem('isLoggedIn'));
        }
      });
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

}
