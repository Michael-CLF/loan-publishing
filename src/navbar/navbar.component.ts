import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  NgZone,
  DestroyRef,
  HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

// Define user data interface
interface UserData {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  city?: string;
  state?: string;
  createdAt?: any;
  accountNumber?: string;
  [key: string]: any;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  isDropdownOpen = false;
  userData: UserData | null = null;
  loading = false;
  error: string | null = null;
  accountNumber: string = '';
  private authSubscription!: Subscription;
  private userDataSubscription: Subscription | null = null;

  // Inject services
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private firestore = inject(Firestore);
  private destroyRef = inject(DestroyRef);

  userRole: string | null = null;
  getUserDashboardLink(): string {
    return this.userRole === 'lender' ? '/dashboard' : '/dashboard';
  }

  ngOnInit(): void {
    console.log('NavbarComponent - Initializing');

    this.authService.getCurrentUserProfile().subscribe((userProfile) => {
      if (userProfile) {
        this.userRole = userProfile.role || null;
      }
    });

    // Subscribe to authentication state changes
    this.authSubscription = this.authService.isLoggedIn$.subscribe(
      (loggedIn) => {
        console.log('NavbarComponent - Auth state changed:', loggedIn);
        this.isLoggedIn = loggedIn;

        // Load user data when logged in
        if (loggedIn) {
          this.loadUserData();
        } else {
          // Clear user data when logged out
          this.userData = null;
          this.accountNumber = '';
        }
      }
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }

    if (this.userDataSubscription) {
      this.userDataSubscription.unsubscribe();
    }
  }

  toggleAccountDropdown(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
    console.log('Dropdown toggled:', this.isDropdownOpen);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const dropdownElement = document.querySelector('.account-dropdown');
    if (
      dropdownElement &&
      !dropdownElement.contains(event.target as Node) &&
      this.isDropdownOpen
    ) {
      this.ngZone.run(() => {
        this.isDropdownOpen = false;
      });
    }
  }

  loadUserData(): void {
    console.log('NavbarComponent - Loading user data...');
    this.loading = true;
    this.error = null;

    // Get the current authenticated user from AuthService
    this.userDataSubscription = this.authService
      .getCurrentUser()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (user) => {
        // Important debug logs
        console.log('NavbarComponent - Current Auth User:', user?.email);
        console.log('NavbarComponent - Auth UID:', user?.uid);

        if (!user) {
          console.log('NavbarComponent - No authenticated user found');
          this.error = 'Not logged in';
          this.userData = null;
          this.loading = false;
          return;
        }

        try {
          // Generate the shortened UID for the account number
          this.accountNumber = user.uid.substring(0, 8);

          // Get user profile from Firestore using authenticated user's UID
          const userDocRef = doc(this.firestore, `users/${user.uid}`);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            // User profile found with matching UID
            console.log(
              'NavbarComponent - User profile found in Firestore:',
              docSnap.data()
            );

            // Store the user data
            this.userData = {
              id: docSnap.id,
              ...docSnap.data(),
            } as UserData;

            // Additional validation - ensure emails match
            if (this.userData.email && this.userData.email !== user.email) {
              console.warn(
                'NavbarComponent - WARNING: Email mismatch between Auth and Firestore!',
                {
                  authEmail: user.email,
                  firestoreEmail: this.userData.email,
                }
              );
            }

            this.loading = false;
          } else {
            // No user document found with matching UID
            console.error(
              `NavbarComponent - No document found at users/${user.uid}`
            );
            this.error = 'User profile not found';

            // IMPORTANT: Don't fall back to another user's data
            // Just display the authenticated user's email from Firebase Auth
            this.userData = {
              id: user.uid,
              email: user.email || 'Unknown email',
              firstName: 'Account',
              lastName: 'Needs Setup',
            } as UserData;

            this.loading = false;
          }
        } catch (error) {
          console.error('NavbarComponent - Error in loadUserData:', error);
          this.error = 'Error loading profile';

          // Fallback to using just the auth data instead of no data
          this.userData = {
            id: user.uid,
            email: user.email || 'Unknown email',
          } as UserData;

          this.loading = false;
        }
      });
  }

  formatPhoneNumber(phone?: string): string {
    if (!phone) return '';

    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone; // fallback
  }

  logout(): void {
    console.log('NavbarComponent - Logging out...');
    this.loading = true;

    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          console.log('NavbarComponent - Logout successful');
          // Clear local user data immediately
          this.userData = null;
          this.accountNumber = '';
          this.isLoggedIn = false;

          // Additional cleanup
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('redirectUrl');

          // Clear any other auth-related items
          document.cookie.split(';').forEach((c) => {
            document.cookie = c
              .replace(/^ +/, '')
              .replace(
                /=.*/,
                '=;expires=' + new Date().toUTCString() + ';path=/'
              );
          });

          this.router.navigate(['/login']);
        },
        error: (error) => {
          console.error('NavbarComponent - Error during logout:', error);
          this.error = 'Logout failed';
          this.loading = false;
        },
      });
  }
}
