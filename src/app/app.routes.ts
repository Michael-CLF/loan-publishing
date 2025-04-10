import { Routes } from '@angular/router';
import { HomeComponent } from '../home/home.component';
import { UserFormComponent } from '../user-form/user-form.component';
import { EmailLoginComponent } from '../email-login/email-login.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'user-form', component: UserFormComponent },
  { path: 'login', component: EmailLoginComponent },
];
