import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
  NgZone,
  DestroyRef,
  ViewChild,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { ModalService } from '../services/modal.service';
import { RoleSelectionModalComponent } from '../role-selection-modal/role-selection-modal.component';

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
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  @ViewChild(RoleSelectionModalComponent)
  roleModal!: RoleSelectionModalComponent;
  isLoggedIn = false;
  isDropdownOpen = false;
  userData: UserData | null = null;
  loading = false;
  error: string | null = null;
  accountNumber: string = '';
  userRole: string | null = null;

  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private firestore = inject(Firestore);
  private destroyRef = inject(DestroyRef);
  private modalService = inject(ModalService);

  private authSubscription!: Subscription;
  private userDataSubscription: Subscription | null = null;

  ngOnInit(): void {
    console.log('NavbarComponent - Initializing');

    this.authService.getCurrentUserProfile().subscribe((userProfile) => {
      if (userProfile) {
        this.userRole = userProfile.role || null;
      }
    });

    this.authSubscription = this.authService.isLoggedIn$.subscribe(
      (loggedIn) => {
        console.log('NavbarComponent - Auth state changed:', loggedIn);
        this.isLoggedIn = loggedIn;

        if (loggedIn) {
          this.loadUserData();
        } else {
          this.userData = null;
          this.accountNumber = '';
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
    if (this.userDataSubscription) {
      this.userDataSubscription.unsubscribe();
    }
  }

  openRoleSelectionModal(): void {
    // Simply use the modal service and nothing else
    this.modalService.openRoleSelectionModal();
    console.log('NavbarComponent - Opening role selection modal');
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

  /**
   * Load user data from Firestore
   */
  loadUserData(): void {
    console.log('NavbarComponent - Loading user data...');
    this.loading = true;
    this.error = null;

    this.userDataSubscription = this.authService
      .getCurrentUser()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (user) => {
        console.log('NavbarComponent - Current Auth User:', user?.email);

        if (!user) {
          this.error = 'Not logged in';
          this.userData = null;
          this.loading = false;
          return;
        }

        try {
          this.accountNumber = user?.uid?.substring(0, 8) || '';

          const uid = user?.uid || user?.id || '';
          const role = user?.role || 'originator';
          const collection = role === 'lender' ? 'lenders' : 'users';
          const userDocRef = doc(this.firestore, `${collection}/${uid}`);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const data = docSnap.data();

            if (role === 'lender') {
              // For lenders, structure uses contactInfo nested object
              this.userData = {
                id: docSnap.id,
                firstName: data['contactInfo']?.firstName || '',
                lastName: data['contactInfo']?.lastName || '',
                email: data['contactInfo']?.contactEmail || '',
                phone: data['contactInfo']?.contactPhone || '',
                city: data['contactInfo']?.city || '',
                state: data['contactInfo']?.state || '',
                company: data['contactInfo']?.company || '',
                role: data['role'] || '',
                accountNumber: this.accountNumber,
              };
            } else {
              // For originators, structure has properties at top level
              this.userData = {
                id: docSnap.id,
                firstName: data['firstName'] || '',
                lastName: data['lastName'] || '',
                email: data['email'] || '',
                phone: data['phone'] || '',
                city: data['city'] || '',
                state: data['state'] || '',
                company: data['company'] || '',
                role: data['role'] || '',
                accountNumber: this.accountNumber,
              };
            }

            if (this.userData.email && this.userData.email !== user.email) {
              console.warn('NavbarComponent - Email mismatch!', {
                authEmail: user.email,
                firestoreEmail: this.userData.email,
              });
            }

            this.loading = false;
          } else {
            console.error(
              `NavbarComponent - No document at ${collection}/${uid}`
            );
            this.error = 'User profile not found';
            this.userData = {
              id: uid,
              email: user.email || 'Unknown email',
              firstName: 'Account',
              lastName: 'Needs Setup',
            };
            this.loading = false;
          }
        } catch (error) {
          console.error('NavbarComponent - Error loading user:', error);
          this.error = 'Error loading profile';
          this.userData = {
            id: user['uid'] !== undefined ? user['uid'] : '',
            email: user.email || 'Unknown email',
          };
          this.loading = false;
        }
      });
  }

  formatPhoneNumber(phone?: string): string {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
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
          this.userData = null;
          this.accountNumber = '';
          this.isLoggedIn = false;

          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('redirectUrl');

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
          console.error('NavbarComponent - Logout error:', error);
          this.error = 'Logout failed';
          this.loading = false;
        },
      });
  }
}
