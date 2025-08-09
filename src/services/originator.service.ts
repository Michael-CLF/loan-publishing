import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OriginatorService {
  private firestore = inject(Firestore);

  /**
   * Create originator document in Firestore
   * This service is now optional since we create documents directly in the component
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