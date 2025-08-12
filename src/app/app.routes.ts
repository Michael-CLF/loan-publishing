import { Routes } from '@angular/router';
import { HomeComponent } from '../home/home.component';
import { EmailLoginComponent } from '../email-login/email-login.component';
import { LoanComponent } from '../loan/loan.component';
import { LoansComponent } from '../components/loans/loans.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { authGuard } from '../services/auth.guard';
import { UserFormComponent } from '../user-form/user-form.component';
import { PricingComponent } from '../pricing/pricing.component';
import { TermsComponent } from 'src/terms/terms.component';
import { LenderContactComponent } from 'src/lender/lender-contact/lender-contact.component';
import { LenderProductComponent } from 'src/lender/lender-product/lender-product.component';
import { LenderFootprintComponent } from 'src/lender/lender-footprint/lender-footprint.component';
import { LenderRegistrationComponent } from 'src/lender/lender-registration/lender-registration.component';
import { LenderReviewComponent } from 'src/lender/lender-review/lender-review.component';
import { LoanDetailsComponent } from 'src/loan-details/loan-details.component';
import { LenderDetailsComponent } from 'src/lender/lender-details/lender-details.component';
import { LenderListComponent } from 'src/lender/lender-list/lender-list.component';
import { EditAccountComponent } from 'src/edit-account/edit-account.component';
import { EditLoanComponent } from 'src/edit-loan/edit-loan.component';
import { LenderRegSuccessModalComponent } from 'src/modals/lender-reg-success-modal/lender-reg-success-modal.component';
import { VerificationComponent } from 'src/components/verification/verification.component';
import { AdminAuthGuard } from 'src/services/admin-auth.guard';
import { AdminComponent } from 'src/components/admin/admin.component';
import { PrivacyComponent } from 'src/components/privacy/privacy.component';
import { OriginatorDetailsComponent } from 'src/components/originator-details/originator-details.component';
import { LoanMatchesComponent } from 'src/loan-matches/loan-matches.component';
import { EventRegistrationComponent } from 'src/components/event-registration/event-registration.component';
import { RegistrationProcessingComponent } from 'src/components/registration-processing/registration-processing.component';
import { ContactComponent } from 'src/components/contact/contact.component'
import { CompletePaymentComponent } from 'src/components/complete-payment/complete-payment.component';


export const routes: Routes = [
  { path: 'admin', component: AdminComponent },
  {
    path: '__/auth/action',
    component: RegistrationProcessingComponent,  // Temporarily use this component
    data: { skipAuth: true, isFirebaseAction: true }
  },
  {
    path: 'account/edit',
    component: EditAccountComponent,
    canActivate: [authGuard],
  },
  {
    path: 'event-registration',
    component: EventRegistrationComponent,
  },
  { path: '', component: HomeComponent },
  { path: 'lender-details/:id', component: LenderDetailsComponent },
  {
    path: 'lender-list',
    component: LenderListComponent,
    canActivate: [authGuard],
  },
  { path: 'lender-reg', component: LenderRegSuccessModalComponent },
  { path: 'user-form', component: UserFormComponent },
  { path: 'login', component: EmailLoginComponent },
  { path: 'lender-registration', component: LenderRegistrationComponent },
  { path: 'lender-contact', component: LenderContactComponent },
  { path: 'lender-product', component: LenderProductComponent },
  { path: 'lender-review', component: LenderReviewComponent },
  { path: 'lender-footprint', component: LenderFootprintComponent },
  { path: 'loan', component: LoanComponent, canActivate: [authGuard] },
  { path: 'loans', component: LoansComponent, canActivate: [authGuard] },
  { path: 'loan/:loanId/matches', component: LoanMatchesComponent },
  { path: 'complete-payment', component: CompletePaymentComponent },
  {
    path: 'payment/success',
    redirectTo: '/registration-processing?payment=success',
    pathMatch: 'full'
  },
  {
    path: 'payment/cancel',
    redirectTo: '/registration-processing?payment=cancel',
    pathMatch: 'full'
  },

  {
    path: 'complete-registration',
    redirectTo: '/registration-processing',
    pathMatch: 'full'
  },

  // ✅ Main registration processing route
  {
    path: 'registration-processing',
    component: RegistrationProcessingComponent
  },

  {
    path: 'loan-details',
    component: LoanDetailsComponent,
    canActivate: [authGuard],
  },
  {
    path: 'loans/:id',
    component: LoanDetailsComponent,
    canActivate: [authGuard],
  },
  {
    path: 'loans/:id/edit',
    component: EditLoanComponent,
    canActivate: [authGuard],
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'originator-details/:id',
    component: OriginatorDetailsComponent,
  },
  { path: 'pricing', component: PricingComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: 'terms', component: TermsComponent },
  {
    path: 'verify',
    component: VerificationComponent,
  },
  {
    path: 'contact',
    component: ContactComponent,
  },

  
  { path: 'test-processing', component: RegistrationProcessingComponent },
  {
  path: 'auth',
  component: EmailLoginComponent,
  data: { authCallback: true }
},
  { path: '**', redirectTo: '', pathMatch: 'full' },

];