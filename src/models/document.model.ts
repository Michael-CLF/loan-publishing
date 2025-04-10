// src/app/models/document.model.ts
import { Timestamp } from '@angular/fire/firestore';

// Interface with Firestore Timestamp
export interface FirestoreDocument {
  id?: string;
  title: string;
  content: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Interface after conversion to JS Date
export interface Document {
  id?: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
