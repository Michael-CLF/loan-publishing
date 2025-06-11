import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';
import { HttpClientModule } from '@angular/common/http';
import { EmailNotificationService } from 'src/services/email-notification.service';


@Component({
  selector: 'app-event-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './event-registration.component.html',
  styleUrls: ['./event-registration.component.css']
})
export class EventRegistrationComponent implements OnInit {
  eventForm!: FormGroup;
  states = [
    { value: 'AL', name: 'Alabama' },
    { value: 'AK', name: 'Alaska' },
    { value: 'AZ', name: 'Arizona' },
    { value: 'AR', name: 'Arkansas' },
    { value: 'CA', name: 'California' },
    { value: 'CO', name: 'Colorado' },
    { value: 'CT', name: 'Connecticut' },
    { value: 'DE', name: 'Delaware' },
    { value: 'FL', name: 'Florida' },
    { value: 'GA', name: 'Georgia' },
    { value: 'HI', name: 'Hawaii' },
    { value: 'ID', name: 'Idaho' },
    { value: 'IL', name: 'Illinois' },
    { value: 'IN', name: 'Indiana' },
    { value: 'IA', name: 'Iowa' },
    { value: 'KS', name: 'Kansas' },
    { value: 'KY', name: 'Kentucky' },
    { value: 'LA', name: 'Louisiana' },
    { value: 'ME', name: 'Maine' },
    { value: 'MD', name: 'Maryland' },
    { value: 'MA', name: 'Massachusetts' },
    { value: 'MI', name: 'Michigan' },
    { value: 'MN', name: 'Minnesota' },
    { value: 'MS', name: 'Mississippi' },
    { value: 'MO', name: 'Missouri' },
    { value: 'MT', name: 'Montana' },
    { value: 'NE', name: 'Nebraska' },
    { value: 'NV', name: 'Nevada' },
    { value: 'NH', name: 'New Hampshire' },
    { value: 'NJ', name: 'New Jersey' },
    { value: 'NM', name: 'New Mexico' },
    { value: 'NY', name: 'New York' },
    { value: 'NC', name: 'North Carolina' },
    { value: 'ND', name: 'North Dakota' },
    { value: 'OH', name: 'Ohio' },
    { value: 'OK', name: 'Oklahoma' },
    { value: 'OR', name: 'Oregon' },
    { value: 'PA', name: 'Pennsylvania' },
    { value: 'RI', name: 'Rhode Island' },
    { value: 'SC', name: 'South Carolina' },
    { value: 'SD', name: 'South Dakota' },
    { value: 'TN', name: 'Tennessee' },
    { value: 'TX', name: 'Texas' },
    { value: 'UT', name: 'Utah' },
    { value: 'VT', name: 'Vermont' },
    { value: 'VA', name: 'Virginia' },
    { value: 'WA', name: 'Washington' },
    { value: 'WV', name: 'West Virginia' },
    { value: 'WI', name: 'Wisconsin' },
    { value: 'WY', name: 'Wyoming' }
  ];

  successMessage = '';
  errorMessage = '';
  isLoading = false;

  private fb = inject(FormBuilder);
  private firestore = inject(Firestore);
  private emailNotificationService = inject(EmailNotificationService);

  ngOnInit(): void {
    this.eventForm = this.fb.group({
      company: ['', [Validators.required, Validators.minLength(2), Validators.pattern('[a-zA-Z .&\\-]*')]],
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.pattern('[a-zA-Z .\\-]*')]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.pattern('[a-zA-Z .\\-]*')]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$'), Validators.minLength(10)]],
      city: ['', [Validators.required, Validators.minLength(2), Validators.pattern('[a-zA-Z .\\-]*')]],
      state: ['', Validators.required],
    });
  }

  async onSubmit() {
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formData = {
      ...this.eventForm.value,
      registeredAt: serverTimestamp()
    };

    try {
      // 👉 Save RSVP to Firestore
      const rsvpCollection = collection(this.firestore, 'events');
      await addDoc(rsvpCollection, formData);

      // 👉 Send confirmation email
      this.emailNotificationService
        .sendEventConfirmation(formData.email, formData.firstName)
        .subscribe({
          next: () => console.log('Confirmation email sent'),
          error: err => console.error('Error sending confirmation', err)
        });

      this.successMessage = 'Registration successful! Check your email for the event link.';
      this.eventForm.reset();
    } catch (error) {
      console.error('Error saving RSVP:', error);
      this.errorMessage = 'Something went wrong. Please try again.';
    } finally {
      this.isLoading = false;
    }
  }

  formatPhoneNumber() {
    const control = this.eventForm.get('phone');
    if (!control) return;
    const digits = (control.value || '').replace(/\\D/g, '');
    control.setValue(digits);
  }
}