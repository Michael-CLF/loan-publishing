import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';

import { routes } from './app.routes';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';

const firebaseConfig = {
  apiKey: 'AIzaSyCHFGcEhZzsyUsFB3fT_K0xgSbXVA-jOfs',
  authDomain: 'loan-publishing.firebaseapp.com',
  projectId: 'loan-publishing',
  storageBucket: 'loan-publishing.firebasestorage.app',
  messagingSenderId: '833676109932',
  appId: '1:833676109932:web:daac2db45f8335c4b75049',
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()), // Add this line to provide the Auth service
  ],
};
