# Focal - Backend API Endpoints

> Complete REST API reference for all backend endpoints.

---

## 3. BACKEND API ENDPOINTS

### 3.1 Authentication (`/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/login` | User login, returns JWT + user data | Public |
| GET | `/auth/me` | Get current authenticated user | JWT |
| POST | `/auth/logout` | Logout (client-side token clear) | JWT |

**Login Request:**
```json
{ "email": "user@example.com", "password": "secret" }
```

**Login Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "dob": "1990-01-01",
  "role": "AGENT",
  "status": "ONLINE",
  "timeZone": "Europe/London",
  "hasProfilePhoto": false,
  "profilePhotoUpdatedAt": "2024-01-01T00:00:00"
}
```

### 3.2 User Settings (`/api/settings`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/settings/me` | Get current user settings | JWT |
| PUT | `/api/settings/me/timezone` | Update timezone | JWT |
| PUT | `/api/settings/me/preferences` | Update name, language, notifications | JWT |
| PUT | `/api/settings/me/password` | Change password | JWT |
| GET | `/api/settings/me/jira` | Get Jira integration settings | JWT |
| PUT | `/api/settings/me/jira` | Update Jira settings | JWT |
| GET | `/api/settings/me/profile-photo` | Get profile photo (blob) | JWT |
| POST | `/api/settings/me/profile-photo` | Upload profile photo | JWT |
| DELETE | `/api/settings/me/profile-photo` | Delete profile photo | JWT |
| GET | `/api/settings/users` | List all users (admin) | ADMIN |

### 3.3 Knowledge Base Articles (`/api/kb/articles`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kb/articles` | Get all articles |
| GET | `/api/kb/articles/category/{categoryId}` | Get articles by category |
| GET | `/api/kb/articles/{id}` | Get single article |
| POST | `/api/kb/articles` | Create article (ADMIN/HEAD_CS) |
| PUT | `/api/kb/articles/{id}` | Update article (ADMIN/HEAD_CS) |
| PATCH | `/api/kb/articles/{id}/active` | Toggle active status (ADMIN/HEAD_CS) |
| POST | `/api/kb/articles/{id}/duplicate` | Duplicate article (ADMIN/HEAD_CS) |
| POST | `/api/kb/articles/{id}/feedback` | Submit feedback (Public) |
| POST | `/api/kb/articles/{id}/track-time` | Track reading time (Public) |

### 3.4 Knowledge Base Categories (`/api/kb/categories`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kb/categories` | Get all categories |
| POST | `/api/kb/categories` | Create category (ADMIN/HEAD_CS) |
| PUT | `/api/kb/categories/{id}` | Update category (ADMIN/HEAD_CS) |
| DELETE | `/api/kb/categories/{id}` | Delete category (ADMIN/HEAD_CS) |

### 3.5 KB Map Builder (`/api/kb-map`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kb-map/article/{articleId}` | Get article map (nodes + edges) |
| POST | `/api/kb-map/article/{articleId}/save` | Save article map (ADMIN/HEAD_CS) |
| PUT | `/api/kb-map/article/{articleId}` | Update article map (ADMIN/HEAD_CS) |

**Save Request:**
```json
{
  "articleId": 1,
  "nodes": [
    { "id": 1, "articleId": 1, "title": "Start", "label": "Start", "content": "...", "xPos": 100, "yPos": 100, "isStart": true }
  ],
  "edges": [
    { "id": 1, "articleId": 1, "sourceNodeId": 1, "targetNodeId": 2, "label": "Yes", "displayOrder": 1 }
  ]
}
```

### 3.6 KB Analytics (`/api/kb/analytics`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kb/analytics/totals` | Get aggregate analytics |
| GET | `/api/kb/analytics/articles` | Get per-article analytics |
| GET | `/api/kb/analytics/articles/{id}` | Get single article analytics |
| GET | `/api/kb/analytics/users` | Get per-user analytics |
| GET | `/api/kb/analytics/users/{id}` | Get single user analytics |
| GET | `/api/kb/analytics/sessions` | Get session-based analytics |

### 3.7 Process Assistant / Decision Trees (`/api/pages`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pages` | Get all pages with choices |
| GET | `/api/pages/{id}` | Get single page with choices |
| POST | `/api/pages/tree/save` | Save entire tree (ADMIN/HEAD_CS) |

**Tree Save Request:**
```json
{
  "pages": [
    {
      "id": 1,
      "name": "START",
      "content": "<p>Select issue</p>",
      "tag": "start",
      "prevPageId": null,
      "isStart": true,
      "choices": [
        { "id": 1, "label": "Billing", "targetPageId": 2, "displayOrder": 1 }
      ]
    }
  ]
}
```

### 3.8 CRM / FlowDesk (`/api/crm`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crm/my-playlist/{userId}` | Get user's ticket playlist |
| GET | `/api/crm/open-cases/{userId}` | Get open cases grouped by queue |
| GET | `/api/crm/all-cases` | Get all cases (admin) |
| GET | `/api/crm/tickets/{ticketId}` | Get single ticket |
| PUT | `/api/crm/tickets/{ticketId}` | Update ticket |
| GET | `/api/crm/tickets/{ticketId}/internal-notes` | Get internal notes |
| POST | `/api/crm/tickets/{ticketId}/internal-notes` | Add internal note |
| GET | `/api/crm/queues` | Get queue list |
| GET | `/api/crm/tags` | Get all case tags |
| POST | `/api/crm/tags` | Create case tag (ADMIN/HEAD_CS) |
| PUT | `/api/crm/tags/{id}` | Update case tag |
| DELETE | `/api/crm/tags/{id}` | Delete case tag |

### 3.9 Presence (`/api/presence`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/presence/statuses` | Get allowed statuses |
| GET | `/api/presence/users` | Get all users with status |
| GET | `/api/presence/me` | Get current user status |
| PUT | `/api/presence/me` | Update my status |
| GET | `/api/presence/timeline` | Get status history (all) |
| GET | `/api/presence/timeline?userId={id}` | Get user's status history |

### 3.10 Collaboration (`/api/collaboration`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/collaboration/workspace` | Get full workspace (rooms, users, prefs) |
| GET | `/api/collaboration/channel-access/map` | Get channel access map |
| PUT | `/api/collaboration/channel-access/users/{userId}/replace` | Replace user's channel access (ADMIN) |
| POST | `/api/collaboration/channels` | Create channel |
| PUT | `/api/collaboration/channels/{id}` | Update channel |
| DELETE | `/api/collaboration/channels/{id}` | Archive/Delete channel |
| POST | `/api/collaboration/channels/{id}/members` | Add member to channel |
| DELETE | `/api/collaboration/channels/{id}/members/{userId}` | Remove member |
| POST | `/api/collaboration/direct` | Create/get direct room |
| GET | `/api/collaboration/rooms/{roomId}/messages` | Get messages with cursor pagination |
| POST | `/api/collaboration/rooms/{roomId}/messages` | Send message |
| PUT | `/api/collaboration/messages/{id}` | Edit message |
| DELETE | `/api/collaboration/messages/{id}` | Delete message |
| POST | `/api/collaboration/messages/{id}/reactions` | Add reaction |
| DELETE | `/api/collaboration/messages/{id}/reactions/{emoji}` | Remove reaction |
| PUT | `/api/collaboration/messages/{id}/pin` | Pin/unpin message |
| GET | `/api/collaboration/preferences` | Get user preferences |
| PUT | `/api/collaboration/preferences` | Update preferences |
| POST | `/api/collaboration/typing` | Broadcast typing indicator |
| GET | `/api/collaboration/rooms/{roomId}/linked-articles` | Get linked KB articles |
| POST | `/api/collaboration/rooms/{roomId}/linked-articles` | Link KB article |
| DELETE | `/api/collaboration/rooms/{roomId}/linked-articles/{articleId}` | Unlink KB article |

### 3.11 Staff Management (`/api/staff`) - ADMIN only

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/staff` | List all staff |
| POST | `/api/staff` | Create user |
| PUT | `/api/staff/{id}/role` | Update user role |
| PUT | `/api/staff/{id}/password` | Reset user password |
| PUT | `/api/staff/{id}/deactivate` | Deactivate user |
| PUT | `/api/staff/{id}/activate` | Activate user |

### 3.12 Role Access Control (`/api/access-control`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/access-control` | Get full config (roles, features, links) |
| POST | `/api/access-control/roles` | Create role (ADMIN) |
| PUT | `/api/access-control/roles/{id}` | Update role (ADMIN) |
| DELETE | `/api/access-control/roles/{id}` | Delete role (ADMIN) |
| POST | `/api/access-control/links` | Create role-feature link (ADMIN) |
| DELETE | `/api/access-control/links` | Delete role-feature link (ADMIN) |

### 3.13 Training / Academy (`/api/training`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/training/assets` | List all assets |
| POST | `/api/training/assets` | Upload asset (multipart) |
| GET | `/api/training/assets/{id}` | Download asset |
| DELETE | `/api/training/assets/{id}` | Delete asset |
| GET | `/api/training/courses` | List courses |
| POST | `/api/training/courses` | Create course |
| PUT | `/api/training/courses/{id}` | Update course |
| GET | `/api/training/enrollments` | Get enrollments |
| POST | `/api/training/enrollments` | Enroll user |
| PUT | `/api/training/enrollments/{id}/progress` | Update progress |

### 3.14 QA Evaluation (`/api/qa`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/qa/evaluations` | List evaluations |
| POST | `/api/qa/evaluations` | Create evaluation |
| GET | `/api/qa/evaluations/{id}` | Get evaluation |
| PUT | `/api/qa/evaluations/{id}` | Update evaluation |
| PUT | `/api/qa/evaluations/{id}/acknowledge` | Acknowledge evaluation |

### 3.15 Process Assistant (`/api/process-assistant`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/process-assistant/profiles` | Get prompt profiles |
| POST | `/api/process-assistant/profiles` | Create profile (ADMIN) |
| PUT | `/api/process-assistant/profiles/{id}` | Update profile (ADMIN) |
| GET | `/api/process-assistant/conversations` | List user conversations |
| POST | `/api/process-assistant/conversations` | Create conversation |
| GET | `/api/process-assistant/conversations/{id}` | Get conversation with messages |
| POST | `/api/process-assistant/conversations/{id}/messages` | Send message (calls OpenAI) |

### 3.16 Live Chat / Chat Projects (`/api/crm/chats`, `/api/chat/projects`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/crm/chats/conversations` | List chat conversations |
| GET | `/api/crm/chats/conversations/{id}` | Get conversation with messages |
| POST | `/api/crm/chats/conversations/{id}/messages` | Send reply |
| POST | `/api/crm/chats/widget/config` | Save widget config |
| GET | `/api/crm/chats/widget/config` | Get widget config |
| GET | `/api/crm/chats/oauth/start` | Start OAuth (Meta) |
| GET | `/api/crm/chats/oauth/callback` | OAuth callback |

### 3.17 Case Tag Builder (`/api/case-tags`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/case-tags/tree` | Get full tag tree |
| POST | `/api/case-tags/nodes` | Create node (ADMIN/HEAD_CS) |
| PUT | `/api/case-tags/nodes/{id}` | Update node |
| DELETE | `/api/case-tags/nodes/{id}` | Delete node |
| POST | `/api/case-tags/edges` | Create edge |
| DELETE | `/api/case-tags/edges/{id}` | Delete edge |

### 3.18 Gmail Integration (`/api/gmail`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/gmail/oauth/start` | Start Gmail OAuth |
| GET | `/api/gmail/oauth/callback` | OAuth callback |
| GET | `/api/gmail/accounts` | List connected accounts |
| DELETE | `/api/gmail/accounts/{id}` | Disconnect account |
| POST | `/api/gmail/sync` | Manual sync trigger |

---

## Production API Contract and Security Adaptation

The endpoint catalogue above remains the functional API inventory. Implement it with Next.js Route Handlers and Server Actions, exposing only the browser calls needed by each page. Preserve path semantics during migration where practical; version new incompatible contracts under `/v1`. Every response uses explicit DTOs, never database rows. Errors follow RFC 9457 problem details and do not expose internal errors.

### Mandatory policy for every endpoint

| Concern | Required behaviour |
|---|---|
| Authentication | OIDC session/token validated server-side; public is exceptional and explicitly documented |
| Authorization | Resolve tenant membership, role/feature permission, and resource ownership/room membership server-side |
| Tenant scope | Derive tenant from trusted session/domain mapping, never request payload or URL alone |
| Validation | Strict JSON/schema validation, size limits, allowlists, and output encoding |
| Pagination | Cursor pagination using `(created_at, id)` for chronological collections; capped page size |
| Mutation safety | `Idempotency-Key` required for externally retried creates, claims, sends, and webhook work |
| Rate limit | Cloudflare edge limits plus Redis tenant/user/IP limits; tighter limits for login, AI, uploads, and webhooks |
| Audit | Record sensitive reads/exports and all administrative, authorization, integration, and data-changing events |

### Resource authorization rules

Replace client-provided `{userId}` routes such as playlist/open-cases with `/me` semantics or verify that the requested ID belongs to the authenticated caller and tenant. IDs in all paths must be loaded through a tenant-filtered query before action. Collaboration message edits/deletes require sender or room-admin authority; room access requires membership; ticket visibility requires queue/assignment/role policy; QA data is restricted to permitted evaluators, agents, and managers. UI feature gates are only usability hints, never enforcement.

### Files, webhooks, and third parties

Asset and profile-photo uploads use a two-step initiate/complete flow: validate requested metadata, return a constrained signed S3 URL, then verify object size, type/magic bytes, tenant prefix, malware-scan result, and ownership before marking it available. Do not proxy arbitrary URLs or permit SVG/HTML execution. Gmail, Meta, and Stripe-if-added callbacks use exact allowlisted routes, signature verification before parsing/queueing, replay protection, timestamp tolerance, and durable idempotency records. OAuth callbacks bind a state/PKCE value to the initiating tenant and user.

### Latency objectives

Typical reads should target p95 under 300 ms at the API excluding network; normal mutations p95 under 500 ms. AI generation, syncs, exports, virus scans, and notification fan-out are asynchronous or streamed with bounded timeouts. Return `202 Accepted` and a job/status resource when work is not completed synchronously.
