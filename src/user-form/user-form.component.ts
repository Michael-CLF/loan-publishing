import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { PasswordAuthService } from '../services/password-auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: '../user-form/user-form.component.html',
  styleUrls: ['../user-form/user-form.component.css'],
})
export class UserFormComponent implements OnInit {
  userForm!: FormGroup; // Declare the form group property
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private passwordAuthService: PasswordAuthService
  ) {}

  ngOnInit(): void {
    // Initialize the form group here
    this.userForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      company: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
    });
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
