# Focal - Detailed Page UI/UX: Core Pages

> Pixel-perfect visual descriptions, interaction patterns, and component inventories for core V3 Shell pages.

---

## 15. DETAILED PAGE UI/UX DESCRIPTIONS

This section provides pixel-perfect visual descriptions, interaction patterns, component inventories, and user flows for every page in the V3 Shell.

---

### 15.1 V3 Shell Layout (Global Frame)

**File:** `frontend/src/app/components/v3-shell/v3-shell.html` + `.ts`

#### Visual Layout Structure
- **CSS Grid Layout:** 2-column grid — fixed 284px sidebar + `1fr` main content
- **Mobile (< 1024px):** Sidebar becomes a slide-in drawer with semi-transparent backdrop overlay
- **Z-index layers:** Backdrop (100) < Sidebar (200) < Topbar (300) < Modals (1000+)

#### Component Inventory

| Component | Location | Visual Description |
|-----------|----------|-------------------|
| **Brand Header** | Sidebar top | 48px height, "KA" monogram (32px circle, brand gradient) + "Focal" + subtitle |
| **Navigation Groups** | Sidebar | 6 collapsible groups with section labels (Workspace, Academy, Build, Manage, Delivery, Settings) |
| **Nav Items** | Sidebar | 40px height, 2-letter icon badge (24px circle), label, optional unread badge (red pill), star toggle |
| **User Footer** | Sidebar bottom | Avatar (40px), name, role, "Edit photo" link |
| **Topbar** | Main header | 64px fixed height: burger menu, page title (kicker + title), global search, collab chip, language/tz/status dropdowns, logout |
| **Content Host** | Main area | `router-outlet` with optional `.compact-center` class for COMPACT UI scale |
| **Profile Photo Modal** | Overlay | 480px wide, canvas-based cropper (360×360), zoom slider, rotate buttons, save/remove actions |

#### Interaction Patterns
- **Sidebar toggle:** Burger button (hamburger → X animation) or backdrop click
- **Navigation:** Click nav item → route change → auto-close sidebar on mobile
- **Status change:** Dropdown → PUT `/api/presence/me` → optimistic UI update
- **Language switch:** Dropdown → `I18nService.setLocale()` → instant translation
- **Quick Search (Cmd/Ctrl+K):** Focuses search input, Enter submits to `/api/kb/articles?q=...`
- **Global keyboard shortcuts:** Escape closes modals/sidebar, Cmd/Ctrl+K opens search

#### Visual States
| State | Description |
|-------|-------------|
| **Loading** | Spinner in content area, skeleton placeholders in sidebar |
| **Empty** | "No conversations" / "Select a room" center-aligned |
| **Error** | Red toast top-right (fixed position, 420px max-width, slide-in animation) |
| **Success** | Blue toast, auto-dismiss after 4s |

#### Responsive Breakpoints
- **≥ 1024px:** Full sidebar always visible
- **< 1024px:** Sidebar drawer, backdrop click closes, topbar burger visible
- **< 640px:** Topbar search collapses to icon-only, dropdowns stack vertically

#### Data Flow
- `AuthService.loggedInUser$` → drives user avatar, name, role, status
- `AccessControlService.config$` → drives which nav items render
- `CollaborationService.unreadCount$` → drives badge on Collaboration nav item
- `SettingsService.timeZones` → populates timezone dropdown (IANA list)

---

### 15.2 V3 Home Dashboard (`/v3/home`)

**File:** `frontend/src/app/components/v3-home/v3-home.html` + `.ts`

#### Visual Layout Structure
- **Hero Section** (top): 2-column grid — left: brand copy + role/status chips; right: quick-action buttons
- **Card Grid** (below): CSS Grid `repeat(auto-fill, minmax(280px, 1fr))` gap 16px, max 4 columns
- **Cards:** 160px height, 2-letter icon badge (top-left), title + description, CTA arrow (bottom-right)

#### Component Inventory
| Element | Visual Spec |
|---------|-------------|
| **Hero Eyebrow** | 12px uppercase, brand color, letter-spacing 0.08em |
| **Hero Title** | 2.5rem, weight 700, line-height 1.2 |
| **Hero Subtitle** | 1.1rem, muted color |
| **Role Chips** | 3 inline pills: Role, Status (colored dot), Timezone |
| **Quick Actions** | 2-row button group: primary (solid) + ghost variants |
| **Dashboard Cards** | White card, subtle border, hover: border-brand + shadow-md, icon badge 48px circle |

#### Feature-Gated Cards (26 total)
Cards only render if `AccessControlService.hasFeatureAccess(role, feature)` returns true:

| Card | Feature Key | Icon | Route |
|------|-------------|------|-------|
| CRM Inbox | flowdesk | IN | `/v3/crm` |
| Collaboration | collaboration | CH | `/v3/collaboration` |
| Live Chat | live_chat | LC | `/v3/live-chat` |
| Chat Projects | chat_projects | CP | `/v3/chat-projects` |
| Calendar | calendar | CL | `/v3/calendar` |
| Magic Assistance | magic_assistance | MA | `/v3/magic-assistance` |
| Knowledge Base | knowledge_base | KB | `/v3/knowledge-base` |
| KB Analytics | knowledge_analytics | KA | `/v3/kb-analytics` |
| Process Assistant | process_assistant | AI | `/v3/process-assistant` |
| Academy | academy_home | AC | `/v3/academy` |
| FlowDesk Board | flowdesk | FD | `/v3/flowdesk/board` |
| Article Management | article_management | AR | `/v3/article-management` |
| Team Management | team_management | TM | `/v3/team-management` |
| QA Evaluation | qa_evaluation | QA | `/v3/qa-evaluation` |
| Adherence Dashboard | adherence | AD | `/v3/adherence-dashboard` |
| Tree Builder | builders | TB | `/v3/tree-builder` |
| KB Map Builder | builders | MP | `/v3/kb-map-builder` |
| Case Tag Builder | builders | TG | `/v3/case-tag-builder` |
| Prompt Map Builder | prompt_map_builder | AI | `/v3/prompt-map-builder` |
| Staff Management | staff_management | ST | `/v3/staff-management` |
| Role Access Map | role_access_map | RA | `/v3/role-access-map` |
| User Settings | user_settings | SE | `/v3/settings` |

#### Interaction Patterns
- **Card hover:** Border color shifts to brand, subtle lift (transform: translateY(-2px))
- **Click card:** Navigation via `routerLink` (no button semantics, whole card is link)
- **Quick action click:** Direct navigation, primary actions solid, secondary ghost

#### Empty State
If no features accessible (shouldn't happen — `command_center` always allowed): Centered "No tools available" with logout link.

---

### 15.3 Knowledge Base (`/v3/knowledge-base`)

**File:** `frontend/src/app/components/knowledge-base/knowledge-base.html`

#### Visual Layout Structure
- **Two-pane layout:** 320px fixed sidebar + flexible content area
- **Sidebar:** Search input (top) → Category tree with articles (nested lists)
- **Content:** Article header (title + actions) → Feedback section → Content/Map toggle → Article body or Map canvas

#### Component Inventory

| Component | Visual Spec |
|-----------|-------------|
| **Search Input** | 40px height, 16px padding, clear (×) button appears on input |
| **Category Header** | 14px uppercase, muted, letter-spacing 0.05em |
| **Article Items** | 44px height, hover highlight, staggered entrance animation (--kb-article-delay CSS var) |
| **Article Title Button** | Left-aligned, text-overflow ellipsis, no button chrome |
| **Copy Link Button** | Ghost, 32px height, "Copy" label, tooltip on hover |
| **Content View** | `div[innerHTML]` with article content, prose styling (max-width 800px) |
| **Map View** | Canvas-based: grid background, node cards (200×120px), SVG wires between choice buttons and targets |
| **Map Node Card** | White card, title, "i" badge if has content, click → opens step overlay |
| **Step Overlay** | Modal dialog (centered, 480px max-w), title, HTML content, choice buttons with target titles |
| **Feedback Section** | Like/Dislike toggle buttons → expands textarea → submit with loading state |

#### Interaction Patterns
- **Search:** Debounced 300ms → filters articles client-side
- **Article select:** Click title → loads content + map via `KbService.getArticle()` + `getMap()`
- **View toggle:** "Content" / "Map / SOP" buttons switch `viewMode` state
- **Map pan:** Mouse drag on canvas background
- **Map zoom:** Wheel (not implemented in read-only view, only in builder)
- **Node click:** Opens step overlay (modal), click overlay backdrop or × closes
- **Choice click in overlay:** Navigates to target node (highlights, scrolls into view)
- **Feedback:** Like/Dislike → opens bubble → textarea → submit → POST `/api/kb/articles/{id}/feedback`
- **Copy link:** `navigator.clipboard.writeText()` → toast "Link copied"

#### Visual States
| State | Description |
|-------|-------------|
| **Loading** | Sidebar spinner "Loading articles...", content "Loading..." chip |
| **Empty (no selection)** | Large "Knowledge Base" title + "Select a document from the left panel" |
| **Map empty** | "No steps are available in this map" centered in canvas |
| **Map loading** | "Loading map..." centered |

#### Responsive Behavior
- **< 1024px:** Sidebar collapses to drawer (same as shell sidebar), content full-width
- **< 768px:** Article header actions stack vertically, map node cards 100% width in overlay

---

### 15.4 Magic Assistance (`/v3/magic-assistance`)

**File:** `frontend/src/app/components/magic-assistance/magic-assistance.html`

#### Visual Layout Structure
- **Single centered card** (max-width 720px) with subtle shadow, rounded corners
- **Top bar:** Back button (if not start) + tag badge
- **Title:** Page name (H1, 1.75rem)
- **Content:** HTML-rendered page content
- **Choices Grid:** CSS Grid `repeat(auto-fit, minmax(180px, 1fr))` gap 12px
- **End state:** "EOP - End of Process" terminal message

#### Component Inventory
| Element | Visual Spec |
|---------|-------------|
| **Card** | White, 24px padding, border-radius 16px, box-shadow 0 8px 32px rgba(0,0,0,0.08) |
| **Back Button** | Ghost, ← arrow, 14px, appears only when `!page.isStart` |
| **Tag Badge** | Pill, brand background, white text, 12px, uppercase |
| **Page Title** | 1.75rem, weight 600, margin-bottom 1rem |
| **Content Area** | Prose styling, renders HTML from `page.content` |
| **Choice Buttons** | 56px height, border-radius 12px, brand border, hover: brand background, white text |
| **Loading Overlay** | Full-card overlay, centered spinner + "Loading process..." |
| **EOP State** | Centered, muted, "EOP - End of Process" H3 |

#### Interaction Patterns
- **Start:** Loads start page via `PageService.getStartPage()`
- **Choice click:** `PageService.getPage(choice.targetPageId)` → updates `page` state
- **Back button:** `PageService.getPage(page.prevPageId)` → navigates back
- **Keyboard:** Enter on focused choice = select, Escape = back
- **Loading:** Full overlay blocks interaction, spinner animates

#### Visual States
| State | Description |
|-------|-------------|
| **Initial load** | Full-card loading overlay |
| **Transition** | Choice buttons disabled, loading overlay shows |
| **End of process** | No choices, EOP message, back button available |
| **Error** | Toast notification, back button enabled |

#### Data Flow
- `PageService.getStartPage()` → initial load
- `PageService.getPage(id)` → each navigation step
- Page object: `{ id, name, content, tag, prevPageId, isStart, choices[] }`

---

### 15.5 CRM / FlowDesk (`/v3/crm`, `/v3/crm/ticket/:ticketId`)

---

## Production UX Delivery Notes: Core Pages

The described UI remains the product experience. Implement read-heavy dashboards, Knowledge Base, and CRM shells as Server Components with data fetched through server-only TypeScript modules after tenant and page-policy checks. CRM queues and ticket pages are always private, uncached server reads; never prefetch ticket content across tenant/account boundaries. Use cursor pagination and virtualized client lists for high-volume inboxes.

Knowledge Base articles are sanitized at write and render time. Rich text links open with safe `rel` attributes, image/media sources are restricted to approved private/CDN origins, and editor uploads follow the signed-upload workflow in the API adaptation. Map/tree bulk saves include a version/ETag and surface a conflict-resolution UI rather than overwriting concurrent work.

Ticket assignment/claim, resolve, reply, tag, and internal-note controls use optimistic UI only after the action is accepted. The API is authoritative for SLA, queue access, assignee, and transitions. All actions show accessible pending/error states, and write paths carry a correlation/idempotency key. Customer content is treated as untrusted text; do not render executable HTML from messages or external email.

**File:** `frontend/src/app/components/crm/crm.html` (850+ lines)

#### Visual Layout Structure
- **Three-pane layout:** 280px sidebar (view selector) + flexible main (ticket detail) + optional right QA panel
- **Sidebar:** 5 view modes as radio-style buttons (My Playlist, My Cases, Open Cases, All Cases, My Chats)
- **Main:** Varies by view — single ticket workspace (My Playlist) or list+detail (others)
- **Ticket Workspace:** 3-row grid — Summary card (sticky top) + Thread (grow) + Composer (sticky bottom)

#### Component Inventory

| Component | Visual Spec |
|-----------|-------------|
| **View Selector Buttons** | 56px height, left border accent (4px brand when active), title + subtitle, hover bg |
| **Toast Container** | Fixed top-right (74px from top), slide-in, 4px left border (red/blue), dismiss × |
| **Attachment Modal** | 600px max-w, header (badge + filename + meta), preview (img/iframe/fallback), actions |
| **Summary Card** | Gradient left border (brand), ticket ID + subject, status badges, tag pills, contact info |
| **Thread List** | Messages with colored borders: customer (left slate), agent (right blue), internal (left gray) |
| **Message Meta** | Author name, "Internal" badge if internal, timestamp |
| **Message Body** | `[innerHTML]` rendered email content |
| **Attachments Grid** | Cards with icon, name, mime, size, inline badge, click → open modal |
| **Composer Mode Switch** | Segmented control: Email (solid when active) / Internal Note (ghost when inactive) |
| **Rich Editor** | `contenteditable` div, min-height 120px, toolbar (B, I, U, List, Link, Image) |
| **Image Controls** | Preset widths (S/M/L/Fit/Original), remove button |
| **Tag Picker** | Hierarchical dropdown with breadcrumb navigation, search hint, max-height 220px scroll |
| **Status Dropdown** | open/pending/resolved/closed |
| **Action Buttons** | "Submit/Next" (primary), "Next" (playlist only), disabled during submit |

#### Key Views & Their Layouts

**1. My Playlist (Single-pane workspace)**
- Auto-assigns oldest ticket
- Single ticket workspace: Summary → Thread → Composer
- "Next" button: Submit + auto-advance to next ticket

**2. My Cases / Open Cases / All Cases (List + Detail)**
- Left: Case list (clickable cards with badges)
- Right: Ticket workspace (same as playlist but no "Next" button)
- All Cases: Table view with columns (Subject, Status+Tags, Priority, Queue, Assigned, Created By)

**3. My Chats (Live Chat style)**
- Left: Chat thread list (project filter, status filter)
- Right: Selected chat with message bubbles + composer

#### Interaction Patterns
- **View switch:** Click sidebar button → loads appropriate data → updates URL if deep-linked
- **Ticket select:** Click case card → loads thread + sets selected ticket
- **Composer mode:** Toggle Email/Internal → changes editor background + hint text
- **Rich text:** Toolbar buttons → `document.execCommand()`, Image → file picker → base64 insert
- **Tag picker:** Click "Choose/Change" → opens hierarchical picker → select leaf → adds tag pill
- **Attachment click:** Opens modal with preview (image/pdf/fallback) → download/new tab
- **Toast dismiss:** Click × or auto-dismiss after 5s
- **Gmail sync:** "Sync Inbox & Refresh" button → POST `/api/gmail/sync` → refreshes All Cases

#### Visual States
| State | Description |
|-------|-------------|
| **Loading** | Skeleton cards in list, spinner in thread, disabled composer |
| **Empty list** | "No assigned tickets" / "No conversations" muted text |
| **No ticket selected** | "No ticket selected" in detail pane |
| **Submitting** | Buttons disabled, "Saving..." / "Moving..." text, spinner |
| **Error** | Toast (red), inline error messages in composer |
| **Success** | Toast (blue), optimistic UI updates |

#### Responsive Behavior
- **< 1200px:** Right QA panel stacks below main
- **< 900px:** Sidebar becomes drawer, list+detail becomes tabs or stacked
- **< 640px:** Composer toolbar wraps, tag picker full-screen modal
