export const environment = {
  production: false,
  clarityProjectId: 'tf9hb3r6wp',
  apiUrl: 'https://us-central1-loanpub.cloudfunctions.net',

 frontendUrl: 'https://dailyloanpost.com', 
  stripeCheckoutUrl: 'https://us-central1-loanpub.cloudfunctions.net/createStripeCheckout',
  functionsBaseUrl: 'https://us-central1-loanpub.cloudfunctions.net',

  appCheckSiteKey: '6LfWCEwrAAAAABlc_Prf6WpaYX00VC0512hkSWyw',
  adminApiBase: 'https://us-central1-loanpub.cloudfunctions.net',
  adminBearer: 'HlOx69lTCrbRGu3UyvHFwICjLlbaokbE3GKGP-laZ9q3QA2ciuqA_vROP-MR64mR7BfFDaITXk3Tc36D5ouupA',   
  adminExchangeCodeUrl: 'https://us-central1-loanpub.cloudfunctions.net/adminHttp/exchange-code',
  adminCheckAuthUrl: 'https://us-central1-loanpub.cloudfunctions.net/adminHttp/check-auth',
  adminLoginUrl: 'https://us-central1-loanpub.cloudfunctions.net/adminHttp/login',
  adminLogoutUrl: 'https://us-central1-loanpub.cloudfunctions.net/adminHttp/logout',

  firebase: {
    apiKey: "AIzaSyBFDQ8pwGr40Mn92bujH1gHNoZvA6m5pas",
    authDomain: 'loanpub.firebaseapp.com',
    projectId: 'loanpub',
    storageBucket: 'loanpub.firebasestorage.app',
    messagingSenderId: '837394099537',
    appId: '1:837394993537:web:3f2e4f08938640d074d880', 
    measurementId: 'G-MPD1MGM3WJ',
  },

  adminConfig: {
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    maxLoginAttempts: 5,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    enableLogging: true
  },

  redirectUrl: 'https://dailyloanpost.com/',
};
