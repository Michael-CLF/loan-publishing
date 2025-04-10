import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  isLoggedIn = false; // This would typically come from an auth service

  login() {
    // Implement your login logic here
    this.isLoggedIn = true;
  }

  logout() {
    // Implement your logout logic here
    this.isLoggedIn = false;
  }
}
