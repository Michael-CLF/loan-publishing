import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withFetch } from '@angular/common/http';

// Import Firebase modules
import { initializeApp, getApps } from '@angular/fire/app';
import { getFirestore } from '@angular/fire/firestore';
import { getDatabase } from '@angular/fire/database';
import { getAuth } from '@angular/fire/auth';
import { provideFirebaseApp } from '@angular/fire/app';
import { provideFirestore } from '@angular/fire/firestore';
import { provideDatabase } from '@angular/fire/database';
import { provideAuth } from '@angular/fire/auth';
import { environment } from '../environments/environment';

console.log('Firebase initialized with:', environment.firebase);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),
    provideAnimations(),
    provideHttpClient(withFetch()),
    // Use a named Firebase app instance
    provideFirebaseApp(() => {
      const apps = getApps();
      return apps.length === 0 ? initializeApp(environment.firebase) : apps[0]; // reuse existing default app
    }),
    provideFirestore(() => getFirestore()),
    provideDatabase(() => getDatabase()),
    provideAuth(() => getAuth()),
  ],
};
