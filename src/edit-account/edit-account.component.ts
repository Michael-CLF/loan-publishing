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
import { firstValueFrom } from 'rxjs';


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

  // edit-account.component.ts
  private async loadUserData(): Promise<void> {
    console.log('EditAccountComponent: Loading user data started');
    this.isLoading = true;
    this.errorMessage = '';

    try {
      const user = await this.authService.getCurrentFirebaseUser();

      if (!user) {
        console.warn('No authenticated user found');
        this.errorMessage = 'Not logged in';
        this.isLoading = false;
        return;
      }

      const firebaseUser = await firstValueFrom(this.authService.getCurrentFirebaseUser());
      if (!firebaseUser) return;

      const uid = firebaseUser.uid;


      this.userId = uid;
      console.log('User ID:', uid);

      const userProfile = await this.authService.getUserProfileById(uid).toPromise();
      if (!userProfile) {
        this.errorMessage = 'User profile not found';
        this.isLoading = false;
        return;
      }

      this.userData = userProfile;
      this.userRole = userProfile.role === 'lender' ? 'lender' : 'originator';
      console.log('User role:', this.userRole);

      // Construct name
      const firstName = userProfile.firstName || '';
      const lastName = userProfile.lastName || '';
      this.userFirstName = firstName;
      this.userFullName = `${firstName} ${lastName}`.trim();

      // Patch form
      this.accountForm.patchValue({
        firstName: firstName,
        lastName: lastName,
        email: userProfile.email || '',
        company: userProfile.company || '',
        phone: userProfile.phone || '',
        city: userProfile.city || '',
        state: userProfile.state || '',
      });

      this.currentEmail = userProfile.email || '';


    } catch (error) {
      console.error('Error loading user data:', error);
      this.errorMessage = 'Failed to load profile data';
    } finally {
      this.isLoading = false;
      console.log('Loading completed');
    }
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
