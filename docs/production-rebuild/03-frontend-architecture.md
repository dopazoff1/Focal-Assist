# Focal - Frontend Architecture (V3 Shell)

> Complete frontend architecture, routing, component inventory, and key patterns.

---

## 4. FRONTEND - V3 SHELL ARCHITECTURE

### 4.1 Routing Structure (app.routes.ts)

The app uses **lazy-loaded standalone components** with route guards.

```typescript
// Main route structure
const routes: Routes = [
  // Public routes
  { path: '', redirectTo: 'v3/home', pathMatch: 'full' },
  { path: 'login', loadComponent: loadLogin },
  
  // V3 Shell - Protected by AuthGuard
  {
    path: 'v3',
    loadComponent: loadV3Shell,           // V3ShellComponent
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', loadComponent: loadV3Home },           // V3HomeComponent
      
      // Feature routes - protected by RoleGuard + feature flag
      { path: 'calendar', component: CalendarComponent, canActivate: [RoleGuard], data: { feature: 'calendar' } },
      { path: 'magic-assistance', loadComponent: loadMagicAssistance, canActivate: [RoleGuard], data: { feature: 'magic_assistance' } },
      { path: 'knowledge-base', loadComponent: loadKnowledgeBase, canActivate: [RoleGuard], data: { feature: 'knowledge_base' } },
      { path: 'kb-analytics', loadComponent: loadKbAnalyticsDashboard, canActivate: [RoleGuard], data: { feature: 'knowledge_analytics' } },
      { path: 'collaboration', loadComponent: loadCollaborationHub, canActivate: [RoleGuard], data: { feature: 'collaboration' } },
      { path: 'chat-projects', loadComponent: loadChatProjects, canActivate: [RoleGuard], data: { feature: 'chat_projects' } },
      { path: 'live-chat', loadComponent: loadLiveChat, canActivate: [RoleGuard], data: { feature: 'live_chat' } },
      { path: 'process-assistant', loadComponent: loadProcessAssistant, canActivate: [RoleGuard], data: { feature: 'process_assistant' } },
      { path: 'crm', loadComponent: loadCrm, canActivate: [RoleGuard], data: { feature: 'flowdesk' } },
      { path: 'crm/ticket/:ticketId', loadComponent: loadCrm, canActivate: [RoleGuard], data: { feature: 'flowdesk' } },
      
      // Academy
      { path: 'academy', loadComponent: loadTrainingHome, canActivate: [RoleGuard], data: { feature: 'academy_home' } },
      { path: 'academy/catalog', loadComponent: loadTrainingCatalog, canActivate: [RoleGuard], data: { feature: 'academy_catalog' } },
      { path: 'academy/studio', loadComponent: loadTrainingStudio, canActivate: [RoleGuard], data: { feature: 'academy_studio' } },
      { path: 'academy/studio/course/:id', loadComponent: loadTrainingCourseEditor, canActivate: [RoleGuard], data: { feature: 'academy_studio' } },
      { path: 'academy/analytics', loadComponent: loadTrainingAnalytics, canActivate: [RoleGuard], data: { feature: 'academy_analytics' } },
      { path: 'academy/course/:id/certificate', loadComponent: loadTrainingCertificate, canActivate: [RoleGuard], data: { feature: 'academy_certificate' } },
      { path: 'academy/course/:id', loadComponent: loadTrainingCourseView, canActivate: [RoleGuard], data: { feature: 'academy_course' } },
      
      // Admin / Builder routes
      { path: 'staff-management', loadComponent: loadStaffManagement, canActivate: [RoleGuard], data: { roles: ['ADMIN'], feature: 'staff_management' } },
      { path: 'tree-builder', loadComponent: loadTreeBuilder, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS'], feature: 'builders' } },
      { path: 'kb-map-builder', loadComponent: loadKbMapBuilder, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS'], feature: 'builders' } },
      { path: 'case-tag-builder', loadComponent: loadCaseTagBuilder, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS'], feature: 'builders' } },
      { path: 'prompt-map-builder', loadComponent: loadPromptMapBuilder, canActivate: [RoleGuard], data: { roles: ['ADMIN'], feature: 'prompt_map_builder' } },
      { path: 'article-management', loadComponent: loadArticleManagement, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS'], feature: 'article_management' } },
      { path: 'article-management/edit/:id', loadComponent: loadArticleEditor, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'HEAD_CS'], feature: 'article_management' } },
      { path: 'role-access-map', loadComponent: loadRoleAccessMap, canActivate: [RoleGuard], data: { roles: ['ADMIN'], feature: 'role_access_map' } },
      
      // User settings
      { path: 'settings', loadComponent: loadUserSettings, canActivate: [RoleGuard], data: { feature: 'user_settings' } },
      
      // Other
      { path: 'adherence-dashboard', loadComponent: loadAdherenceDashboard, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'TEAM_LEADER'], feature: 'adherence' } },
      { path: 'qa-evaluation', loadComponent: loadQaEvaluation, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'QA', 'TEAM_LEADER'], feature: 'qa_evaluation' } },
      { path: 'team-management', loadComponent: loadTeamManagement, canActivate: [RoleGuard], data: { roles: ['ADMIN', 'TEAM_LEADER'], feature: 'team_management' } },
      { path: 'escalation-desk', loadComponent: loadEscalationDesk, canActivate: [RoleGuard], data: { feature: 'escalation_desk' } },
      
      // Error pages
      { path: '404', loadComponent: loadNotFound },
      { path: 'article-not-found', loadComponent: loadArticleNotFound },
    ]
  },
  
  // Fallbacks for legacy routes
  { path: 'home', redirectTo: 'v3/home', pathMatch: 'full' },
  { path: 'magic-assistance', redirectTo: 'v3/magic-assistance', pathMatch: 'full' },
  // ... other redirects to v3
  
  { path: '**', redirectTo: '/v3/404', pathMatch: 'full' }
];
```

### 4.2 V3 Shell Component (`v3-shell`)

**File:** `frontend/src/app/components/v3-shell/v3-shell.ts`

**Key Features:**
- **Layout:** CSS Grid sidebar (284px) + main content
- **Responsive:** Mobile sidebar drawer with backdrop
- **State Management:** Reactive services (Auth, Settings, Presence, Collaboration, AccessControl)
- **Internationalization:** i18n pipe with locale support (en, lt, lv, et)
- **User Profile:** Avatar, status selector, timezone, language, UI scale (COMPACT/CLASSIC)
- **Quick Search:** Global search (Cmd/Ctrl+K)
- **Notifications:** In-app notification center with real-time updates

**Sidebar Navigation Groups:**
1. **Workspace:** Command Center, Calendar, CRM Inbox, Magic Assistance, Knowledge Base, KB Analytics
2. **Team:** Collaboration, Chat Projects, Live Chat, Process Assistant
3. **Learning:** Academy Home, Catalog, Studio, Analytics
4. **Tools (Admin/Builders):** Staff Management, Tree Builder, KB Map Builder, Case Tag Builder, Prompt Map Builder, Article Management, Role Access Map
5. **Insights:** Adherence Dashboard, QA Evaluation, Team Management, Escalation Desk
6. **Settings:** User Settings

**Status Options:** ONLINE, AWAY, WRAPUP, BREAK, OFFLINE

### 4.3 V3 Home Component (`v3-home`)

**File:** `frontend/src/app/components/v3-home/v3-home.ts`

**Dashboard Cards (Feature-Gated):**
- CRM Inbox (`flowdesk`)
- Calendar (`calendar`)
- Knowledge Base (`knowledge_base`)
- Magic Assistance (`magic_assistance`)
- Collaboration (`collaboration`)
- Process Assistant (`process_assistant`)
- KB Analytics (`knowledge_analytics`)
- Article Management (`article_management`)
- Academy (`academy_home`)
- Chat Projects (`chat_projects`)
- Live Chat (`live_chat`)
- Adherence Dashboard (`adherence`)
- Team Management (`team_management`)
- Staff Management (`staff_management`)
- Builders (`builders`)
- QA Evaluation (`qa_evaluation`)
- Escalation Desk (`escalation_desk`)

### 4.4 Key Frontend Services

| Service | File | Purpose |
|---------|------|---------|
| `AuthService` | `services/auth.ts` | Login, logout, token storage, user state |
| `KbService` | `services/kb.ts` | KB articles, categories, maps, analytics, feedback |
| `PageService` | `services/page.ts` | Decision tree pages & choices |
| `SettingsService` | `services/settings.ts` | User preferences, timezone, Jira, profile photo |
| `PresenceService` | `services/presence.ts` | User status, timeline |
| `CollaborationService` | `services/collaboration.ts` | Real-time chat, channels, DMs, reactions, typing |
| `AccessControlService` | `services/access-control.ts` | Role-based feature access, feature catalog |
| `AuthInterceptor` | `interceptors/auth-interceptor.ts` | Adds JWT to outgoing requests |
| `I18nService` | `services/i18n.ts` | Translations, locale management |

### 4.5 Role-Based Access Control (Frontend)

---

## Production Next.js Full-Stack Adaptation

Retain the routes, navigation groups, feature catalogue, visual design, and component-level business behaviour above. Implement them in a Next.js App Router application; `/v3/*` paths may remain stable during transition. Route access is checked in server layouts/pages before rendering. A client component can hide unavailable features but cannot make an authorization decision.

```text
frontend/
  app/(authenticated)/v3/[feature]/page.tsx  # Server Components and page-level authorization
  app/api/.../route.ts                       # Public HTTP, streaming, webhook, and integration boundaries
  components/                                # Client components only for interaction/canvas/editor
  server/{auth,db,policy,queues,schemas}/     # server-only TypeScript modules
  lib/{contracts,formatting}/                 # safe shared types; no secrets
```

Use React Server Components for dashboard data, lists, article views, settings shells, and permission-dependent navigation. Use Client Components only for canvas builders, rich-text editing, drag/drop, presence, interactive forms, and live UI state. Mutations use Server Actions when they are same-origin form actions; use Route Handlers for streaming, widget/webhook boundaries, or explicit browser APIs. All privileged business logic executes in server-only TypeScript modules using the validated session and tenant context; database credentials and privileged logic never reach the browser.

Use `httpOnly`, `Secure`, `SameSite=Lax` session cookies; never store access/refresh tokens in localStorage. Render `loading.tsx`, `error.tsx`, and `not-found.tsx` boundaries for each major feature. Cache only tenant-safe, permission-safe reads, tag cache keys by tenant/resource version, and revalidate on mutation. Personal CRM, inbox, and permission data are `no-store`; public/static assets use Cloudflare CDN cache rules.

Shared contracts are generated from an OpenAPI definition or maintained as versioned DTO schemas. Do not expose database row shapes directly to Client Components. The frontend sends correlation IDs, presents accessible error states, and sanitizes HTML through an allowlist before rendering KB/editor content. Content Security Policy must prohibit inline script except narrowly nonce-based framework requirements.

### Default UI Style Rule

All HTML, CSS, Tailwind, and component work must look bespoke, editorial, high-end, hand-crafted, and distinctly non-template-driven. Apply these rules by default:

- **Layout:** never use symmetrical three-column feature grids with centered icons. Prefer asymmetrical compositions, two-column editorial splits, or a single wide-margin column.
- **Heroes:** avoid the generic centered title, subtitle, and two-pill-button pattern. Use left-aligned headlines, inline calls to action, or asymmetrical media placement.
- **Rhythm:** vary section density and whitespace intentionally. Do not repeat uniform spacing such as `py-20` across every section.
- **Typography:** pair a distinctive editorial display face—such as Playfair Display, Space Grotesk, Syne, Cormorant, or Instrument Serif—with a clean sans-serif body face. Do not default headings to system fonts, Inter, or Roboto.
- **Color:** on white pages, use warm off-whites such as `#FAF8F5` or `#F5F3EF`, muted tints, or deliberate dark contrast instead of `#F3F4F6`/`bg-gray-100`. Use one intentional highlight color and avoid generic blue-purple gradients.
- **Elevation:** never use soft heavy-spread shadows such as `shadow-lg` or `shadow-2xl`. Frame content with a subtle `1px` border such as `rgba(0,0,0,0.08)` or, when appropriate, a crisp hard offset such as `4px 4px 0 #000`.
- **Details:** avoid generic circular icon wrappers. Prefer typographic labels, purposeful inline SVG accents, or high-quality photography.
- **Interaction:** do not use basic hover scaling such as `scale(1.05)`. Use refined border-color shifts, expanding underlines, or flat background fills.
- **Code quality:** generate clean, semantic, accessible markup and maintainable Tailwind/CSS while preserving these visual principles.

**Roles (normalized):** `ADMIN`, `HEAD_CS`, `OPS`, `TEAM_LEADER`, `QA`, `AGENT`

**Feature Matrix (from AccessControlService):**

| Feature | ADMIN | HEAD_CS | OPS | TEAM_LEADER | QA | AGENT |
|---------|-------|---------|-----|-------------|-----|-------|
| command_center | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| calendar | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| magic_assistance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| knowledge_base | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| knowledge_analytics | ✓ | ✓ | ✓ | | ✓ | |
| article_management | ✓ | ✓ | ✓ | | | |
| collaboration | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| chat_projects | ✓ | ✓ | ✓ | | | |
| live_chat | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| process_assistant | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| academy_home | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| academy_catalog | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| academy_studio | ✓ | ✓ | ✓ | ✓ | ✓ | |
| academy_analytics | ✓ | ✓ | ✓ | ✓ | ✓ | |
| flowdesk | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| escalation_desk | ✓ | ✓ | ✓ | | ✓ | |
| qa_evaluation | ✓ | ✓ | ✓ | ✓ | ✓ | |
| adherence | ✓ | ✓ | ✓ | ✓ | | |
| team_management | ✓ | ✓ | ✓ | ✓ | | |
| builders | ✓ | ✓ | | | | |
| prompt_map_builder | ✓ | | | | | |
| user_settings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

**Role normalization mapping:**
- `1` → ADMIN
- `2` → AGENT
- `3` → TEAM_LEADER
- `4` → QA
- `5` → HEAD_CS
- `6` → OPS
- `ROLE_ADMIN` → ADMIN
- `HEAD_OF_CS` → HEAD_CS
- `TL` → TEAM_LEADER
- `QUALITY` → QA
