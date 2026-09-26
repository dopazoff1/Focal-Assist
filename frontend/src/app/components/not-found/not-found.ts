import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './not-found.html',
  styleUrls: ['./not-found.css']
})
export class NotFoundComponent {
  constructor(private router: Router, private auth: AuthService) {}

  get requestedPath(): string {
    const full = (this.router.url || '').toString();
    const clean = full.split('?')[0].split('#')[0];
    return clean || '/';
  }

  get homeLink(): string {
    return this.auth.isLoggedIn() ? '/v3/home' : '/marketing';
  }
}

