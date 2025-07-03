import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import emailjs from '@emailjs/browser';
import { EmailSuccessModalComponent } from '../../modals/email-success-modal/email-success-modal.component';
import { ModalService } from '../../services/modal.service';


@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, EmailSuccessModalComponent]
})
export class ContactComponent implements OnInit {
  contactForm: FormGroup;

  @ViewChild(EmailSuccessModalComponent)
  emailSuccessModal!: EmailSuccessModalComponent;

  constructor(private fb: FormBuilder, private modalService: ModalService) {
    this.contactForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      message: ['']
    });
  }

  ngOnInit(): void {
    emailjs.init('gQAhly2eeg3OkoEqe');
  }

  onPhoneInput(event: any) {
    let input = event.target.value.replace(/\D/g, '').substring(0, 10);
    const areaCode = input.substring(0, 3);
    const middle = input.substring(3, 6);
    const last = input.substring(6, 10);

    if (input.length > 6) {
      event.target.value = `(${areaCode}) ${middle}-${last}`;
    } else if (input.length > 3) {
      event.target.value = `(${areaCode}) ${middle}`;
    } else if (input.length > 0) {
      event.target.value = `(${areaCode}`;
    }

    this.contactForm.get('phone')?.setValue(event.target.value, { emitEvent: false });
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

const formData = {
  firstName: this.contactForm.value.firstName?.trim(),
  lastName: this.contactForm.value.lastName?.trim(),
  email: this.contactForm.value.email,
  phone: this.contactForm.value.phone,
  message: this.contactForm.value.message
};

    emailjs
      .send('service_s11ncn3', 'template_s8qovle', formData)
      .then(() => {
       this.modalService.openEmailSuccessModal();

        setTimeout(() => {
          this.emailSuccessModal.close();
          this.contactForm.reset();
        }, 3000); // Close modal and reset form after 3 seconds
      })
      .catch((err) => {
        console.error('❌ EmailJS error:', err);
        alert('Something went wrong. Please try again.');
      });
  }
}
