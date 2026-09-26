import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { Login } from './login';
import { AuthService, LoggedInUser } from '../../services/auth';
import { ThemeService } from '../../services/theme';

describe('Login feedback and navigation', () => {
  let response: Subject<LoggedInUser>;
  let login: Login;
  let authenticate: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    response = new Subject<LoggedInUser>();
    authenticate = vi.fn(() => response);
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({});
    login = TestBed.runInInjectionContext(() => new Login(
      { login: authenticate } as unknown as AuthService,
      { navigate } as unknown as Router,
      { initializeTheme: vi.fn() } as unknown as ThemeService
    ));
    login.email = 'agent@example.com';
    login.password = 'test-password';
  });

  it('navigates immediately when authentication succeeds', () => {
    login.login();
    response.next({ id: 1, firstName: 'Agent' } as LoggedInUser);
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('keeps one request pending and prevents repeated submissions', () => {
    login.login();
    login.login();
    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(login.isLoggingIn).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('restores the form on invalid credentials', () => {
    login.login();
    response.error(new HttpErrorResponse({ status: 401 }));
    expect(login.isLoggingIn).toBe(false);
    expect(login.loginError).toBe('Incorrect email or password.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cancels the pending subscription when its owner is destroyed', () => {
    login.login();
    TestBed.resetTestingModule();
    response.next({ id: 1 } as LoggedInUser);
    expect(navigate).not.toHaveBeenCalled();
  });
});
