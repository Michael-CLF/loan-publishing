import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { StateOption } from '../user-form/user-form.component';
import { Firestore } from '@angular/fire/firestore';
import { getUserId } from '../utils/user-helpers';
import { UserData } from '../models/user-data.model';

@Component({
  selector: 'app-edit-account',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-account.component.html',
  styleUrls: ['./edit-account.component.css'],
})
export class EditAccountComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private firestore = inject(Firestore);

  userRole: 'lender' | 'originator' | null = null;

  accountForm!: FormGroup;
  emailChangeForm!: FormGroup;
  showEmailChangeForm = false;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  userId: string | null = null;
  currentEmail = '';
  userFullName = '';
  userFirstName = '';
  userData: UserData = {} as UserData;

  states: StateOption[] = [
    { value: 'AL', name: 'Alabama' },
    // Add all other states here
  ];

  ngOnInit(): void {
    console.log('EditAccountComponent: Starting initialization');
    this.initForms();
    console.log('EditAccountComponent: Forms initialized');
    this.loadUserData();
    console.log('EditAccountComponent: User data load requested');
  }

  private initForms(): void {
    this.accountForm = this.fb.group({
      firstName: [{ value: '', disabled: true }],
      lastName: [{ value: '', disabled: true }],
      company: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z0-9 ]+$/),
        ],
      ],
      email: [{ value: '', disabled: true }],
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[\d\(\)\-\+\s]*$/),
          Validators.minLength(10),
        ],
      ],
      city: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      state: ['', [Validators.required]],

      // Add lender-specific fields to the form
      licenseNumber: [''],
      lenderType: [''],
      minLoanAmount: [0],
      maxLoanAmount: [0],
    });

    this.emailChangeForm = this.fb.group({
      newEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  private loadUserData(): void {
    console.log('EditAccountComponent: Loading user data started');
    this.isLoading = true;
    this.errorMessage = '';

    // Get current user as Observable
    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        console.log(
          'EditAccountComponent: Current user retrieved',
          user ? 'exists' : 'null'
        );

        if (!user) {
          console.log('EditAccountComponent: No authenticated user found');
          this.errorMessage = 'Not logged in';
          this.isLoading = false;
          return;
        }

        this.userId = getUserId(user) || '';
        console.log('EditAccountComponent: User ID:', this.userId);

        const uid = user?.uid || user?.id;
        if (!uid) {
          console.error('EditAccountComponent: No UID found');
          this.isLoading = false;
          return;
        }

        // Since getUserProfile returns a Promise, handle it properly
        this.authService
          .getUserProfile(uid)
          .then((profile) => {
            console.log(
              'EditAccountComponent: Profile retrieved',
              profile ? 'exists' : 'null'
            );

            if (profile) {
              this.userData = profile;
              this.userRole =
                profile.role === 'lender' ? 'lender' : 'originator';
              console.log('EditAccountComponent: User role:', this.userRole);

              const contact =
                this.userRole === 'lender'
                  ? profile['contactInfo'] || {}
                  : profile;

              this.userFirstName = contact.firstName || '';
              this.userFullName = `${contact.firstName || ''} ${
                contact.lastName || ''
              }`.trim();

              // Patch basic form values
              this.accountForm.patchValue({
                firstName: contact.firstName || '',
                lastName: contact.lastName || '',
                email: contact.contactEmail || profile.email || '',
                company: profile.company || '',
                phone: contact.contactPhone || '',
                city: contact.city || '',
                state: contact.state || '',
              });

              // Add lender-specific field values if user is a lender
              if (this.userRole === 'lender') {
                this.accountForm.patchValue({
                  licenseNumber: profile['licenseNumber'] || '',
                  lenderType:
                    profile['productInfo']?.['lenderTypes']?.[0] || '',
                  minLoanAmount: profile['productInfo']?.['minLoanAmount'] || 0,
                  maxLoanAmount: profile['productInfo']?.['maxLoanAmount'] || 0,
                });
              }

              this.currentEmail = contact.contactEmail || profile.email || '';
            } else {
              console.warn('Profile not found, using auth user fallback');
              this.currentEmail = user.email || '';

              this.accountForm.patchValue({
                email: this.currentEmail,
              });

              this.errorMessage =
                'Profile data not found. Please complete your profile.';
            }
          })
          .catch((error) => {
            console.error(
              'EditAccountComponent: Error loading user profile:',
              error
            );
            this.errorMessage = 'Failed to load profile data';
          })
          .finally(() => {
            this.isLoading = false;
            console.log(
              'EditAccountComponent: Loading completed, isLoading set to false'
            );
          });
      },
      error: (err) => {
        console.error('EditAccountComponent: Error getting current user:', err);
        this.errorMessage = 'Authentication error';
        this.isLoading = false;
      },
    });
  }

  onSubmit(): void {
    if (this.accountForm.invalid || !this.userId) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    let formData: any = {
      company: this.accountForm.get('company')?.value || '',
      email: this.currentEmail,
    };

    if (this.userRole === 'originator') {
      formData = {
        ...formData,
        firstName: this.accountForm.get('firstName')?.value || '',
        lastName: this.accountForm.get('lastName')?.value || '',
        phone: this.accountForm.get('phone')?.value || '',
        city: this.accountForm.get('city')?.value || '',
        state: this.accountForm.get('state')?.value || '',
      };
    }

    if (this.userRole === 'lender') {
      formData = {
        ...formData,
        licenseNumber: this.accountForm.get('licenseNumber')?.value || '',
        productInfo: {
          lenderTypes: [this.accountForm.get('lenderType')?.value || ''],
          minLoanAmount: this.accountForm.get('minLoanAmount')?.value || 0,
          maxLoanAmount: this.accountForm.get('maxLoanAmount')?.value || 0,
        },
        contactInfo: {
          firstName: this.accountForm.get('firstName')?.value || '',
          lastName: this.accountForm.get('lastName')?.value || '',
          contactPhone: this.accountForm.get('phone')?.value || '',
          contactEmail: this.currentEmail,
          city: this.accountForm.get('city')?.value || '',
          state: this.accountForm.get('state')?.value || '',
        },
      };
    }

    this.userService
      .updateUser(this.userId, formData, this.userRole)
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage = 'Profile updated successfully!';
          setTimeout(() => this.router.navigate(['/dashboard']), 1500);
        },
        error: (err) => {
          console.error('Failed to update profile:', err);
          this.errorMessage = 'Failed to update profile';
          this.isLoading = false;
        },
      });
  }

  toggleEmailChangeForm(): void {
    this.showEmailChangeForm = !this.showEmailChangeForm;
    if (this.showEmailChangeForm) {
      this.emailChangeForm.reset();
    }
  }

  submitEmailChange(): void {
    if (this.emailChangeForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const { newEmail, password } = this.emailChangeForm.value;

    this.userService
      .initiateEmailChange(this.currentEmail, newEmail, password)
      .subscribe({
        next: () => {
          this.isLoading = false;
          this.successMessage =
            'Email verification sent. Please check your inbox.';
          this.showEmailChangeForm = false;
        },
        error: (err) => {
          console.error('Email change error:', err);
          this.isLoading = false;
          if (err.code === 'auth/wrong-password') {
            this.errorMessage = 'Incorrect password. Please try again.';
          } else if (err.code === 'auth/email-already-in-use') {
            this.errorMessage =
              'This email is already in use by another account.';
          } else {
            this.errorMessage =
              'Failed to initiate email change. Please try again.';
          }
        },
      });
  }

  formatPhoneNumber(): void {
    const phoneControl = this.accountForm.get('phone');
    if (phoneControl) {
      let phone = phoneControl.value || '';
      phone = phone.replace(/\D/g, '');

      if (phone.length === 10) {
        const formattedPhone = `(${phone.slice(0, 3)}) ${phone.slice(
          3,
          6
        )}-${phone.slice(6)}`;
        phoneControl.setValue(formattedPhone, { emitEvent: false });
      }
    }
  }

  cancel(): void {
    this.router.navigate(['/dashboard']);
  }
}
