import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { PasswordAuthService } from '../services/password-auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css'],
})
export class UserFormComponent implements OnInit {
  userForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  phone: any;

  constructor(
    private fb: FormBuilder,
    private passwordAuthService: PasswordAuthService
  ) {}

  ngOnInit(): void {
    this.userForm = this.fb.group({
      firstName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      lastName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z ]+$/),
        ],
      ],
      company: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-z0-9 ]+$/),
        ],
      ],
      email: ['', [Validators.required, Validators.email]],
      phone: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[\d\(\)\-\+\s]*$/),
          Validators.minLength(14),
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
    });
  }

  // This method formats the phone number
  formatPhoneNumber(): void {
    let phone = this.userForm.get('phone')?.value;
    if (phone) {
      phone = phone.replace(/\D/g, ''); // Remove non-numeric characters
      if (phone.length === 10) {
        phone = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
        this.userForm.get('phone')?.setValue(phone);
      }
    }
  }

  onSubmit(): void {
    if (this.userForm.invalid) return;

    this.isLoading = true;
    const { firstName, lastName, company, email, phone, city, state } =
      this.userForm.value;

    this.passwordAuthService
      .registerUser(email, 'defaultpassword', {
        firstName,
        lastName,
        company,
        email,
        phone,
        city,
        state,
      })
      .subscribe(
        (user) => {
          this.isLoading = false;
          this.successMessage = 'Registration successful!';
        },
        (error) => {
          this.isLoading = false;
          this.errorMessage = 'Registration failed. Please try again.';
        }
      );
  }
}
