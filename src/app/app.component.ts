// src/app/app.component.ts
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  NgZone,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  RouterOutlet,
  Router,
  NavigationStart,
  NavigationEnd,
  NavigationError,
} from '@angular/router';
import { HeaderComponent } from '../components/header/header.component';
import { FooterComponent } from '../components/footer/footer.component';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { environment } from '../environments/environment';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import {
  Auth,
  setPersistence,
  browserLocalPersistence,
} from '@angular/fire/auth';
import { filter, take, switchMap, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { AppCheckService } from '../services/app-check.service';
import { ClarityService } from '../services/clarity.services';

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
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  // services
  private readonly appCheckService = inject(AppCheckService);
  private readonly auth = inject(Auth);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  // lifecycle
  private readonly destroy$ = new Subject<void>();

  // controls whether navbar/header/footer render
  showUserChrome = signal<boolean>(true);

  constructor(private clarityService: ClarityService) {}

  title = 'Daily Loan Post';
  isRoleSelectionModalOpen = false;
  isAppInitialized = false;

  // ---------- init ----------
  async ngOnInit(): Promise<void> {
    try {
      this.logEnvironmentInfo();
      this.setupNavigationMonitoring(); // also updates showUserChrome on each nav
      this.setupAuthStateManagement();

      // set initial chrome visibility for first load
      this.showUserChrome.set(!this.isAdminUrl(this.router.url));

      if (isPlatformBrowser(this.platformId)) {
        const currentUrl = this.router.url;
        if (currentUrl === '/' || currentUrl === '/home' || currentUrl === '') {
          // skip auth bootstrap on pure public home
          console.log('On home page, skipping auth initialization');
        } else {
          this.logFirebaseAuthStatus();
          await this.initAuthPersistence();
        }

        // defer Clarity
        setTimeout(() => this.clarityService.initializeClarity(), 5000);
      }

      this.isAppInitialized = true;
    } catch (error) {
      console.error('Error during app initialization:', error);
      this.isAppInitialized = true;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---------- helpers ----------
  private async initAuthPersistence(): Promise<void> {
    try {
      await setPersistence(this.auth, browserLocalPersistence);
      console.log(
        '✅ Firebase Auth Persistence set to browserLocalPersistence.'
      );
    } catch (error) {
      console.error('❌ Failed to set Firebase persistence:', error);
    }
  }

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

  private logFirebaseAuthStatus(): void {
    if (!environment.production) {
      console.log('🔥 Firebase Auth initialized:', !!this.auth);
      console.log(
        '🛡️ App Check initialized:',
        this.appCheckService.isInitialized()
      );
    }
  }

  private isPublicRoute(url: string): boolean {
    const publicRoutes = [
      '/login',
      '/',
      '/pricing',
      '/register',
      '/forgot-password',
    ];
    return publicRoutes.some((route) => url.includes(route));
  }

  private isAdminUrl(url: string): boolean {
    const path = (url || '/').split('?')[0].split('#')[0];
    return path === '/admin' || path.startsWith('/admin/');
  }

  // ---------- routing observers ----------
  private setupNavigationMonitoring(): void {
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationStart ||
            event instanceof NavigationEnd ||
            event instanceof NavigationError
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
          const url = event.urlAfterRedirects || event.url;
          console.log('✅ Navigation completed to:', url);

          // update chrome visibility whenever we land on a new route
          this.showUserChrome.set(!this.isAdminUrl(url));

          if (isPlatformBrowser(this.platformId)) {
            const stored = localStorage.getItem('redirectUrl');
            if (stored && stored === url) {
              console.log('🗑️ Clearing redirect URL from storage');
              localStorage.removeItem('redirectUrl');
            }
          }
        }

        if (event instanceof NavigationError) {
          console.error('❌ Navigation error:', event.error);
          console.error('Failed URL:', event.url);
        }
      });
  }

  private setupAuthStateManagement(): void {
    this.authService.authReady$
      .pipe(
        filter((ready) => ready),
        take(1),
        switchMap(() => this.authService.isLoggedIn$),
        takeUntil(this.destroy$)
      )
      .subscribe((isLoggedIn) => {
        console.log(
          '🔐 Auth initialization complete, user logged in:',
          isLoggedIn
        );

        if (!isPlatformBrowser(this.platformId)) return;

        // Admin routes: only require auth, never auto-redirect to pricing, and never render navbar
        if (this.router.url.includes('/admin')) {
          if (!isLoggedIn) {
            localStorage.setItem('redirectUrl', this.router.url);
            this.router.navigate(['/login']);
          }
          return;
        }

        if (isLoggedIn) {
          // if there is a pending post-login target, let that logic handle it
          const pendingNext =
            localStorage.getItem('postLoginNext') ||
            localStorage.getItem('redirectUrl');
          if (pendingNext) return;

          // collapse public pages to user dashboard
          if (this.isPublicRoute(this.router.url)) {
            this.router.navigate(['/dashboard']);
          }
        } else if (!this.isPublicRoute(this.router.url)) {
          // not logged in and trying to access a protected user route
          localStorage.setItem('redirectUrl', this.router.url);
          this.router.navigate(['/login']);
        }
      });

    // debug listener
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

  // ---------- modal controls ----------
  openRoleModalFromNavbar(): void {
    console.log('📝 NAVBAR: Opening role selection modal');
    this.isRoleSelectionModalOpen = true;
  }

  closeRoleModal(): void {
    this.isRoleSelectionModalOpen = false;
  }
}
