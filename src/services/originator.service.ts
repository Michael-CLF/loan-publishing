import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface RegistrationData {
  email: string;
  role: 'originator' | 'lender';
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  state: string;
  company?: string;
  contactInfo?: any;
  lenderData?: any;
}

export interface RegistrationResponse {
  success: boolean;
  message: string;
  userId?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class OriginatorService {
  private firestore = inject(Firestore);
  private functions = inject(Functions);

  /**
   * Register user via createPendingUser Cloud Function
   * NEW METHOD for OTP-first flow
   */
  registerUser(userData: RegistrationData): Observable<RegistrationResponse> {
    const createPendingUserCallable = httpsCallable<RegistrationData, RegistrationResponse>(
      this.functions, 
      'createPendingUser'
    );
    
    return from(createPendingUserCallable(userData)).pipe(
      map((result: any) => result.data),
      catchError((error) => {
        console.error('❌ Registration error:', error);
        throw error;
      })
    );
  }

  /**
   * Create originator document in Firestore (LEGACY - kept for backward compatibility)
   * This service is now optional since we create documents via Cloud Function
   */
  createOriginatorDocument(uid: string, formData: any): Observable<void> {
    const createdAt = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const originatorData = {
      id: uid,
      uid,
      email: formData.email.toLowerCase(),

      // Contact info
      firstName: formData.firstName || '',
      lastName: formData.lastName || '',
      company: formData.company || '',
      phone: formData.phone || '',
      city: formData.city || '',
      state: formData.state || '',

      // Contact info nested
      contactInfo: {
        firstName: formData.firstName || '',
        lastName: formData.lastName || '',
        contactEmail: formData.email.toLowerCase(),
        contactPhone: formData.phone || '',
        company: formData.company || '',
        city: formData.city || '',
        state: formData.state || '',
      },

      // Payment and subscription flags
      paymentPending: true,
      subscriptionStatus: 'inactive',
      role: 'originator',

      // Timestamps
      createdAt,
      updatedAt: createdAt
    };

    const ref = doc(this.firestore, `originators/${uid}`);
    return from(setDoc(ref, originatorData, { merge: true }));
  }
}