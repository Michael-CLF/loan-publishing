import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { provideClientHydration } from '@angular/platform-browser';

// Create a new config that includes the client hydration provider
const updatedConfig = {
  ...appConfig,
  providers: [
    ...appConfig.providers,
    provideClientHydration(), // Add this to fix hydration warnings
  ],
};

bootstrapApplication(AppComponent, updatedConfig).catch((err) =>
  console.error('Error bootstrapping app:', err)
);
