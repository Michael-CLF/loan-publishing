import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  NgZone,
  Injector,
  runInInjectionContext,
  DestroyRef,
  HostListener,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';

// Define user data interface (same as in dashboard)
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

  // Inject services
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private injector = inject(Injector);
  private firestore = inject(Firestore);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // Subscribe to authentication state changes
    this.authSubscription = this.authService.isLoggedIn$.subscribe(
      (loggedIn) => {
        this.isLoggedIn = loggedIn;

        // Load user data when logged in
        if (loggedIn) {
          this.loadUserData();
        }
      }
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
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
    console.log('Loading user data in navbar...');
    this.loading = true;
    this.error = null;

    runInInjectionContext(this.injector, async () => {
      try {
        // Get all users in the collection first to see what's available
        console.log('Fetching all users in collection...');
        const usersCollectionRef = collection(this.firestore, 'users');
        const querySnapshot = await getDocs(usersCollectionRef);

        console.log('All users in collection:');
        let foundUsers = false;
        const allUsers: UserData[] = [];

        querySnapshot.forEach((doc) => {
          foundUsers = true;
          const userData = doc.data();
          allUsers.push({ id: doc.id, ...userData } as UserData);
          console.log(`User document: ${doc.id}`, userData);
        });

        if (!foundUsers) {
          console.log('No user documents found in the users collection');
          this.error = 'No users found in database';
          this.loading = false;
          return;
        }

        // Now get the current authenticated user
        this.authService
          .getCurrentUser()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(async (user) => {
            if (user) {
              console.log('Authenticated user:', user.email);
              console.log('Authenticated user UID:', user.uid);

              // Generate the shortened UID for the account number
              this.accountNumber = user.uid.substring(0, 8);

              // First try the direct path with the user's UID
              const userDocRef = doc(this.firestore, `users/${user.uid}`);
              const docSnap = await runInInjectionContext(this.injector, () =>
                getDoc(userDocRef)
              );

              if (docSnap.exists()) {
                // Success! Document found with matching UID
                console.log('User profile found!', docSnap.data());
                this.userData = {
                  id: docSnap.id,
                  ...docSnap.data(),
                } as UserData;
                this.loading = false;
              } else {
                console.log(`No document found at users/${user.uid}`);

                // Look for a document with matching email instead
                const authenticatedEmail = user.email?.toLowerCase();
                console.log(
                  'Looking for documents with matching email:',
                  authenticatedEmail
                );

                let foundByEmail = false;

                if (authenticatedEmail) {
                  for (const docData of allUsers) {
                    if (
                      docData.email &&
                      docData.email.toLowerCase() === authenticatedEmail
                    ) {
                      console.log(
                        `Found matching email in document with ID: ${docData.id}`
                      );
                      this.userData = docData;
                      foundByEmail = true;
                      this.loading = false;
                      break;
                    }
                  }
                }

                if (!foundByEmail) {
                  // No matching document by UID or email
                  console.log('No matching user document found');
                  this.error = 'User profile not found';
                  this.loading = false;

                  // Just use the first user in the collection for testing
                  if (allUsers.length > 0) {
                    console.log('Using available user data:', allUsers[0]);
                    this.userData = allUsers[0];
                    this.error = `Using test user: ${
                      allUsers[0].email || 'Unknown'
                    }`;
                  }
                }
              }
            } else {
              console.log('No user logged in');
              this.error = 'Not logged in';
              this.loading = false;
            }
          });
      } catch (error) {
        console.error('Error in loadUserData:', error);
        this.error =
          'Error fetching data: ' +
          (error instanceof Error ? error.message : String(error));
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
    console.log('Logging out...');
    this.loading = true;

    this.authService
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          console.log('Logout successful');
          this.router.navigate(['/login']);
        },
        error: (error) => {
          console.error('Error during logout:', error);
          this.error = 'Error during logout';
          this.loading = false;
        },
      });
  }
}
