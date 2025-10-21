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
import { ClarityService } from '../services/clarity.services'

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

  private readonly destroy$ = new Subject<void>();

   constructor(private clarityService: ClarityService) {}
  title = 'Daily Loan Post';
  isRoleSelectionModalOpen = false;
  isAppInitialized = false;

  async ngOnInit(): Promise<void> {
  try {
    this.logEnvironmentInfo();
    this.setupNavigationMonitoring();
    
    // Defer non-critical operations
    if (isPlatformBrowser(this.platformId)) {
      // Only check auth if user is on a protected route
      const protectedRoutes = ['/dashboard', '/loan', '/edit-account'];
      const currentUrl = this.router.url;
      
      if (protectedRoutes.some(route => currentUrl.includes(route))) {
        this.logFirebaseAuthStatus();
        this.authService.initAuthPersistence();
      } else {
        // Defer auth init for public pages
        setTimeout(() => {
          this.logFirebaseAuthStatus();
          this.authService.initAuthPersistence();
        }, 2000);
      }
      
      // Clarity loads after 5 seconds as already set
      setTimeout(() => {
        this.clarityService.initializeClarity();
      }, 5000);
    }

    this.isAppInitialized = true;
  } catch (error) {
    console.error('Error during app initialization:', error);
    this.isAppInitialized = true;
  }
}

  ngOnDestroy(): void {
    // ✅ Angular 18 Best Practice: Proper cleanup
    this.destroy$.next();
    this.destroy$.complete();
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
