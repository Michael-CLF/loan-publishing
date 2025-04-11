import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { environment } from '../environments/environment';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    CommonModule,
    HeaderComponent,
    FooterComponent,
    NavbarComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'loanpost';

  ngOnInit() {
    // Debug which environment file is being loaded
    console.log(
      'Environment check:',
      environment.production ? 'Production' : 'Development',
      'API Key exists:',
      !!environment.firebase.apiKey,
      'API Key length:',
      environment.firebase.apiKey ? environment.firebase.apiKey.length : 0
    );
  }
}
