// Dashboard component TS
import {
  Component,
  OnInit,
  inject,
  NgZone,
  DestroyRef,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { User } from '@angular/fire/auth';
import { take, switchMap, tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  DocumentData,
} from '@angular/fire/firestore';

// Define a type for our user data
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
  accountNumber?: string; // Optional property
  [key: string]: any; // Allow for additional properties
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private firestore = inject(Firestore);

  user: User | null = null;
  userData: UserData | null = null;
  loading = true;
  error: string | null = null;
  accountNumber: string = ''; // Add this property to the component

  ngOnInit(): void {
    console.log('Dashboard component initializing...');
    this.loadUserData();
  }

  loadUserData(): void {
    console.log('Loading user data...');
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
          .pipe(take(1))
          .subscribe(async (user) => {
            if (user) {
              console.log('Authenticated user:', user.email);
              console.log('Authenticated user UID:', user.uid);
              this.user = user;

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
                    console.log(
                      'Using first available user for testing:',
                      allUsers[0]
                    );
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
