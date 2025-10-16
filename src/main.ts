// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error('Error starting app:', err));

// 🟡 Defer non-critical setup until the browser is idle
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    initNonCriticalStuff();
  });
} else {
  // Fallback for older browsers
  setTimeout(() => {
    initNonCriticalStuff();
  }, 2000);
}

// Example placeholder function — replace with your actual non-critical code
function initNonCriticalStuff() {
  // e.g. warm up caches, prefetch data, initialize optional libraries, etc.
  console.log('Running non-critical tasks...');
}
