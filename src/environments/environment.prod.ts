export const environment = {
  production: true,
  // ✅ Angular 18 Best Practice: Use local emulator for development
 apiUrl: 'https://us-central1-loanpub.cloudfunctions.net',
  firebase: {
    // ✅ FIXED: Don't use process.env in browser environment
    apiKey: 'AIzaSyBFDQ8pwGr40Mn92bujH1gHNoZvA6m5pas',
    authDomain: 'loanpub.firebaseapp.com',
    projectId: 'loanpub',
    storageBucket: 'loanpub.appspot.com',
    messagingSenderId: '837394993537',
    appId: '1:837394993537:web:3f2e4f089386400d74d880',
    measurementId: 'G-MPD1MG3MVJ',
  },
   redirectUrl: 'https://dailyloanpost.com/',
};
