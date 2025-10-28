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

  // handle input typing
  onCodeDigitInput(index: number, event: any): void {
    const val = event.target.value.slice(0, 1);
    const digits = [...this.codeDigits()];
    digits[index] = val;
    this.codeDigits.set(digits);
    if (val && index < 5)
      document.getElementById(`otp-${index + 1}`)?.focus();
    if (index === 5 && val) this.tryVerify();
  }

  onCodeDigitKeydown(index: number, e: KeyboardEvent): void {
    if (e.key === 'Backspace' && !this.codeDigits()[index] && index > 0)
      document.getElementById(`otp-${index - 1}`)?.focus();
  }

  onCodePaste(e: ClipboardEvent): void {
    e.preventDefault();
    const txt = e.clipboardData?.getData('text') ?? '';
    const d = txt.replace(/\D/g, '').slice(0, 6).split('');
    if (d.length === 6) {
      this.codeDigits.set(d);
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
