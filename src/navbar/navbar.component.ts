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
import { Subscription, firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { AuthService } from '../services/auth.service';
import { ModalService } from '../services/modal.service';
import { RoleSelectionModalComponent } from '../role-selection-modal/role-selection-modal.component';
import { User } from '@angular/fire/auth'; // ✅ Make sure User is imported

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
  role?: string;
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
  accountNumber = '';
  userRole: string | null = null;

  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private firestore = inject(Firestore);
  private destroyRef = inject(DestroyRef);
  private modalService = inject(ModalService);

  private authSubscription!: Subscription;

async ngOnInit(): Promise<void> {
  console.log('NavbarComponent - Initializing');
  
  // ✅ Set initial loading state
  this.loading = true;

  // ✅ Subscribe to auth state changes first - same structure you have
  this.authSubscription = this.authService.isLoggedIn$.subscribe(
    async (loggedIn) => {
      console.log('NavbarComponent - Auth state changed:', loggedIn);
      this.isLoggedIn = loggedIn;
      
      if (loggedIn) {
        // ✅ User is logged in, load their data using your existing method
        try {
          const userProfile: User | null = await firstValueFrom(
            this.authService.getCurrentFirebaseUser()
          );

          if (userProfile) {
            this.userRole = (userProfile as any).role || null; // 🔁 Keep your existing logic
            await this.loadUserData(userProfile); // ✅ Use your existing method
          }
        } catch (err) {
          console.error('NavbarComponent - Error retrieving user profile:', err);
          this.loading = false;
        }
      } else {
        // ✅ User is not logged in, clear data
        this.userData = null;
        this.accountNumber = '';
        this.loading = false;
      }
    }
  );
}

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  openRoleSelectionModal(): void {
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

async loadUserData(user: User): Promise<void> {
  this.loading = true;
  this.error = null;

  try {
    // ✅ Use the existing auth service method that properly checks both collections
    const userProfile = await firstValueFrom(this.authService.getUserProfile());

    if (!userProfile) {
      throw new Error('User document does not exist');
    }

    // ✅ Set account number
    this.accountNumber = user.uid.substring(0, 8);

    // ✅ Handle nested contactInfo structure like we did in dashboard
    this.userData = {
      id: userProfile.id,
      email: userProfile['contactInfo']?.contactEmail || userProfile.email || user.email || '',
      firstName: userProfile['contactInfo']?.firstName || userProfile.firstName || '',
      lastName: userProfile['contactInfo']?.lastName || userProfile.lastName || '',
      phone: userProfile['contactInfo']?.contactPhone || userProfile.phone || '',
      city: userProfile['contactInfo']?.city || userProfile.city || '',
      state: userProfile['contactInfo']?.state || userProfile.state || '',
      company: userProfile['contactInfo']?.company || userProfile.company || '',
      role: userProfile.role || '',
      accountNumber: this.accountNumber,
    };

    console.log('NavbarComponent - Final userData:', this.userData);
    console.log('NavbarComponent - Original userProfile:', userProfile);

  } catch (error) {
    console.error('NavbarComponent - Error loading user:', error);
    this.error = 'Error loading profile';
    this.userData = {
      id: user.uid || '',
      email: user.email || 'Unknown email',
      accountNumber: user.uid?.substring(0, 8) || '',
    };
  } finally {
    this.loading = false;
  }
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
