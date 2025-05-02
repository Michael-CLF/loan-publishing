// email.service.ts
import { Injectable, inject, NgZone } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  private functions = inject(Functions);
  private zone = inject(NgZone);

  // Method to send an email with a verification code
  sendVerificationEmail(
    email: string,
    code: string,
    firstName: string
  ): Observable<boolean> {
    return this.zone.runOutsideAngular(() => {
      // This assumes you have a Firebase Cloud Function set up to send emails
      const sendEmail = httpsCallable<any, any>(
        this.functions,
        'sendVerificationEmail'
      );

      return from(
        sendEmail({
          email,
          code,
          firstName,
          subject: 'Your Registration Verification Code',
          template: 'verification',
        })
      ).pipe(
        // Run the result handling back in Angular zone
        this.zone.run(() => {
          return map(() => true);
        }),
        catchError((error) => {
          console.error('Error sending verification email:', error);
          // Log more details for debugging
          if (error.code) {
            console.error('Error code:', error.code);
          }
          if (error.message) {
            console.error('Error message:', error.message);
          }
          if (error.details) {
            console.error('Error details:', error.details);
          }
          return of(false);
        })
      );
    });
  }
}
