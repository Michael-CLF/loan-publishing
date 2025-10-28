// src/app/shared/otp-verification/otp-verification.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { OTPService } from '../services/otp.service';

@Component({
  selector: 'app-otp-verification',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './otp-verification.component.html',
  styleUrls: ['./otp-verification.component.css'],
})
export class OtpVerificationComponent implements OnInit {
  public otpService = inject(OTPService);

  @Input() email!: string;
  @Input() context: 'login' | 'registration' = 'registration';
  @Output() verified = new EventEmitter<void>();

  // signals
  errorMessage = signal<string>('');
  codeDigits = signal<string[]>(['', '', '', '', '', '']);
  timeRemaining = computed(() => this.otpService.formatTimeRemaining());
  isLoading = computed(() => this.otpService.isLoading());

  ngOnInit(): void {
    if (this.email) {
      console.log('📨 Sending OTP to', this.email);
      this.otpService.sendOTP(this.email).subscribe({
        next: () => console.log('✅ OTP sent for', this.context),
        error: (err) => {
          console.error('❌ OTP send error:', err);
          this.errorMessage.set('Failed to send code. Please try again.');
        },
      });
    }
  }

 onCodeDigitInput(index: number, event: any): void {
  const raw = event.target.value ?? '';
  const val = raw.replace(/\D/g, '').slice(0, 1); // numeric, single char

  // write this digit only
  const digits = this.codeDigits().slice();
  digits[index] = val;
  this.codeDigits.set(digits);

  // keep the rendered input consistent with model
  event.target.value = val;

  // auto-advance if a digit was entered
  if (val && index < 5) {
    const nextEl = document.getElementById(`otp-${index + 1}`) as HTMLInputElement | null;
    nextEl?.focus();
    nextEl?.select();
  }

  // if last box filled, try verify automatically
  if (index === 5 && val) {
    this.tryVerify();
  }
}


  resend(): void {
    this.errorMessage.set('');
    this.otpService.sendOTP(this.email).subscribe({
      next: () => {
        this.codeDigits.set(['', '', '', '', '', '']);
        document.getElementById('otp-0')?.focus();
      },
      error: (err) => {
        console.error('❌ Resend error:', err);
        this.errorMessage.set('Could not resend. Try again.');
      },
    });
  }
  onCodeDigitKeydown(index: number, e: KeyboardEvent): void {
  if (e.key === 'Backspace') {
    e.preventDefault(); // we fully control the behavior

    const digits = this.codeDigits().slice();

    if (digits[index]) {
      // clear current digit
      digits[index] = '';
      this.codeDigits.set(digits);

      const el = document.getElementById(`otp-${index}`) as HTMLInputElement | null;
      if (el) {
        el.value = '';
        el.focus();
        el.select();
      }
    } else if (index > 0) {
      // move back a box
      const prevIndex = index - 1;
      digits[prevIndex] = '';
      this.codeDigits.set(digits);

      const prevEl = document.getElementById(`otp-${prevIndex}`) as HTMLInputElement | null;
      if (prevEl) {
        prevEl.value = '';
        prevEl.focus();
        prevEl.select();
      }
    }
  }
}
onCodePaste(e: ClipboardEvent): void {
  e.preventDefault();
  const pastedText = e.clipboardData?.getData('text') || '';
  const cleaned = pastedText.replace(/\D/g, '').slice(0, 6);
  if (!cleaned) return;

  const newDigits = cleaned.split('');
  // pad to length 6 in case shorter than 6
  while (newDigits.length < 6) {
    newDigits.push('');
  }

  this.codeDigits.set(newDigits);

  // reflect the digits into DOM boxes
  for (let i = 0; i < 6; i++) {
    const inputEl = document.getElementById(`otp-${i}`) as HTMLInputElement | null;
    if (inputEl) {
      inputEl.value = newDigits[i] || '';
    }
  }

  // if we pasted 6 digits, verify immediately
  if (cleaned.length === 6) {
    this.tryVerify();
  } else {
    // otherwise focus next empty box
    const firstEmptyIndex = newDigits.findIndex(d => d === '');
    const focusIndex = firstEmptyIndex === -1 ? 5 : firstEmptyIndex;
    const focusEl = document.getElementById(`otp-${focusIndex}`) as HTMLInputElement | null;
    focusEl?.focus();
    focusEl?.select();
  }
}



  tryVerify(): void {
    const code = this.codeDigits().join('');
    if (code.length !== 6) {
      this.errorMessage.set('Enter all 6 digits');
      return;
    }

    this.errorMessage.set('');
    console.log('🔐 Verifying OTP for', this.email);
    this.otpService.verifyOTP(this.email, code).subscribe({
      next: () => {
        console.log('✅ OTP verified successfully');
        this.verified.emit(); // emit event to parent
      },
      error: (err) => {
        console.error('❌ Verify error:', err);
        this.errorMessage.set(err.message || 'Invalid code');
        this.codeDigits.set(['', '', '', '', '', '']);
      },
    });
  }
}
