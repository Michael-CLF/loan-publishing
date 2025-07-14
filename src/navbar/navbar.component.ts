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
import { Subscription, from } from 'rxjs';
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

  ngOnInit(): void {
    console.log('NavbarComponent - Initializing');

    this.authService.getCurrentFirebaseUser().then((userProfile: any) => {
      if (userProfile) {
        this.userRole = userProfile.role || null;
        this.loadUserData(userProfile);
      }
    });

    this.authSubscription = this.authService.isLoggedIn$.subscribe(
      (loggedIn) => {
        console.log('NavbarComponent - Auth state changed:', loggedIn);
        this.isLoggedIn = loggedIn;
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

  async loadUserData(user: any): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const role = user.role || '';
      const userDocRef = doc(this.firestore, `${role}s/${user.uid}`);
      const docSnap = await getDoc(userDocRef);

      if (!docSnap.exists()) {
        throw new Error('User document does not exist');
      }

      const data = docSnap.data();
      const contact = data['contactInfo'] || {};

      const toTitleCase = (str: string): string =>
        str
          .split(' ')
          .map(
            (word) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          )
          .join(' ');

      this.userData = {
        id: docSnap.id,
        email: contact.contactEmail || data['email'] || '',
        firstName: contact.firstName || data['firstName'] || '',
        lastName: contact.lastName || data['lastName'] || '',
        phone: contact.contactPhone || data['phone'] || '',
        city: contact.city || data['city'] || '',
        state: toTitleCase(contact.state || data['state'] || ''),
        company: contact.company || data['company'] || '',
        role: data['role'] || role,
        accountNumber: this.accountNumber,
      };

      console.log('NavbarComponent - Final userData:', this.userData);

      if (this.userData.email && this.userData.email !== user.email) {
        console.warn('NavbarComponent - Email mismatch!', {
          authEmail: user.email,
          firestoreEmail: this.userData.email,
        });
      }
    } catch (error) {
      console.error('NavbarComponent - Error loading user:', error);
      this.error = 'Error loading profile';
      this.userData = {
        id: user.uid || '',
        email: user.email || 'Unknown email',
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
