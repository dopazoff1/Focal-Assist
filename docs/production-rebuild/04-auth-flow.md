# Focal - Authentication & Authorization Flow

> Complete authentication, authorization, and security implementation details.

---

## 5. AUTHENTICATION & AUTHORIZATION FLOW

### 5.1 Backend Security Configuration

**JWT Configuration:**
- Secret: `security.jwt.secret` (env var, default provided)
- Expiration: 43200 seconds (12 hours)
- Algorithm: HS256
- Token contains: `sub` (email), `iat`, `exp`

**Spring Security:**
- Stateless session management
- JWT filter extracts token from `Authorization: Bearer <token>`
- Custom `UserDetailsService` loads user by email
- Password encoding: BCrypt

### 5.2 Frontend Auth Flow

1. **Login Page** (`/login`) → POST `/auth/login`
2. **Success:** Store token + user in `localStorage`, set `AuthService.loggedInUser`
3. **AuthGuard** checks `AuthService.isLoggedIn()` on protected routes
4. **AuthInterceptor** adds `Authorization: Bearer <token>` to all HTTP requests
5. **RoleGuard** checks `AccessControlService.hasFeatureAccess(role, feature)`
6. **Logout:** Clear localStorage, navigate to `/login`

### 5.3 Token Storage (localStorage keys)
```
token, id, firstName, lastName, email, dob, role, status, timeZone, hasProfilePhoto, profilePhotoUpdatedAt, uiLanguage, desktopNotificationsEnabled, soundNotificationsEnabled
```

### 5.4 Auth Guard Implementation

```typescript
// auth.guard.ts
export const AuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  
  if (auth.isLoggedIn()) {
    return true;
  }
  
  // Store attempted URL for redirect after login
  localStorage.setItem('redirectUrl', state.url);
  return router.parseUrl('/login');
};
```

### 5.5 Role Guard Implementation

```typescript
// role.guard.ts
export const RoleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const accessControl = inject(AccessControlService);
  const router = inject(Router);
  
  const role = auth.getNormalizedRole();
  const feature = route.data?.['feature'];
  const allowedRoles = route.data?.['roles'] as string[] | undefined;
  
  // Check role-level access
  if (allowedRoles && !allowedRoles.includes(role)) {
    return router.parseUrl('/v3/home');
  }
  
  // Check feature-level access
  if (feature && !accessControl.hasFeatureAccess(role, feature)) {
    return router.parseUrl('/v3/home');
  }
  
  return true;
};
```

### 5.6 Auth Interceptor

```typescript
// auth-interceptor.ts
export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  
  if (token) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(authReq);
  }
  
  return next(req);
};
```

### 5.7 Password Security

- **Algorithm:** BCrypt with strength 10
- **Validation:** Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character
- **Reset Flow:** Admin generates temp password → emailed to user → user forced to change on first login

### 5.8 Session Management

- **Token Expiry:** 12 hours (configurable via `SECURITY_JWT_EXPIRATION_SECONDS`)
- **Refresh Strategy:** No automatic refresh - user re-logs in after expiry
- **Concurrent Sessions:** Multiple sessions allowed (no session invalidation on new login)
- **Remember Me:** Extends token expiry to 30 days (not yet implemented)

### 5.9 CORS Configuration

---

## Production Identity, Session, and Authorization Adaptation

The source JWT/localStorage flow above is superseded for production. Use Auth0 or Amazon Cognito with Authorization Code + PKCE. **[ARCHITECTURAL DECISION REQUIRED]** Select one provider before implementation; the remainder assumes an OIDC-compliant provider and avoids provider lock-in outside `server/auth`.

1. User opens Next.js and is redirected to the identity provider when no server session exists.
2. The provider enforces MFA/passkeys where policy requires and returns a code to the registered callback using PKCE and state/nonce validation.
3. Next.js validates the callback, resolves the application user and tenant membership, and creates an encrypted, signed, short-lived `httpOnly` session cookie. Refresh credentials remain server-side only.
4. Next.js Route Handlers, Server Actions, and server-rendered pages resolve the server-side session, validate tenant membership, and load only the minimum required permissions.
5. The shared TypeScript policy layer loads current roles, feature permissions, resource relationships, and account status. It never trusts client roles, tenant IDs, or hidden fields.

Use rotating refresh tokens, a short access lifetime, provider logout plus server-session invalidation, and immediate membership/session revocation after deactivation, password reset, or suspected compromise. Login, recovery, callback, and privilege escalation routes have aggressive IP/account rate limits and audit events. Prefer provider-hosted recovery flows over application password handling.

Protect cookie-authenticated mutations with Origin/Referer validation plus CSRF tokens or same-origin Server Actions. CORS is deny-by-default: only exact production/staging origins, methods, and headers; no wildcard credentials. Set HSTS, CSP, `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` at Cloudflare/Next.js. Authorization failures return a non-enumerating `404` when revealing resource existence would be sensitive.

```java
// SecurityConfig.java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("http://localhost:4200", "https://your-domain.com"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);
    config.setMaxAge(3600L);
    
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```
