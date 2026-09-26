# Focal - Detailed Page UI/UX: Builder & Admin Pages

> Pixel-perfect visual descriptions, interaction patterns, and component inventories for canvas-based builders and admin pages.

---

### 15.10 KB Map Builder (`/v3/kb-map-builder`)

**File:** `frontend/src/app/components/kb-map-builder/kb-map-builder.html`

#### Visual Layout Structure
- **Two-pane layout:** 380px left sidebar (controls) + flexible right (canvas)
- **Sidebar:** Article selector → Toolbar (Add Node, Auto Layout, Reload, Save, Delete) → Selected node editor (title, content, start marker) → Choices manager → JSON export
- **Canvas:** Grid background, draggable nodes, SVG wires, live wire drawing

#### Component Inventory

| Component | Visual Spec |
|-----------|-------------|
| **Article Selector** | Dropdown with optgroups by category |
| **Toolbar Buttons** | Primary: Add Node, Save; Ghost: Auto Layout, Reload; Danger: Delete Node |
| **Node Editor** | Title input, Content textarea (HTML), "Mark As Start Node" button |
| **Choices Manager** | Label input + "Add Choice" → list with label, target node ID, remove button |
| **JSON Export** | "Generate JSON" → textarea with formatted JSON → "Copy JSON" |
| **Canvas** | Grid pattern (20px), pan (drag background), zoom (wheel), nodes at x/y |
| **Node Card** | 240×140px, header (#id + title), meta (choice count), choice pills with wire buttons |
| **Choice Pill** | Label + target (#id or "Unlinked") + wire button (+) for drag-to-connect |
| **Live Wire** | Dashed line from choice wire button to mouse cursor during connection |
| **Start Badge** | Green pill "Start" on start node |

#### Interaction Patterns
- **Article select:** Loads existing map via `/api/kb-map/article/{id}` → populates nodes/edges
- **Add node:** Click "Add Node" → creates at canvas center (0,0) with defaults
- **Drag node:** Mousedown on card → drag → updates x/y on mouseup
- **Pan canvas:** Mousedown on background → drag → translates world transform
- **Zoom canvas:** Wheel → scales world transform (0.5x to 3x)
- **Wire choices:** Mousedown on choice wire button (+) → drag to target node → mouseup creates edge
- **Auto layout:** Runs Dagre-style layout algorithm → positions nodes hierarchically
- **Save:** POST `/api/kb-map/article/{id}/save` with full nodes+edges payload
- **JSON export:** Generates payload matching API schema for external use

#### Visual States
| State | Description |
|-------|-------------|
| **No article** | "Select article..." prompt, canvas empty |
| **Loading** | "Loading article map..." in sidebar, canvas empty |
| **Saving** | Save button "Saving...", disabled |
| **Save error** | Error details expandable in sidebar |
| **Node selected** | Node card highlighted (blue border), editor shows in sidebar |
| **Wiring mode** | Live wire follows mouse, choice buttons highlighted |

---

### 15.11 Tree Builder (`/v3/tree-builder`)

**File:** `frontend/src/app/components/tree-builder/tree-builder.html` (similar to KB Map Builder)

#### Visual Layout Structure
- **Two-pane layout:** Same as KB Map Builder but for Process Assistant decision trees
- **Canvas:** Nodes = pages, Edges = choices
- **Sidebar:** Page editor (name, content/TinyMCE, tag, start marker) + choices manager

#### Key Differences from KB Map Builder
- **Node content:** TinyMCE rich text editor (not plain textarea)
- **Save endpoint:** POST `/api/pages/tree/save` with full tree payload
- **Data model:** Pages + Choices (vs KB Map Nodes + Edges)

---

### 15.12 Case Tag Builder (`/v3/case-tag-builder`)

**File:** `frontend/src/app/components/case-tag-builder/case-tag-builder.html` (inferred)

#### Visual Layout Structure
- **Canvas-based hierarchy editor** for tag tree
- **Nodes:** Tags with label, description, color, icon, parent
- **Edges:** Parent-child relationships
- **Sidebar:** Node editor with color picker, icon selector, parent dropdown

#### Features
- Drag-drop to reorder/reparent
- Color picker (hex input + swatch)
- Icon selector (from predefined set)
- Inline node creation on canvas

---

### 15.13 Article Management (`/v3/article-management`)

**File:** `frontend/src/app/components/article-management/article-management.html`

#### Visual Layout Structure
- **Two-pane layout:** 380px left (create + filters) + flexible right (article list)
- **Left — Create Section:** Category dropdown, Title input, Content textarea, Display order, Create button
- **Left — Filters:** Category dropdown, Status dropdown (All/Active/Inactive), Search input
- **Right — List:** Each article row: Title + status badge, action buttons (Edit, Open KB, Map, Toggle, Duplicate, Delete)

#### Component Inventory

| Component | Visual Spec |
|-----------|-------------|
| **Create Form** | Stacked labels, inputs 40px height, textarea 120px, primary Create button |
| **Filters** | Same input style, inline with section header |
| **Article Row** | 2-line: Line 1 = title (truncated) + status badge (green/red); Line 2 = 5 action buttons |
| **Action Buttons** | Edit (primary), Open KB (ghost), Map (ghost), Toggle (ghost), Duplicate (ghost), Delete (danger) |
| **Status Badge** | "Active" (green) / "Inactive" (red) pill |

#### Interaction Patterns
- **Create:** Fill form → POST `/api/kb/articles` → refreshes list
- **Edit:** Click Edit → navigates to `/v3/article-management/edit/:id` (ArticleEditorComponent)
- **Open KB:** Opens `/v3/knowledge-base?article={id}` in new tab
- **Map:** Opens KB Map Builder for that article
- **Toggle:** PATCH `/api/kb/articles/{id}/active` → updates badge instantly
- **Duplicate:** POST `/api/kb/articles/{id}/duplicate` → creates copy with "Copy of" prefix
- **Delete:** Confirm dialog → DELETE → removes from list
- **Search/Filter:** Debounced 300ms → client-side filter of `filteredArticles`

#### Visual States
| State | Description |
|-------|-------------|
| **Creating** | Button "Creating...", disabled |
| **Loading** | "Loading articles..." spinner in list |
| **Empty** | "No articles found" centered |
| **Error** | Red error message above list |

---

### 15.14 Article Editor (`/v3/article-management/edit/:id`)

**File:** `frontend/src/app/components/article-management/article-editor.html` (uses TinyMCE)

#### Visual Layout Structure
- **Full-page editor:** Topbar (back, title, save) → TinyMCE editor → Bottom status (word count, last saved)

#### Component Inventory
| Component | Visual Spec |
|-----------|-------------|
| **TinyMCE Editor** | Full toolbar: formatting, lists, tables, links, images, code, fullscreen |
| **Image Upload** | Custom handler → POST to backend → returns URL → inserts into editor |
| **Content CSS** | Matches KB article prose styling for WYSIWYG |
| **Save Button** | Primary, top-right, "Saving..." state |
| **Back Button** | Ghost, top-left, confirms if unsaved changes |

---

### 15.15 Role Access Map (`/v3/role-access-map`)

**File:** `frontend/src/app/components/role-access-map/role-access-map.html` (inferred from AccessControlService)

#### Visual Layout Structure
- **Matrix/Grid view:** Roles as columns, Features as rows
- **Interactive cells:** Checkbox per role-feature intersection
- **Sidebar/Toolbar:** Add role, save config, reset to defaults

#### Component Inventory
| Component | Visual Spec |
|-----------|-------------|
| **Role Columns** | Role name + description, system badge, active toggle |
| **Feature Rows** | Feature label + description, grouped by category |
| **Matrix Cells** | Checkbox (checked = access granted), hover highlights row/column |
| **Add Role Form** | Name + description → creates custom role |
| **Save/Reset** | Primary Save, Ghost Reset to defaults |

#### Data Flow
- Loads from `/api/access-control/config` → `AccessControlService`
- Save → PUT `/api/access-control/config` with full roles+links
- Real-time updates to `AccessControlService.config$` → affects all navigation instantly

---

### 15.16 User Settings (`/v3/settings`)

**File:** `frontend/src/app/components/user-settings/user-settings.html` (inferred)

#### Visual Layout Structure
- **Tabbed interface:** Profile, Preferences, Jira, Profile Photo, Password
- **Each tab:** Form with labeled inputs, save button per section

#### Component Inventory
| Tab | Fields |
|-----|--------|
| **Profile** | First name, Last name, DOB, Email (read-only) |
| **Preferences** | Language (en/lt/lv/et), Timezone (IANA select), Desktop notifications (toggle), Sound notifications (toggle), UI Scale (COMPACT/CLASSIC) |
| **Jira** | Base URL, Email, API Token, Project Key, Test Connection button |
| **Profile Photo** | Current photo preview, drag-drop upload, crop modal (same as shell), Remove button |
| **Password** | Current, New, Confirm, strength meter |

---

### 15.17 Academy Pages

#### 15.17.1 Academy Home (`/v3/academy`) — `TrainingHomeComponent`
- **Dashboard:** My courses (enrolled), Recommended, Recently viewed
- **Course cards:** Thumbnail, title, progress ring, status badge, Continue button

#### 15.17.2 Catalog (`/v3/academy/catalog`) — `TrainingCatalogComponent`
- **Grid/List toggle:** Course cards with filter sidebar (category, level, duration)
- **Course card:** Image, title, description, level badge, duration, enroll button

#### 15.17.3 Studio (`/v3/academy/studio`) — `TrainingStudioComponent`
- **Admin view:** Course list with create/edit/delete, drag-drop reorder
- **Course Editor** (`/v3/academy/studio/course/:id`): Multi-step wizard (Details, Content, Settings, Publish)

#### 15.17.4 Course View (`/v3/academy/course/:id`) — `TrainingCourseViewComponent`
- **Sidebar:** Module/lesson tree with progress checkmarks
- **Main:** Lesson content (video player, document viewer, SCORM iframe, quiz)
- **Progress:** Auto-save on lesson complete, certificate on course complete

#### 15.17.5 Analytics (`/v3/academy/analytics`) — `TrainingAnalyticsComponent`
- **Metrics:** Enrollment, completion rate, average score, time spent
- **Charts:** Bar/line charts (Chart.js or similar)

---

### 15.18 Staff Management (`/v3/staff-management`) — ADMIN only

#### Visual Layout
- **User table:** Columns: Name, Email, Role (editable select), Status (Active/Inactive), Actions
- **Create user modal:** Form with role select, sends invite email with temp password
- **Bulk actions:** Activate/Deactivate selected

---

### 15.19 QA Evaluation (`/v3/qa-evaluation`)

#### Visual Layout (from CRM All Cases right panel)
- **Left:** Conversation thread (read-only)
- **Right:** QA panel — Create evaluation form (Score 0-100, Strengths, Improvements, Comment) + List of existing evaluations
- **Evaluation cards:** Score badge, evaluator, agent, strengths/improvements/comment, status (Draft/Submitted/Acknowledged)

---

### 15.20 Adherence Dashboard (`/v3/adherence-dashboard`)

#### Visual Layout
- **Timeline view:** Horizontal timeline per agent with status blocks (Online, Away, Break, Wrapup, Offline)
- **Filters:** Date range, team, agent
- **Summary cards:** Adherence %, productive time, break time, offline time

---

### 15.21 Team Management (`/v3/team-management`)

#### Visual Layout
- **Team cards:** Team name, lead, member count
- **Member assignment:** Drag-drop agents between teams, assign TL/QA per team

---

### 15.22 Escalation Desk (`/v3/escalation-desk`)

#### Visual Layout
- **Queue view:** Escalation tickets grouped by L1/L2
- **Ticket detail:** Similar to CRM but with escalation-specific fields (SLA, escalation reason, handoff notes)

---

### 15.23 Prompt Map Builder (`/v3/prompt-map-builder`) — ADMIN only

#### Visual Layout
- **Canvas editor:** Nodes = prompt profiles, Edges = role-to-prompt mapping
- **Sidebar:** Prompt profile editor (system prompt, model, temperature, max tokens)
- **Visual:** Shows which roles have access to which prompts

---

### 15.24 Calendar (`/v3/calendar`)

#### Visual Layout
- **Orbit calendar:** Month/Week/Day views
- **Events:** Color-coded by type (meeting, training, shift, deadline)
- **Sidebar:** Team member filters, create event modal

---

### 15.25 Channel Access Map (`/v3/channel-access-map`)

---

## Production UX Delivery Notes: Builders and Administration

Retain all builder/admin pages and their existing role intent. Treat administration as security-sensitive: the server performs permission checks for every map/tree/tag/role/channel/staff action and writes an audit event containing actor, tenant, target, before/after summary, request ID, and outcome. The role and channel matrices must render only from the caller's tenant-scoped policy data.

Builder saves validate graph size, node/edge ownership, duplicate/self-loop rules where relevant, and referential integrity in one transaction. Use a document version/ETag for optimistic concurrency and return a conflict rather than silently clobbering another admin's update. Automatic layout and previews run client-side where safe; publishing remains a server-authorized mutation.

Staff creation/invitation uses the identity provider rather than a temporary application password. Password resets use provider workflows. Deactivation revokes active sessions and access promptly. Academy asset UI must not expose direct object keys: show files only after scan completion and request a short-lived, content-disposition-controlled signed URL.

#### Visual Layout
- **Matrix:** Channels × Users with access level (Owner/Admin/Member/None)
- **Bulk edit:** Select users → assign to channels
