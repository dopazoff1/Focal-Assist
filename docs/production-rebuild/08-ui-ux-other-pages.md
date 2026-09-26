# Focal - Detailed Page UI/UX: Remaining Pages & Global Design System

> Pixel-perfect visual descriptions for login, error pages, design system tokens, user flows, and state management.

---

### 15.26 Login Page (`/login`)

**File:** `frontend/src/app/components/login/login.html` + `.ts`

#### Visual Layout Structure
- **Centered card** (420px max-width) on full-screen gradient background
- **Background:** Animated mesh gradients (brand colors), subtle noise texture
- **Card:** White, 48px padding, rounded 24px, heavy shadow (0 24px 64px rgba(0,0,0,0.15))

#### Component Inventory
| Element | Visual Spec |
|---------|-------------|
| **Logo** | "KA" monogram (56px circle), brand gradient, margin-bottom 24px |
| **Title** | "Welcome back" 1.75rem weight 700 |
| **Subtitle** | "Sign in to Focal" muted 1rem |
| **Email Field** | Label + input (type=email), 48px height, 16px padding, border-radius 12px |
| **Password Field** | Label + input (type=password) + show/hide toggle (eye icon), same size |
| **Remember Me** | Checkbox + label, left-aligned |
| **Forgot Password** | Link, right-aligned, same line as Remember Me |
| **Submit Button** | Full-width, 48px, brand gradient, weight 600, "Sign in" |
| **Error Toast** | Red bar above form if login fails, slide-down animation |
| **Loading** | Spinner in button, "Signing in...", disabled |

#### Interaction Patterns
- **Enter key:** Submits form
- **Show/hide password:** Toggle input type, icon changes
- **Auto-focus:** Email field on load
- **Validation:** HTML5 required + email type, custom "Invalid credentials" from API

#### Responsive
- **< 480px:** Card full-width (calc(100vw - 32px)), reduced padding

---

### 15.27 404 Not Found (`/v3/404`)

**File:** `frontend/src/app/components/not-found/not-found.html`

#### Visual Layout
- **Centered, full-screen flex:** Min-height 100vh
- **Content:** Large "404" (8rem, weight 800, brand gradient text), "Page not found" H2, description, "Go Home" button
- **Animation:** Subtle float on "404", pulse on button

---

### 15.28 Article Not Found (`/v3/article-not-found`)

**File:** `frontend/src/app/components/article-not-found/article-not-found.html`

#### Visual Layout
- **Similar to 404** but with "Article not found" messaging
- **Button:** "Back to Knowledge Base" → `/v3/knowledge-base`

---

### 15.29 Global Design System (CSS Variables)

**File:** `frontend/src/styles.css` (root variables)

#### Color Palette
```css
:root {
  /* Brand */
  --brand: #6366f1;           /* Indigo-500 */
  --brand-hover: #4f46e5;     /* Indigo-600 */
  --brand-light: #eef2ff;     /* Indigo-50 */
  --brand-text: #312e81;      /* Indigo-900 */
  
  /* Semantic */
  --success: #10b981;         /* Emerald-500 */
  --warning: #f59e0b;         /* Amber-500 */
  --danger: #ef4444;          /* Red-500 */
  --info: #06b6d4;            /* Cyan-500 */
  
  /* Neutrals */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;    /* Slate-50 */
  --bg-tertiary: #f1f5f9;     /* Slate-100 */
  --bg-card: #ffffff;
  --bg-hover: #f1f5f9;
  
  --text-primary: #0f172a;    /* Slate-900 */
  --text-secondary: #475569;  /* Slate-600 */
  --text-muted: #94a3b8;      /* Slate-400 */
  --text-inverse: #ffffff;
  
  --border-light: #e2e8f0;    /* Slate-200 */
  --border-medium: #cbd5e1;   /* Slate-300 */
  --border-focus: #6366f1;    /* Brand */
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(15,23,42,0.05);
  --shadow-md: 0 4px 12px rgba(15,23,42,0.08);
  --shadow-lg: 0 12px 32px rgba(15,23,42,0.12);
  --shadow-xl: 0 24px 64px rgba(15,23,42,0.15);
  
  /* Spacing (4px base unit) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  
  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;
  
  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.25rem;    /* 20px */
  --text-2xl: 1.5rem;    /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.25rem;   /* 36px */
  --text-5xl: 3rem;      /* 48px */
  
  /* Transitions */
  --transition-fast: 120ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;
  
  /* Layout */
  --sidebar-width: 284px;
  --topbar-height: 64px;
  --content-max: 1400px;
  
  /* Z-index */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-sidebar: 300;
  --z-topbar: 400;
  --z-modal-backdrop: 1000;
  --z-modal: 1100;
  --z-toast: 2000;
}
```

#### Dark Mode (not yet implemented, but variables prepared)
```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0f172a;
    --bg-secondary: #1e293b;
    --bg-tertiary: #334155;
    --bg-card: #1e293b;
    --bg-hover: #334155;
    --text-primary: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-muted: #64748b;
    --border-light: #334155;
    --border-medium: #475569;
  }
}
```

#### Button Variants
| Variant | Background | Text | Border | Hover |
|---------|------------|------|--------|-------|
| **Primary** | brand gradient | white | none | brand-hover gradient |
| **Ghost** | transparent | brand | 1px brand | brand-light bg |
| **Danger** | danger | white | none | danger-dark |
| **Success** | success | white | none | success-dark |
| **Outline** | transparent | text-primary | 1px border-medium | bg-hover |

#### Badge Variants
| Variant | Background | Text | Usage |
|---------|------------|------|-------|
| **Default** | bg-tertiary | text-secondary | Neutral info |
| **Success** | success-light | success-dark | Active, Online |
| **Warning** | warning-light | warning-dark | Pending, Away |
| **Danger** | danger-light | danger-dark | Closed, Offline |
| **Brand** | brand-light | brand-text | Featured, Primary |
| **Purple** | purple-light | purple-dark | Bot messages |

#### Form Input Styles
```css
.v3-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.v3-input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 20%, transparent);
}

.v3-input::placeholder {
  color: var(--text-muted);
}
```

#### Animations
```css
/* Staggered entrance */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.stagger-children > * {
  animation: fade-in-up var(--transition-base) both;
}

.stagger-children > *:nth-child(1)  { animation-delay: 0ms; }
.stagger-children > *:nth-child(2)  { animation-delay: 40ms; }
.stagger-children > *:nth-child(3)  { animation-delay: 80ms; }
/* ... up to 12 */

/* Pulse for loading states */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.pulse { animation: pulse 1.5s ease-in-out infinite; }

/* Slide in/out for drawers, toasts */
@keyframes slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes slide-out-right { from { transform: translateX(0); } to { transform: translateX(100%); } }
```

#### Accessibility
- **Focus visible:** 3px ring using `color-mix(in srgb, var(--brand) 20%, transparent)`
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables all animations
- **Color contrast:** All combinations meet WCAG AA (4.5:1 for text, 3:1 for UI)
- **Semantic HTML:** Proper heading hierarchy, landmarks, ARIA labels on icon-only buttons
- **Keyboard:** All interactive elements reachable and operable via keyboard

---

### 15.30 Responsive Breakpoint Summary

| Breakpoint | Width | Sidebar | Layout Changes |
|------------|-------|---------|----------------|
| **Desktop XL** | ≥ 1440px | Fixed (284px) | Full 3-pane where applicable |
| **Desktop** | 1024–1439px | Fixed (284px) | Full 3-pane, content max-width 1200px |
| **Tablet** | 768–1023px | Drawer | Left/Right panes become drawers/sheets |
| **Mobile** | 480–767px | Drawer | Stacked single column, bottom sheets |
| **Mobile Small** | < 480px | Drawer | Full-width cards, reduced padding |

---

### 15.31 Key User Flows

#### Flow 1: Agent Handling a Ticket (CRM My Playlist)
1. Agent logs in → lands on `/v3/home`
2. Clicks "CRM Inbox" card → `/v3/crm` (My Playlist)
3. Auto-assigned oldest ticket → Summary + Thread + Composer visible
4. Reads thread, clicks attachment → modal preview
5. Switches composer to "Internal Note", adds note for TL
6. Switches back to "Email", composes reply with rich text
7. Adds tag via hierarchical picker
8. Clicks "Submit/Next" → ticket resolved → auto-advances to next
9. Toast: "Ticket resolved. Next ticket loaded."

#### Flow 2: Creating a KB Article with Map
1. Admin navigates to `/v3/article-management`
2. Fills category, title, content → "Create"
3. Clicks "Map" on new article → opens `/v3/kb-map-builder`
4. Selects article in dropdown → "Add Node" × 5
5. Drags nodes to arrange, wires choices between nodes
6. Marks first node as "Start"
7. Clicks "Auto Layout" for hierarchy
8. Clicks "Save" → POST to API → toast "Map saved"
9. Clicks "Open KB" → verifies in read-only KB view

#### Flow 3: Collaboration - Channel Discussion with KB Link
1. User opens `/v3/collaboration`
2. Selects "#general" channel
3. Types @ → mentions @jane.doe
4. Clicks KB dropdown → selects "Refund Policy" article
5. Article chip appears in composer
6. Sends message → appears with mention highlight + KB chip
7. Jane receives notification (if online) or sees unread badge
8. Jane clicks KB chip → opens KB article in new tab

#### Flow 4: Process Assistant - AI Query
1. Agent opens `/v3/process-assistant`
2. Selects "Billing Support" prompt profile
3. Types "How to handle partial refund?"
4. Sends → "Thinking..." animation → streams response
5. Reads answer, asks follow-up
6. Conversation auto-saved, appears in history list
7. Next time: selects from history to continue

#### Flow 5: Live Chat - Claim & Resolve
1. Agent opens `/v3/live-chat` → sees empty state + "Play" button
2. Clicks "Play" → claims oldest waiting customer
3. Customer messages appear left, agent replies right
4. Uses canned responses (not implemented, manual typing)
5. Customer satisfied → agent clicks "Close" → status = closed
6. Returns to queue, clicks "Play" for next

#### Flow 6: Admin - Configure RBAC
1. Admin opens `/v3/role-access-map`
2. Matrix loads: 6 system roles × 25 features
3. Unchecks "article_management" for TEAM_LEADER
4. Clicks "Save" → PUT `/api/access-control/config`
5. Instant: TEAM_LEADER users lose Article Management nav item
6. Creates custom role "SENIOR_AGENT" with specific features
7. Assigns role to user in `/v3/staff-management`

---

### 15.32 State Management Summary

---

## Production UX Delivery Notes: Authentication, State, and End-to-End Flows

### Mandatory Editorial Design Rule

The `Default UI Style Rule` in `03-frontend-architecture.md` applies to every page and component in this document. UI output must be bespoke, editorial, high-end, semantic, and accessible: use asymmetrical layouts and varied rhythm; avoid centered template heroes and symmetrical three-column icon grids; pair an editorial display typeface with a clean sans-serif; use warm off-whites and one intentional accent; avoid generic gradients, circular icon wrappers, soft heavy shadows, and hover scaling; prefer subtle borders, crisp hard offsets, expanding underlines, and restrained color fills.

Preserve the design system, accessibility standards, responsive layouts, error pages, and user flows above. Replace the localStorage token row in the state table with an `httpOnly` server session cookie. Preferences that are not security-sensitive may use browser storage for responsiveness, but PostgreSQL is the durable user preference source and the UI must tolerate stale local state.

### Secure end-to-end flow adjustments

- **Sign-in:** Next.js redirects through OIDC PKCE; it renders the authenticated shell only after server-side membership and tenant resolution.
- **Authorization:** each page/action verifies tenant membership, feature permission, and resource access in Next.js server modules; route guards remain a convenience only.
- **Upload:** initiate authorized upload → private tenant S3 prefix → malware/type/size verification → object becomes available → signed download URL on demand.
- **Background work:** an API commits business state and an outbox record transactionally → worker processes SQS message idempotently → retries with backoff → DLQ/alert after exhaustion.
- **Notification/integration:** email, Gmail/Meta sync, and optional payment webhook effects are queued, signed/verified, observable, and idempotent.

Login screens should use the identity-provider flow rather than collect passwords in a custom form unless the selected identity provider expressly supports a secure embedded flow. All form submissions retain inline error summaries, keyboard support, and retry-safe disabled/pending states.

| State Type | Storage | Scope | Persistence |
|------------|---------|-------|-------------|
| **Auth (token, user)** | localStorage | Session | Survives refresh |
| **UI Scale (COMPACT/CLASSIC)** | localStorage + service | User | Survives refresh |
| **Language** | localStorage + service | User | Survives refresh |
| **Timezone** | localStorage + service | User | Survives refresh |
| **Status** | Service + API | Session | Refreshed on load |
| **Sidebar open/closed** | Component state | Session | Lost on refresh |
| **Starred/Muted rooms** | localStorage | User | Survives refresh |
| **Selected KB article** | Component state | Page | Lost on navigation |
| **Canvas transform (pan/zoom)** | Component state | Page | Lost on navigation |
| **Composer drafts** | Component state | Page | Lost on navigation |
| **Collaboration messages** | Service (BehaviorSubject) | Session | Polling refreshes |
| **Presence users** | Service (BehaviorSubject) | Session | Polling refreshes |
| **Access control config** | Service (BehaviorSubject) | App | Loaded once, refreshed on admin save |
