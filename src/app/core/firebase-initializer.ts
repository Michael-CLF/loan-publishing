import { inject, InjectionToken } from '@angular/core';
import { initializeApp, FirebaseApp } from '@angular/fire/app';
import { environment } from '../../environments/environment';

export const FIREBASE_APP = new InjectionToken<Promise<FirebaseApp>>('firebase.app');

let firebaseAppPromise: Promise<FirebaseApp> | null = null;

export function getFirebaseApp(): Promise<FirebaseApp> {
  if (!firebaseAppPromise) {
    firebaseAppPromise = import('@angular/fire/app').then(module => {
      return module.initializeApp(environment.firebase);
    });
  }
  return firebaseAppPromise;
}