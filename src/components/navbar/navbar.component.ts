// src/app/components/navbar/navbar.component.ts
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {
  constructor(private router: Router) {}

  // Optional: for active-link styling in the template
  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }
}
