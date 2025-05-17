import { Injectable, inject } from '@angular/core';
import { Firestore, serverTimestamp } from '@angular/fire/firestore';
import { FirestoreService } from './firestore.service';
import { UserData } from '../models/user-data.model';
import { Originator } from '../models/originator.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OriginatorService {
  private firestoreService = inject(FirestoreService);

  // Map user data to Originator document
 private mapUserToOriginator(user: UserData): Originator {
  const timestamp = serverTimestamp();

  return {
    id: user.id,
    uid: user.id,
    role: 'originator',
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    company: user.company || '',
    phone: user.phone || '',
    city: user.city || '',
    state: user.state || '',
    createdAt: timestamp,
    updatedAt: timestamp,
    contactInfo: {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      contactEmail: user.email || '',
      contactPhone: user.phone || '',
      company: user.company || '',
      city: user.city || '',
      state: user.state || '',
    }
  };
}
  // Save Originator
  saveOriginator(user: UserData): Observable<void> {
    const originator = this.mapUserToOriginator(user);
    return this.firestoreService.setDocument(`originators/${user.id}`, originator);
  }
}
