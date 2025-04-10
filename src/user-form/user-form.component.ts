import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { Observable } from 'rxjs';
import { FirestoreService } from '../services/firestore.service';

// Update the interface to match all your form fields
interface User {
  id?: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  password: string; // Note: Consider if you really want to store passwords in Firestore
  phone: string;
  city: string;
  state: string;
  createdAt: Date;
}

@Component({
  selector: 'app-user-form',
  standalone: true, // Add standalone: true for standalone components
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.css',
})
export class UserFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private firestoreService = inject(FirestoreService);

  userForm: FormGroup = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    company: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]], // Add email validator
    password: ['', [Validators.required, Validators.minLength(6)]], // Add min length validator
    phone: ['', Validators.required],
    city: ['', Validators.required],
    state: ['', Validators.required],
  });

  users$!: Observable<User[]>;
  successMessage: string = '';
  errorMessage: string = '';

  ngOnInit(): void {
    this.users$ = this.firestoreService.getCollection<User>('users');
  }

  onSubmit(): void {
    if (this.userForm.valid) {
      const userData: User = {
        firstName: this.userForm.value.firstName,
        lastName: this.userForm.value.lastName,
        company: this.userForm.value.company,
        city: this.userForm.value.city,
        email: this.userForm.value.email,
        password: this.userForm.value.password,
        phone: this.userForm.value.phone,
        state: this.userForm.value.state,
        createdAt: new Date(),
      };

      this.firestoreService
        .addDocument('users', userData)
        .then(() => {
          this.successMessage = 'User saved successfully!';
          this.errorMessage = '';
          this.userForm.reset();
          setTimeout(() => (this.successMessage = ''), 3000);
        })
        .catch((error: Error) => {
          // Add explicit type for error
          console.error('Error adding document: ', error);
          this.errorMessage = 'Error: Could not save user';
          this.successMessage = '';
        });
    } else {
      // Mark all controls as touched to show validation errors
      Object.keys(this.userForm.controls).forEach((key) => {
        const control = this.userForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  // Convenience getter for easy access to form fields
  get f() {
    return this.userForm.controls;
  }
}
