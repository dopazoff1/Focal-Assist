import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { StaffCreateRequest, StaffService, StaffUser } from '../../services/staff';
import { PresenceService, PresenceStatusHistory } from '../../services/presence';
import { AccessControlService } from '../../services/access-control';

@Component({
  selector: 'app-staff-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff-management.html',
  styleUrls: ['./staff-management.css']
})
export class StaffManagement implements OnInit {
  readonly availableStatuses = ['ONLINE', 'AWAY', 'WRAPUP', 'BREAK', 'OFFLINE'];
  availableRoles: string[] = ['AGENT', 'ADMIN'];
  users: StaffUser[] = [];
  timeline: PresenceStatusHistory[] = [];
  timelineUserId: number | null = null;
  loading = false;
  saving = false;
  message = '';
  error = '';

  newUser: StaffCreateRequest = {
    firstName: '',
    lastName: '',
    dob: '',
    email: '',
    password: '',
    role: 'AGENT'
  };

  roleDraft: Record<number, string> = {};
  statusDraft: Record<number, string> = {};
  deactivateReason: Record<number, string> = {};
  passwordDraft: Record<number, string> = {};

  constructor(
    private staffService: StaffService,
    private presenceService: PresenceService,
    private accessControl: AccessControlService
  ) {}

  ngOnInit(): void {
    this.accessControl.ensureLoaded().subscribe({
      next: () => {
        this.refreshAvailableRoles();
        this.loadUsers();
      },
      error: () => {
        this.refreshAvailableRoles();
        this.loadUsers();
      }
    });
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.message = '';
    this.staffService.listUsers()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (users) => {
          this.users = users.sort((a, b) => a.id - b.id);
          this.roleDraft = {};
          this.statusDraft = {};
          users.forEach(u => {
            this.roleDraft[u.id] = u.role || 'AGENT';
            this.statusDraft[u.id] = u.status || 'OFFLINE';
          });
          this.loadTimeline();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Failed to load staff users.';
        }
      });
  }

  loadTimeline(): void {
    this.presenceService.getTimeline(this.timelineUserId || undefined).subscribe({
      next: rows => {
        this.timeline = rows || [];
      },
      error: () => {
        this.timeline = [];
      }
    });
  }

  onTimelineFilterChange(): void {
    this.loadTimeline();
  }

  createUser(): void {
    if (!this.newUser.firstName || !this.newUser.lastName || !this.newUser.email || !this.newUser.password) {
      this.error = 'Fill first name, last name, email and password.';
      return;
    }
    this.saving = true;
    this.error = '';
    this.message = '';
    this.staffService.createUser(this.newUser)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: () => {
          this.message = 'User created.';
          this.newUser = {
            firstName: '',
            lastName: '',
            dob: '',
            email: '',
            password: '',
            role: this.availableRoles.includes('AGENT') ? 'AGENT' : this.availableRoles[0] || 'AGENT'
          };
          this.refreshAvailableRoles();
          this.loadUsers();
        },
        error: (err) => this.error = err?.error?.message || 'Failed to create user.'
      });
  }

  updateRole(user: StaffUser): void {
    const role = this.roleDraft[user.id] || user.role;
    this.saving = true;
    this.error = '';
    this.message = '';
    this.staffService.updateRole(user.id, role)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: () => {
          this.message = 'Role updated.';
          this.loadUsers();
        },
        error: (err) => this.error = err?.error?.message || 'Failed to update role.'
      });
  }

  updateStatus(user: StaffUser): void {
    const status = this.statusDraft[user.id] || user.status || 'OFFLINE';
    this.saving = true;
    this.error = '';
    this.message = '';
    this.staffService.updateStatus(user.id, status)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: () => {
          this.message = 'Status updated.';
          this.loadUsers();
        },
        error: (err) => this.error = err?.error?.message || 'Failed to update status.'
      });
  }

  toggleActive(user: StaffUser): void {
    this.saving = true;
    this.error = '';
    this.message = '';
    const action$ = user.active
      ? this.staffService.deactivate(user.id, this.deactivateReason[user.id] || 'Deactivated by staff manager')
      : this.staffService.activate(user.id);
    action$
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: () => {
          this.message = user.active ? 'User deactivated.' : 'User activated.';
          this.loadUsers();
        },
        error: (err) => this.error = err?.error?.message || 'Failed to update user status.'
      });
  }

  resetPassword(user: StaffUser): void {
    const password = this.passwordDraft[user.id];
    if (!password || password.length < 4) {
      this.error = 'Password must be at least 4 characters.';
      return;
    }
    this.saving = true;
    this.error = '';
    this.message = '';
    this.staffService.resetPassword(user.id, password)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: () => {
          this.message = 'Password updated.';
          this.passwordDraft[user.id] = '';
        },
        error: (err) => this.error = err?.error?.message || 'Failed to reset password.'
      });
  }

  private refreshAvailableRoles(): void {
    const roles = this.accessControl.listAssignableRoleNames();
    this.availableRoles = roles.length ? roles : ['AGENT', 'ADMIN'];
    if (!this.availableRoles.includes(this.newUser.role)) {
      this.newUser.role = this.availableRoles.includes('AGENT') ? 'AGENT' : this.availableRoles[0];
    }
  }
}
