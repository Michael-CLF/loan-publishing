import { Routes } from '@angular/router';
import { authGuard } from '../app/guards/auth.guard';
import { adminAuthGuard } from './guards/admin-auth.guard';

export const routes: Routes = [
  // Critical path - load immediately
  {
    path: '',
    loadComponent: () => import('../home/home.component').then(m => m.HomeComponent),
    title: 'Home - LoanPost'
  },

  // Authentication routes - lazy load
  {
    path: 'login',
    loadComponent: () => import('../email-login/email-login.component').then(m => m.EmailLoginComponent),
    title: 'Login - LoanPost'
  },

  {
    path: '__/auth/action',
    loadComponent: () => import('src/components/registration-processing/registration-processing.component')
      .then(m => m.RegistrationProcessingComponent),
    data: { skipAuth: true, isFirebaseAction: true },
  },

  {
    path: 'admin',
    children: [
      {
        path: 'dashboard',
         canActivate: [adminAuthGuard],
        loadComponent: () =>
          import('src/components/admin/admin-dashboard/admin-dashboard.component')
            .then(m => m.AdminDashboardComponent),
        title: 'Admin Dashboard - LoanPost'
      },
      {
        path: 'billing',
        canActivate: [adminAuthGuard],
        loadComponent: () =>
          import('src/components/admin/admin-billing/admin-billing.component')
            .then(m => m.AdminBillingComponent),
        title: 'Admin Billing - LoanPost'
      },
      {
        path: 'users',
        canActivate: [adminAuthGuard],
        loadComponent: () =>
          import('src/components/admin/admin-users/admin-users.component')
            .then(m => m.AdminUsersComponent),
        title: 'Admin Users - LoanPost'
      },

      {
        path: 'lenders',
        canActivate: [adminAuthGuard],
        loadComponent: () =>
          import('src/components/admin/admin-lenders/admin-lenders.component')
            .then(m => m.AdminLendersComponent),
        title: 'Admin Lenders - LoanPost'
      },
      {
        path: 'loans',
        canActivate: [adminAuthGuard],
        loadComponent: () =>
          import('src/components/admin/admin-loans/admin-loans.component')
            .then(m => m.AdminLoansComponent),
        title: 'Admin Loans - LoanPost'
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' }
    ]
  },
  {
  path: 'dashboard',
  loadComponent: () => import('src/dashboard/dashboard.component')
    .then(m => m.DashboardComponent),
  canActivate: [authGuard], // <-- Protects it from non-logged-in users
  title: 'Dashboard - LoanPost'
},

  {
    path: 'loan',
    loadComponent: () => import('../loan/loan.component').then(m => m.LoanComponent),
    canActivate: [authGuard],
    title: 'Create Loan - LoanPost'
  },
  {
    path: 'loans',
    loadComponent: () => import('../components/loans/loans.component').then(m => m.LoansComponent),
    canActivate: [authGuard],
    title: 'My Loans - LoanPost'
  },
  {
    path: 'loans/:id',
    loadComponent: () => import('src/loan-details/loan-details.component').then(m => m.LoanDetailsComponent),
    canActivate: [authGuard],
    title: 'Loan Details - LoanPost'
  },
  {
    path: 'loans/:id/edit',
    loadComponent: () => import('src/edit-loan/edit-loan.component').then(m => m.EditLoanComponent),
    canActivate: [authGuard],
    title: 'Edit Loan - LoanPost'
  },
  {
    path: 'loan/:loanId/matches',
    loadComponent: () => import('src/loan-matches/loan-matches.component').then(m => m.LoanMatchesComponent),
    title: 'Loan Matches - LoanPost'
  },

  // Lender routes - lazy load
  {
    path: 'lender-registration',
    loadComponent: () => import('src/lender/lender-registration/lender-registration.component')
      .then(m => m.LenderRegistrationComponent),
    title: 'Lender Registration - LoanPost'
  },
  {
    path: 'lender-contact',
    loadComponent: () => import('src/lender/lender-contact/lender-contact.component')
      .then(m => m.LenderContactComponent),
    title: 'Lender Contact - LoanPost'
  },
  {
    path: 'lender-product',
    loadComponent: () => import('src/lender/lender-product/lender-product.component')
      .then(m => m.LenderProductComponent),
    title: 'Lender Product - LoanPost'
  },
  {
    path: 'lender-footprint',
    loadComponent: () => import('src/lender/lender-footprint/lender-footprint.component')
      .then(m => m.LenderFootprintComponent),
    title: 'Lender Footprint - LoanPost'
  },
  {
    path: 'lender-review',
    loadComponent: () => import('src/lender/lender-review/lender-review.component')
      .then(m => m.LenderReviewComponent),
    title: 'Lender Review - LoanPost'
  },
  {
    path: 'lender-details/:id',
    loadComponent: () => import('src/lender/lender-details/lender-details.component')
      .then(m => m.LenderDetailsComponent),
    title: 'Lender Details - LoanPost'
  },
  {
    path: 'lender-list',
    loadComponent: () => import('src/lender/lender-list/lender-list.component')
      .then(m => m.LenderListComponent),
    canActivate: [authGuard],
    title: 'Lender List - LoanPost'
  },
  {
    path: 'lender-reg',
    loadComponent: () => import('src/modals/lender-reg-success-modal/lender-reg-success-modal.component')
      .then(m => m.LenderRegSuccessModalComponent),
    title: 'Lender Registration Success - LoanPost'
  },

  // User/Account routes - lazy load
  {
    path: 'user-form',
    loadComponent: () => import('../user-form/user-form.component').then(m => m.UserFormComponent),
    title: 'User Form - LoanPost'
  },
  {
    path: 'account/edit',
    loadComponent: () => import('src/edit-account/edit-account.component').then(m => m.EditAccountComponent),
    canActivate: [authGuard],
    title: 'Edit Account - LoanPost'
  },
  {
    path: 'originator-details/:id',
    loadComponent: () => import('src/components/originator-details/originator-details.component')
      .then(m => m.OriginatorDetailsComponent),
    title: 'Originator Details - LoanPost'
  },

  // Static pages - lazy load with lower priority
  {
    path: 'pricing',
    loadComponent: () => import('../pricing/pricing.component').then(m => m.PricingComponent),
    title: 'Pricing - LoanPost'
  },
  {
    path: 'terms',
    loadComponent: () => import('src/terms/terms.component').then(m => m.TermsComponent),
    title: 'Terms of Service - LoanPost'
  },
  {
    path: 'privacy',
    loadComponent: () => import('src/components/privacy/privacy.component').then(m => m.PrivacyComponent),
    title: 'Privacy Policy - LoanPost'
  },
  {
    path: 'contact',
    loadComponent: () => import('src/components/contact/contact.component').then(m => m.ContactComponent),
    title: 'Contact Us - LoanPost'
  },
  {
    path: 'calculators',
    loadComponent: () => import('src/components/calculators/calculators.component').then(m => m.CalculatorsComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'balloon-calculator',
    loadComponent: () => import('src/components/calculators/balloon-calculator/balloon-calculator.component').then(m => m.BalloonCalculatorComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'breakeven-calculator',
    loadComponent: () => import('src/components/calculators/breakeven-calculator/breakeven-calculator.component').then(m => m.BreaKevenCalculatorComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'cap-rate-calculator',
    loadComponent: () => import('src/components/calculators/cap-rate-calculator/cap-rate-calculator.component').then(m => m.CapRateCalculatorComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'dscr-calculator',
    loadComponent: () => import('src/components/calculators/dscr-calculator/dscr-calculator.component').then(m => m.DscrCalculatorComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'fix-flip-calculator',
    loadComponent: () => import('src/components/calculators/fix-flip-calculator/fix-flip-calculator.component').then(m => m.FixFlipCalculatorComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'interest-only-calculator',
    loadComponent: () => import('src/components/calculators/interest-only-calculator/interest-only-calculator.component').then(m => m.InterestOnlyCalculatorComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'irr-calculator',
    loadComponent: () => import('src/components/calculators/irr-calculator/irr-calculator.component').then(m => m.IrrCalculatorComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'ltv-calculator',
    loadComponent: () => import('src/components/calculators/ltv-calculator/ltv-calculator.component').then(m => m.LtvCalculatorComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'loan-payment',
    loadComponent: () => import('src/components/calculators/loan-payment/loan-payment.component').then(m => m.LoanPaymentComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'mortgage-calculator',
    loadComponent: () => import('src/components/calculators/mortgage-calculator/mortgage-calculator.component').then(m => m.MortgageCalculatorComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'mortgage-results',
    loadComponent: () => import('src/components/calculators/mortgage-results/mortgage-results.component').then(m => m.MortgageResultsComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'mortgage-terms',
    loadComponent: () => import('src/components/calculators/mortgage-terms/mortgage-terms.component').then(m => m.MortgageTermsComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'noi-calculator',
    loadComponent: () => import('src/components/calculators/noi-calculator/noi-calculator.component').then(m => m.NoiCalculatorComponent),
    title: 'Calculators - LoanPost'
  },
  // --- New calculators (standalone components) ---
  {
    path: 'amortization-schedule',
    loadComponent: () => import('src/components/calculators/amortization-schedule/amortization-schedule.component')
      .then(m => m.AmortizationScheduleComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'bridge-loan',
    loadComponent: () => import('src/components/calculators/bridge-loan/bridge-loan.component')
      .then(m => m.BridgeLoanComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'cash-on-cash',
    loadComponent: () => import('src/components/calculators/cash-on-cash/cash-on-cash.component')
      .then(m => m.CashOnCashComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'construction-loan-draw',
    loadComponent: () => import('src/components/calculators/construction-loan-draw/construction-loan-draw.component')
      .then(m => m.ConstructionLoanDrawComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'debt-yield',
    loadComponent: () => import('src/components/calculators/debt-yield/debt-yield.component')
      .then(m => m.DebtYieldComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'prepayment-penalty',
    loadComponent: () => import('src/components/calculators/prepayment-penalty/prepayment-penalty.component')
      .then(m => m.PrepaymentPenaltyComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'refinance-savings',
    loadComponent: () => import('src/components/calculators/refinance-savings/refinance-savings.component')
      .then(m => m.RefinanceSavingsComponent),
    title: 'Calculators - LoanPost'
  },
  {
    path: 'rent-vs-buy',
    loadComponent: () => import('src/components/calculators/rent-vs-buy/rent-vs-buy.component')
      .then(m => m.RentVsBuyComponent),
    title: 'Calculators - LoanPost'
  },



  // Payment routes - lazy load
  {
    path: 'complete-payment',
    loadComponent: () => import('src/components/complete-payment/complete-payment.component')
      .then(m => m.CompletePaymentComponent),
    title: 'Complete Payment - LoanPost'
  },
  {
    path: 'registration-processing',
    loadComponent: () => import('src/components/registration-processing/registration-processing.component')
      .then(m => m.RegistrationProcessingComponent),
    title: 'Processing Registration - LoanPost'
  },

  // Utility routes - lazy load
  {
    path: 'firebase-video',
    loadComponent: () => import('src/components/firebase-video/firebase-video.component')
      .then(m => m.FirebaseVideoComponent),
    title: 'Firebase Video - LoanPost'
  },
  {
    path: 'ebooks',
    loadComponent: () => import('src/components/ebooks/ebooks.component')
      .then(m => m.EbooksComponent),
    title: 'Ebooks - LoanPost'
  },

  // Redirects
  {
    path: 'payment/success',
    redirectTo: '/registration-processing?payment=success',
    pathMatch: 'full',
  },
  {
    path: 'payment/cancel',
    redirectTo: '/registration-processing?payment=cancel',
    pathMatch: 'full',
  },
  {
    path: 'complete-registration',
    redirectTo: '/registration-processing',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadComponent: () => import('../email-login/email-login.component').then(m => m.EmailLoginComponent),
    data: { authCallback: true },
  },

  // Test routes
  {
    path: 'test-processing',
    loadComponent: () => import('src/components/registration-processing/registration-processing.component')
      .then(m => m.RegistrationProcessingComponent),
  },

  // Wildcard - must be last
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full'
  },
];