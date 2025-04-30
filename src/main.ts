import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { provideClientHydration } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from './environments/environment';

// Create a new config that includes the client hydration provider
const updatedConfig = {
  ...appConfig,
  providers: [
    ...appConfig.providers,
    provideClientHydration(), // Add this to fix hydration warnings
  ],
};

bootstrapApplication(AppComponent, updatedConfig)
  .catch((err) => {
    providers: [
      provideFirebaseApp(() => initializeApp(environment.firebase)),
      provideAuth(() => getAuth()),
      provideFirestore(() => getFirestore()),
    ];
  })
  .catch((err) => console.error(err));
