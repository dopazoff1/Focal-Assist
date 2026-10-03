# Focal - Complete Project Rebuild Documentation

> This document contains all details needed to recreate the exact same project from scratch. It covers backend (Spring Boot), frontend (Angular), database schema, API endpoints, authentication, routing, and all components.

---

## 1. PROJECT OVERVIEW

**Project Name:** Focal Assist  
**Type:** Internal Customer Support & Knowledge Management Platform  
**Architecture:** Full-stack monorepo with Spring Boot backend + Angular frontend (v3 shell)  
**Package Manager:** npm (frontend), Maven (backend)  
**Language:** TypeScript (frontend), Java 17 (backend)  
**Database:** MySQL (JPA/Hibernate)  

### Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | Angular | 21.0.0 |
| Frontend UI | Custom CSS (CSS Variables, Grid/Flex) | - |
| Backend Framework | Spring Boot | 4.0.0 |
| Database | MySQL | 8.0+ |
| ORM | Spring Data JPA / Hibernate | - |
| Auth | JWT (jjwt 0.12.6) | - |
| Build Tools | Angular CLI 21.0.2, Maven | - |
| Testing | Vitest, Playwright | - |
| SSR | Angular SSR (Express) | - |
| Editor | TinyMCE 8.3.2 | - |

---

## 2. DATABASE SCHEMA (JPA Entities)

### 2.1 Core User & Authentication

#### `users` table
```sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,              -- ADMIN, HEAD_CS, OPS, TEAM_LEADER, QA, AGENT
    active BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'OFFLINE',   -- ONLINE, AWAY, WRAPUP, BREAK, OFFLINE
    deactivation_reason TEXT,
    deactivated_at DATETIME,
    time_zone VARCHAR(64),
    ui_language VARCHAR(10),
    desktop_notifications_enabled BOOLEAN DEFAULT TRUE,
    sound_notifications_enabled BOOLEAN DEFAULT TRUE,
    profile_photo_original LONGBLOB,
    profile_photo_light MEDIUMBLOB,
    profile_photo_content_type VARCHAR(100),
    profile_photo_updated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### `user_status_history` table
```sql
CREATE TABLE user_status_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    user_name VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    changed_at DATETIME NOT NULL,
    changed_by_email VARCHAR(255),
    change_source VARCHAR(50),
    note TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 2.2 Knowledge Base

#### `kb_categories` table
```sql
CREATE TABLE kb_categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    display_order INT,
    is_active BOOLEAN DEFAULT TRUE
);
```

#### `kb_articles` table
```sql
CREATE TABLE kb_articles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT,
    display_order INT,
    is_active BOOLEAN DEFAULT TRUE,
    category_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES kb_categories(id)
);
```

#### `kb_map_nodes` table
```sql
CREATE TABLE kb_map_nodes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_id BIGINT NOT NULL,
    title VARCHAR(255),
    label VARCHAR(255),
    content LONGTEXT,
    x_pos INT,
    y_pos INT,
    is_start BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id)
);
```

#### `kb_map_edges` table
```sql
CREATE TABLE kb_map_edges (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_id BIGINT NOT NULL,
    source_node_id BIGINT NOT NULL,
    target_node_id BIGINT NOT NULL,
    label VARCHAR(255),
    display_order INT,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id)
);
```

#### `kb_article_feedback` table
```sql
CREATE TABLE kb_article_feedback (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_id BIGINT NOT NULL,
    sentiment ENUM('LIKE', 'DISLIKE') NOT NULL,
    feedback_text TEXT,
    viewer_name VARCHAR(255),
    viewer_email VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id)
);
```

#### `kb_article_time_tracking` table
```sql
CREATE TABLE kb_article_time_tracking (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_id BIGINT NOT NULL,
    seconds_spent INT NOT NULL,
    session_id VARCHAR(255),
    source VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id)
);
```

### 2.3 Process Assistant / Decision Trees

#### `pages` table
```sql
CREATE TABLE pages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content LONGTEXT,
    tag VARCHAR(255),
    prev_page_id BIGINT,
    is_start BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (prev_page_id) REFERENCES pages(id)
);
```

#### `choices` table
```sql
CREATE TABLE choices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    source_page_id BIGINT NOT NULL,
    target_page_id BIGINT NOT NULL,
    display_order INT,
    FOREIGN KEY (source_page_id) REFERENCES pages(id),
    FOREIGN KEY (target_page_id) REFERENCES pages(id)
);
```

### 2.4 CRM / Ticketing

#### `cem_contacts` table
```sql
CREATE TABLE cem_contacts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    primary_email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### `cem_conversations` table
```sql
CREATE TABLE cem_conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    gmail_thread_id VARCHAR(255) NOT NULL UNIQUE,
    contact_id BIGINT,
    subject VARCHAR(500),
    status VARCHAR(32) DEFAULT 'open',
    priority VARCHAR(32),
    assigned_user_id BIGINT,
    queue_name VARCHAR(255),
    created_by_user_id BIGINT,
    last_message_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES cem_contacts(id),
    FOREIGN KEY (assigned_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

#### `cem_conversation_tags` (join table)
```sql
CREATE TABLE cem_conversation_tags (
    conversation_id BIGINT NOT NULL,
    tag_node_id BIGINT NOT NULL,
    PRIMARY KEY (conversation_id, tag_node_id),
    FOREIGN KEY (conversation_id) REFERENCES cem_conversations(id),
    FOREIGN KEY (tag_node_id) REFERENCES case_tag_nodes(id)
);
```

#### `cem_internal_notes` table
```sql
CREATE TABLE cem_internal_notes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    author_user_id BIGINT NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES cem_conversations(id),
    FOREIGN KEY (author_user_id) REFERENCES users(id)
);
```

### 2.5 Case Tags (Tagging System)

#### `case_tag_nodes` table
```sql
CREATE TABLE case_tag_nodes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7),           -- Hex color
    icon VARCHAR(50),           -- Icon identifier
    parent_id BIGINT,           -- Self-referential for hierarchy
    display_order INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES case_tag_nodes(id)
);
```

#### `case_tag_edges` table
```sql
CREATE TABLE case_tag_edges (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_node_id BIGINT NOT NULL,
    target_node_id BIGINT NOT NULL,
    label VARCHAR(255),
    display_order INT,
    FOREIGN KEY (source_node_id) REFERENCES case_tag_nodes(id),
    FOREIGN KEY (target_node_id) REFERENCES case_tag_nodes(id)
);
```

### 2.6 Collaboration / Chat

#### `collab_rooms` table
```sql
CREATE TABLE collab_rooms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    kind VARCHAR(16) NOT NULL,           -- CHANNEL | DIRECT
    name VARCHAR(140),
    description VARCHAR(800),
    topic VARCHAR(500),
    is_private BOOLEAN DEFAULT FALSE,
    owner_user_id BIGINT NOT NULL,
    archived BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (owner_user_id) REFERENCES users(id)
);
```

#### `collab_room_members` table
```sql
CREATE TABLE collab_room_members (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(32) DEFAULT 'MEMBER',   -- OWNER | ADMIN | MEMBER
    joined_at DATETIME NOT NULL,
    last_read_at DATETIME,
    notification_level VARCHAR(16) DEFAULT 'ALL',  -- ALL | MENTIONS | NONE
    FOREIGN KEY (room_id) REFERENCES collab_rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `collab_messages` table
```sql
CREATE TABLE collab_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    sender_user_id BIGINT NOT NULL,
    kind VARCHAR(16) NOT NULL,           -- USER | SYSTEM
    content LONGTEXT NOT NULL,
    parent_message_id BIGINT,
    pinned BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    edited_at DATETIME,
    FOREIGN KEY (room_id) REFERENCES collab_rooms(id),
    FOREIGN KEY (sender_user_id) REFERENCES users(id),
    FOREIGN KEY (parent_message_id) REFERENCES collab_messages(id)
);
```

#### `collab_message_mentions` table
```sql
CREATE TABLE collab_message_mentions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    mentioned_user_id BIGINT NOT NULL,
    FOREIGN KEY (message_id) REFERENCES collab_messages(id),
    FOREIGN KEY (mentioned_user_id) REFERENCES users(id)
);
```

#### `collab_message_articles` table
```sql
CREATE TABLE collab_message_articles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    message_id BIGINT NOT NULL,
    article_id BIGINT NOT NULL,
    FOREIGN KEY (message_id) REFERENCES collab_messages(id),
    FOREIGN KEY (article_id) REFERENCES kb_articles(id)
);
```

### 2.7 Training / Academy

#### `training_assets` table
```sql
CREATE TABLE training_assets (
    id VARCHAR(64) PRIMARY KEY,          -- UUID
    kind VARCHAR(16) NOT NULL,           -- video, document, scorm, etc.
    filename VARCHAR(512) NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL,
    data_blob LONGBLOB NOT NULL,
    uploaded_by_user_id BIGINT,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
);
```

### 2.8 QA Evaluation

#### `qa_evaluations` table
```sql
CREATE TABLE qa_evaluations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    evaluator_user_id BIGINT NOT NULL,
    agent_user_id BIGINT NOT NULL,
    score DECIMAL(5,2),
    max_score DECIMAL(5,2),
    status VARCHAR(32),                  -- DRAFT, SUBMITTED, ACKNOWLEDGED
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES cem_conversations(id),
    FOREIGN KEY (evaluator_user_id) REFERENCES users(id),
    FOREIGN KEY (agent_user_id) REFERENCES users(id)
);
```

### 2.9 Process Assistant (AI Chat)

#### `process_assistant_prompt_profiles` table
```sql
CREATE TABLE process_assistant_prompt_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    system_prompt LONGTEXT NOT NULL,
    model_name VARCHAR(100) DEFAULT 'gpt-4o-mini',
    temperature DECIMAL(3,2) DEFAULT 0.3,
    max_tokens INT DEFAULT 2000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### `process_assistant_conversations` table
```sql
CREATE TABLE process_assistant_conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    prompt_profile_id BIGINT,
    title VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (prompt_profile_id) REFERENCES process_assistant_prompt_profiles(id)
);
```

#### `process_assistant_messages` table
```sql
CREATE TABLE process_assistant_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    role VARCHAR(16) NOT NULL,           -- user | assistant | system
    content LONGTEXT NOT NULL,
    tokens_used INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES process_assistant_conversations(id)
);
```

### 2.10 Live Chat / Chat Projects

#### `chat_widget_configs` table
```sql
CREATE TABLE chat_widget_configs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    welcome_message TEXT,
    primary_color VARCHAR(7),
    position VARCHAR(16) DEFAULT 'bottom-right',
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### `chat_conversations` table
```sql
CREATE TABLE crm_chat_conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    channel_type VARCHAR(32) NOT NULL,   -- widget, messenger, instagram, whatsapp
    external_thread_id VARCHAR(255),
    customer_name VARCHAR(255) NOT NULL,
    customer_handle VARCHAR(255) NOT NULL,
    status VARCHAR(32) DEFAULT 'open',
    assigned_user_id BIGINT,
    unread_count INT DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    last_message_at DATETIME NOT NULL,
    FOREIGN KEY (assigned_user_id) REFERENCES users(id)
);
```

#### `chat_messages` table
```sql
CREATE TABLE chat_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender_type VARCHAR(16) NOT NULL,    -- customer | agent | system
    sender_id BIGINT,
    content LONGTEXT NOT NULL,
    message_type VARCHAR(16) DEFAULT 'text',
    metadata JSON,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES crm_chat_conversations(id)
);
```

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

---

## 6. FRONTEND COMPONENT INVENTORY (V3 Shell)

### 6.1 Shell & Layout
- **V3ShellComponent** - Main layout, sidebar, header, user menu
- **V3HomeComponent** - Dashboard with feature-gated cards

### 6.2 Feature Components (Lazy Loaded)
| Component | Route | Feature Flag | Description |
|-----------|-------|--------------|-------------|
| CalendarComponent | `/v3/calendar` | calendar | Orbit calendar view |
| MagicAssistanceComponent | `/v3/magic-assistance` | magic_assistance | Decision tree wizard |
| KnowledgeBaseComponent | `/v3/knowledge-base` | knowledge_base | KB articles + map view |
| KbAnalyticsDashboardComponent | `/v3/kb-analytics` | knowledge_analytics | Reading time analytics |
| CollaborationHubComponent | `/v3/collaboration` | collaboration | Slack-like chat |
| ChatProjectsComponent | `/v3/chat-projects` | chat_projects | Multi-channel chat config |
| LiveChatComponent | `/v3/live-chat` | live_chat | Customer chat widget |
| ProcessAssistantComponent | `/v3/process-assistant` | process_assistant | AI chat (OpenAI) |
| CrmComponent | `/v3/crm` | flowdesk | Ticket queue management |
| TrainingHomeComponent | `/v3/academy` | academy_home | Course dashboard |
| TrainingCatalogComponent | `/v3/academy/catalog` | academy_catalog | Course browser |
| TrainingStudioComponent | `/v3/academy/studio` | academy_studio | Course builder |
| StaffManagementComponent | `/v3/staff-management` | staff_management | User CRUD (ADMIN) |
| TreeBuilderComponent | `/v3/tree-builder` | builders | Decision tree editor |
| KbMapBuilderComponent | `/v3/kb-map-builder` | builders | KB flow map editor |
| CaseTagBuilderComponent | `/v3/case-tag-builder` | builders | Tag hierarchy editor |
| PromptMapBuilderComponent | `/v3/prompt-map-builder` | prompt_map_builder | AI prompt flow editor |
| ArticleManagementComponent | `/v3/article-management` | article_management | KB article CRUD |
| ArticleEditorComponent | `/v3/article-management/edit/:id` | article_management | TinyMCE editor |
| RoleAccessMapComponent | `/v3/role-access-map` | role_access_map | RBAC matrix editor |
| UserSettingsComponent | `/v3/settings` | user_settings | Profile, preferences |
| AdherenceDashboardComponent | `/v3/adherence-dashboard` | adherence | Schedule adherence |
| QaEvaluationComponent | `/v3/qa-evaluation` | qa_evaluation | Quality scoring |
| TeamManagementComponent | `/v3/team-management` | team_management | Team configuration |
| EscalationDeskComponent | `/v3/escalation-desk` | escalation_desk | Escalation handling |

### 6.3 Shared UI Components
- **HeaderComponent** - Top bar with user menu, notifications, search
- **I18nPipe** - Translation pipe `{{ 'key' | t }}`

---

## 7. KEY FRONTEND PATTERNS

### 7.1 Feature-Gated Rendering
```typescript
// In component
get canUseFeature(): boolean {
  return this.accessControl.hasFeatureAccess(this.auth.getNormalizedRole(), 'feature_key');
}

// In template
<div *ngIf="canUseFeature">...</div>
<a routerLink="/v3/feature" *ngIf="canUseFeature">...</a>
```

### 7.2 Service Injection Pattern
```typescript
constructor(
  public auth: AuthService,           // public for template access
  private kbService: KbService,
  private accessControl: AccessControlService
) {}
```

### 7.3 Reactive Data Loading
```typescript
ngOnInit() {
  this.loadData();
}

loadData() {
  this.loading = true;
  this.service.getData().pipe(
    finalize(() => this.loading = false)
  ).subscribe({
    next: (data) => this.data = data,
    error: (err) => this.error = err.message
  });
}
```

### 7.4 Real-time Updates (Collaboration)
- WebSocket via `CollaborationService` using `interval` polling
- Typing indicators with debounced broadcast
- Message delivery states (SENT/SEEN)

---

## 8. BUILD & DEPLOYMENT

### 8.1 Frontend Build Commands
```bash
# Development
npm run start:dev        # ng serve --configuration development --proxy-config proxy.conf.json

# Production build
npm run build:prod       # ng build --configuration production

# Production serve (SSR)
npm run serve:ssr:focal-assist  # node dist/focal-assist/server/server.mjs
```

### 8.2 Backend Build Commands
```bash
# Build
./mvnw clean package

# Run
./mvnw spring-boot:run
# Or
java -jar target/api-0.0.1-SNAPSHOT.jar
```

### 8.3 Environment Variables

**Backend (application.properties with env override):**
```properties
SERVER_PORT=8080
SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3306/focal_db
SPRING_DATASOURCE_USERNAME=root
SPRING_DATASOURCE_PASSWORD=secret
SPRING_JPA_HIBERNATE_DDL_AUTO=update
APP_PUBLIC_BASE_URL=http://localhost:8080
SECURITY_JWT_SECRET=your-super-secret-key-min-32-chars
SECURITY_JWT_EXPIRATION_SECONDS=43200
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
OPENAI_API_KEY=
CHAT_META_APP_ID=
CHAT_META_VERIFY_TOKEN=focal-meta-verify-token
```

**Frontend (proxy.conf.json):**
```json
{
  "/api": { "target": "http://localhost:8080", "secure": false },
  "/auth": { "target": "http://localhost:8080", "secure": false }
}
```

### 8.4 Database Setup
```sql
CREATE DATABASE focal_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Tables auto-created by Hibernate (ddl-auto=update)
-- Or run migrations manually for production
```

---

## 9. STEP-BY-STEP REBUILD GUIDE

### Phase 1: Backend Setup
1. Create Spring Boot project (Java 17, Spring Boot 4.0.0)
2. Add dependencies: Web, Security, Data JPA, MySQL, WebSocket, Validation
3. Add jjwt (0.12.6) for JWT
4. Configure `application.properties` with MySQL + JWT secret
5. Create all JPA entities (Section 2)
6. Create repositories extending `JpaRepository`
7. Create services with `@Transactional` methods
8. Create controllers with `@RestController`, `@CrossOrigin`
9. Implement `JwtService`, `UserDetailsService`, SecurityConfig
10. Test API endpoints with Postman/curl

### Phase 2: Frontend Setup
1. Create Angular 21 project: `ng new focal-assist --standalone --ssr --style=css`
2. Install deps: `@tinymce/tinymce-angular`, `tinymce`, `rxjs`, `zone.js`
3. Configure `app.config.ts` with router, HTTP interceptors, locale
4. Create `AuthService`, `AccessControlService` first (core dependencies)
5. Build `V3ShellComponent` with sidebar navigation
6. Create `V3HomeComponent` dashboard
7. Implement lazy-loaded feature components per routing table
8. Create all services (KbService, PageService, CollaborationService, etc.)
9. Add i18n pipe and translation files
10. Style with CSS variables matching design system

### Phase 3: Integration
1. Configure proxy.conf.json for development
2. Test login flow end-to-end
3. Verify role-based navigation rendering
4. Test all CRUD operations
5. Configure CORS on backend for frontend origin
6. Build production bundles
7. Deploy backend (JAR) + frontend (static + SSR)

---

## 10. CRITICAL IMPLEMENTATION NOTES

### 10.1 V3 Shell Specifics
- **Only V3 Shell** is the active shell (v4, v5 exist but redirect to v3)
- All routes under `/v3/` use `V3ShellComponent` as parent
- Sidebar state persisted via service (open/closed)
- Mobile-first responsive breakpoint at 1024px

### 10.2 Access Control Implementation
- `AccessControlService` loads config from `/api/access-control` on init
- Falls back to `FEATURE_CATALOG` + `FALLBACK_FEATURE_MAP` if API fails
- `RoleGuard` evaluates both `roles[]` and `feature` from route data
- Feature keys must match exactly (snake_case)

### 10.3 KB Map Builder Canvas
- Custom drag-and-drop implementation (no external lib)
- Pan/zoom with mouse wheel + drag
- Wire drawing between choice buttons and target nodes
- Local state → API save on explicit "Save" action

### 10.4 TinyMCE Integration
- Used in `ArticleEditorComponent` and `TrainingCourseEditorComponent`
- Configured with custom plugins, toolbar, content CSS
- Images handled via custom upload handler to backend

### 10.5 Real-time Features
- Collaboration: Polling-based (interval) for messages, typing, presence
- Presence: Manual status updates + timeline history
- Notifications: In-app only (no push service implemented)

### 10.6 Internationalization
- `I18nService` loads JSON translation files
- Supported locales: en, lt, lv, et
- `I18nPipe` used in templates: `{{ 'key' | t }}`
- Locale stored in localStorage, defaults to browser language

---

## 11. FILE STRUCTURE REFERENCE

### Backend
```
backend/
├── src/main/java/com/crdpls/api/
│   ├── FocalAssistApplication.java
│   ├── controllers/          # 20+ REST controllers
│   ├── dto/                  # Request/Response DTOs
│   ├── models/               # 25+ JPA entities
│   ├── repository/           # Spring Data JPA repositories
│   ├── service/              # Business logic services
│   └── security/             # JwtService, SecurityConfig
└── src/main/resources/
    └── application.properties
```

### Frontend
```
frontend/
├── src/
│   ├── app/
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   ├── auth.guard.ts
│   │   ├── role.guard.ts
│   │   ├── login.guard.ts
│   │   ├── components/
│   │   │   ├── v3-shell/
│   │   │   ├── v3-home/
│   │   │   ├── knowledge-base/
│   │   │   ├── magic-assistance/
│   │   │   ├── kb-map-builder/
│   │   │   ├── case-tag-builder/
│   │   │   ├── article-management/
│   │   │   ├── collaboration-hub/
│   │   │   ├── crm/
│   │   │   ├── process-assistant/
│   │   │   ├── live-chat/
│   │   │   ├── chat-projects/
│   │   │   ├── training-*/
│   │   │   ├── staff-management/
│   │   │   ├── tree-builder/
│   │   │   ├── qa-evaluation/
│   │   │   ├── adherence-dashboard/
│   │   │   ├── team-management/
│   │   │   ├── escalation-desk/
│   │   │   ├── role-access-map/
│   │   │   ├── user-settings/
│   │   │   ├── header/
│   │   │   └── calendar/
│   │   ├── services/
│   │   │   ├── auth.ts
│   │   │   ├── kb.ts
│   │   │   ├── page.ts
│   │   │   ├── settings.ts
│   │   │   ├── presence.ts
│   │   │   ├── collaboration.ts
│   │   │   ├── access-control.ts
│   │   │   └── i18n.ts
│   │   ├── interceptors/
│   │   │   └── auth-interceptor.ts
│   │   ├── pipes/
│   │   │   └── i18n.pipe.ts
│   │   └── utils/
│   │       └── locale.ts
│   ├── index.html
│   ├── main.ts
│   └── main.server.ts
├── angular.json
├── package.json
├── proxy.conf.json
└── tsconfig.json
```

---

## 12. TESTING CHECKLIST

### Backend
- [ ] All controllers return correct HTTP codes
- [ ] JWT authentication works on protected endpoints
- [ ] Role-based authorization enforced
- [ ] JPA relationships load correctly (no N+1)
- [ ] Transactions rollback on errors
- [ ] File uploads (profile photo, training assets) work

### Frontend
- [ ] Login → redirect to `/v3/home`
- [ ] Sidebar navigation works for all roles
- [ ] Feature-gated routes redirect unauthorized users to `/v3/home`
- [ ] KB article view + map toggle works
- [ ] Magic Assistance decision tree flows correctly
- [ ] CRM ticket list + detail view works
- [ ] Collaboration: channels, DMs, messages, reactions
- [ ] Process Assistant: chat with OpenAI integration
- [ ] Settings: profile, timezone, password, Jira
- [ ] Admin: Staff management, RBAC matrix, builders
- [ ] Responsive: mobile sidebar drawer
- [ ] i18n: language switcher updates UI text

---

## 13. KNOWN LIMITATIONS / TODO

1. **WebSocket**: Collaboration uses polling, not true WebSockets
2. **Push Notifications**: Desktop notifications only (no service worker push)
3. **File Storage**: Profile photos & training assets stored in DB (BLOB) - consider S3 for production
4. **Search**: No full-text search implementation (uses simple LIKE queries)
5. **Audit Log**: Limited to status history, no comprehensive audit trail
6. **Rate Limiting**: Not implemented on API endpoints
7. **Tests**: Unit/integration tests minimal - needs expansion

---

## 14. QUICK REFERENCE: KEY COMMANDS

```bash
# Frontend
cd frontend
npm install
npm run start:dev          # Dev server at localhost:4200
npm run build:prod         # Production build in dist/
npm run serve:ssr:focal-assist  # SSR server

# Backend
cd backend
./mvnw clean compile
./mvnw spring-boot:run     # API at localhost:8080
./mvnw test                # Run tests

# Database
mysql -u root -p -e "CREATE DATABASE focal_db;"
```

---

*Document generated from source code analysis. All code paths, models, endpoints, and UI components documented as of the current codebase state.*

---

## 15. DETAILED PAGE UI/UX DESCRIPTIONS

This section provides pixel-perfect visual descriptions, interaction patterns, component inventories, and user flows for every page in the V3 Shell. Each page is documented with its exact layout structure, visual hierarchy, states, and responsive behaviors.

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

---

### 15.6 Collaboration Hub (`/v3/collaboration`)

**File:** `frontend/src/app/components/collaboration-hub/collaboration-hub.html`

#### Visual Layout Structure
- **Three-pane layout (desktop):** 320px left (rooms) + flexible center (chat) + 320px right (room details) — *right pane only for channel admins*
- **Left pane:** Header → Create Channel/DM buttons → Filter input → Room list (Channels, DMs, Saved/Mentions)
- **Center pane:** Room header → Search → Message stream (virtualized) → Composer
- **Right pane:** Room control, topic editor, member management, KB links, pinned messages, mentions, online users

#### Component Inventory

| Component | Visual Spec |
|-----------|-------------|
| **Left Header** | "Collaboration" kicker + "focal Channels" title + "Ultra Dev Mode" badge |
| **Create Buttons** | "+ Channel" (primary), "+ Direct" (ghost), toggle visibility |
| **Channel Create Form** | Name, description, topic, private checkbox, member multi-select chips |
| **DM Create** | User dropdown → "Open Direct Chat" |
| **Room Filter** | Search input, filters both channels + DMs |
| **Room Item** | 56px height: #name (+ lock icon if private), topic/description, unread badge, star toggle |
| **Room Groups** | Section headers: "Channels", "Direct Messages", "Saved / Mentions" (mini rows) |
| **Center Header** | Room title, topic/description, Star/Mute toggles |
| **Message Stream** | Virtualized list, date dividers, "New messages" divider |
| **Message Card** | Own: right-aligned, brand bg; Other: left-aligned, gray bg; System: centered, muted |
| **Message Header** | Sender name + @handle + status chip (colored dot), timestamp, edited badge |
| **Message Actions** | Pin, Save, Edit (own), Delete (own) — hover-revealed |
| **Message Content** | `[innerHTML]` with mention highlighting |
| **Article Links** | Chips with article title, click → opens KB in new tab |
| **Reactions** | Emoji pills with count, click to toggle, palette for adding |
| **Delivery State** | "Sent" / "Seen" (DMs only) |
| **Thread Summary** | "N replies • Open thread" button (channels only) |
| **Thread Panel** | Slides in from right, root message + replies |
| **Composer** | Mention buttons (@handles), KB article tagger dropdown, textarea (4 rows), typing indicator, Send |
| **Right: Room Control** | Type, member count, pinned count, topic editor (channels) |
| **Right: Members** | Badge chips, invite dropdown + button (admins only) |
| **Right: KB Links** | Article dropdown + "Link" button, linked articles list with unlink |
| **Right: Pinned** | Mini message cards with unpin |
| **Right: Mentions** | Mini message cards (mentions of current user) |
| **Right: Online Team** | List with status dot (green/offline), name, role |

#### Interaction Patterns
- **Room select:** Click room item → loads messages via `CollaborationService.getMessages(roomId)`
- **Create channel:** Toggle form → fill → POST `/api/collaboration/channels` → appears in list
- **Create DM:** Select user → POST `/api/collaboration/direct` → opens room
- **Send message:** Enter (Shift+Enter for newline) → POST `/api/collaboration/rooms/{id}/messages`
- **Edit message:** Click "Edit" → textarea replaces content → Save/Cancel
- **Reactions:** Click emoji → POST `/api/collaboration/messages/{id}/reactions`
- **Pin/Unpin:** Click pin icon → PUT `/api/collaboration/messages/{id}/pin`
- **Save/Unsave:** Click save icon → adds to saved messages list
- **Thread:** Click "Open thread" → loads replies → thread panel slides in
- **Mentions:** Type @ → mention buttons appear → click inserts `@handle `
- **KB tagging:** Dropdown select → adds article chip to composer → sends with message
- **Topic edit:** Channel only → input + save → PUT `/api/collaboration/channels/{id}`
- **Invite members:** Channel only → dropdown + invite → POST `/api/collaboration/channels/{id}/members`
- **Star room:** Click star → toggles `starredRooms` set → persists to localStorage
- **Mute room:** Click mute → toggles `mutedRooms` set → suppresses notifications

#### Real-time Updates (Polling-based)
- **Messages:** `CollaborationService` polls `/api/collaboration/rooms/{id}/messages` every 3s
- **Typing:** Debounced broadcast via POST `/api/collaboration/typing` → shows "X is typing..."
- **Presence:** Polls `/api/presence/users` every 10s → updates status dots
- **Unread counts:** Computed client-side from `last_read_at` vs message timestamps

#### Visual States
| State | Description |
|-------|-------------|
| **Loading workspace** | Centered spinner "Loading collaboration workspace..." |
| **Error** | Red state box with error message, retry button |
| **Empty room** | "No messages yet. Start the conversation!" |
| **Thread open** | Right panel slides over (320px), backdrop on mobile |
| **Composing** | Typing indicator shows other users' typing status |

#### Responsive Behavior
- **< 1200px:** Right pane collapses to bottom sheet (slide up)
- **< 900px:** Left pane becomes drawer (same as shell sidebar)
- **< 640px:** Message cards stack vertically, composer textarea full-width, mention buttons scroll horizontally

---

### 15.7 Process Assistant (`/v3/process-assistant`)

**File:** `frontend/src/app/components/process-assistant/process-assistant.html`

#### Visual Layout Structure
- **Three-pane layout:** 300px left (history) + flexible center (chat) + 300px right (prompt details)
- **Left:** Header with "New chat" button → Prompt profile dropdown → Conversation list
- **Center:** Chat header → Message stream → Composer
- **Right:** Selected prompt profile details (system prompt, model params)

#### Component Inventory

| Component | Visual Spec |
|-----------|-------------|
| **History Header** | "Process Copilot" title + "New chat" primary button |
| **Role Badge** | Muted text "Role: {normalizedRole}" |
| **Prompt Profile Dropdown** | Select with profile names, change → loads new conversation context |
| **Conversation List** | Items: title (bold), last message preview (muted), timestamp, delete icon (hover) |
| **Empty State** | "No conversations yet." centered |
| **Chat Header** | Conversation title + current prompt profile name |
| **Message Bubbles** | User: right, brand bg, white text; Assistant: left, gray bg; System: centered, muted |
| **Message Header** | Role label ("You" / "Focal Copilot") + timestamp |
| **Thinking State** | Assistant bubble with "Thinking" + animated 3-dot pulse |
| **Composer** | Textarea (4 rows), placeholder hint, "Enter to send, Shift+Enter for newline", Send button |
| **Right Panel** | Prompt name, model/temp/tokens, full system prompt in `<pre>` (monospace, scrollable) |

#### Interaction Patterns
- **New conversation:** Click "New chat" → POST `/api/process-assistant/conversations` → selects new
- **Select conversation:** Click list item → GET `/api/process-assistant/conversations/{id}` → loads messages
- **Switch prompt profile:** Dropdown change → creates new conversation with that profile
- **Send message:** Enter → POST `/api/process-assistant/conversations/{id}/messages` → shows thinking → streams response
- **Delete conversation:** Click delete icon → DELETE → removes from list
- **Keyboard:** Enter = send, Shift+Enter = newline, Escape = clear draft

#### Visual States
| State | Description |
|-------|-------------|
| **Loading conversations** | Spinner in history list |
| **Loading messages** | "Loading conversation..." centered in chat |
| **Sending** | Thinking animation in new assistant bubble, composer disabled |
| **Error** | Red error message in right panel, toast notification |
| **Empty conversation** | "No messages yet. Ask anything about process..." |

#### Data Flow
- `promptProfiles` loaded on init from `/api/process-assistant/profiles`
- `conversations` loaded on init from `/api/process-assistant/conversations`
- Messages loaded per conversation
- OpenAI calls proxied through backend (API key never exposed to frontend)

---

### 15.8 Live Chat (`/v3/live-chat`)

**File:** `frontend/src/app/components/live-chat/live-chat.html`

#### Visual Layout Structure
- **Two-pane layout:** Flexible main (conversation) + 320px right sidebar (queue)
- **Main (conversation):** Header (project/queue, customer name/email, status badge + close) → Message thread → Composer
- **Sidebar:** Header with "Play" button (claim next) → Project/Status filters → Session list cards

#### Component Inventory

| Component | Visual Spec |
|-----------|-------------|
| **Conversation Header** | Project/queue line, customer name H1, email small, status badge (colored), Close button |
| **Message Bubbles** | Customer: left, gray bg; Agent: right, brand bg; Bot: left, purple bg; System: centered, muted |
| **Message Meta** | Sender name + timestamp |
| **Composer** | Textarea + Send button (Ctrl+Enter shortcut) |
| **Sidebar Header** | "Realtime queue" kicker + "Assigned chats" title + "Play" button (primary, large) |
| **Filters** | Project dropdown + Status dropdown (Waiting/Assigned/Bot/Closed) |
| **Session Cards** | Unread badge (red), customer name, project-queue, last message preview, status text |
| **Empty State** | "Select a conversation or press Play to claim the oldest waiting customer chat" + Play button |
| **Loading** | 3-dot spinner cards in session list |

#### Interaction Patterns
- **Claim next (Play):** POST `/api/crm/chats/conversations/claim` → assigns oldest waiting → opens conversation
- **Select session:** Click session card → loads messages → marks read
- **Send reply:** Ctrl+Enter or Send button → POST `/api/crm/chats/conversations/{id}/messages`
- **Filter change:** Dropdown change → reloads session list with filters
- **Close conversation:** Click Close → updates status → returns to queue view
- **Auto-refresh:** Polls sessions every 5s when queue view active

#### Visual States
| State | Description |
|-------|-------------|
| **No conversation** | Empty state with large Play button |
| **Loading sessions** | Skeleton cards (3-dot pulse) |
| **Sending** | Send button disabled, "Sending..." text |
| **Unread indicator** | Red badge on session card with count |

---

### 15.9 Chat Projects (`/v3/chat-projects`)

**File:** `frontend/src/app/components/chat-projects/chat-projects.ts` (component not fully read, inferred from routes)

#### Visual Layout Structure
- **Project list view:** Card grid of chat projects
- **Project detail:** Tabs for Configuration, Workflows, Queues, API Credentials, Analytics
- **Widget Config:** Visual builder for chat widget (colors, position, welcome message, branding)

#### Key Features (from API)
- Multi-project management
- OAuth for Meta (Instagram/WhatsApp)
- Widget configuration with live preview
- Queue management per project
- API credentials per project

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

#### Visual Layout
- **Matrix:** Channels × Users with access level (Owner/Admin/Member/None)
- **Bulk edit:** Select users → assign to channels

---

### 15.26 Login Page (`/login`)

**File:** `frontend/src/app/components/login/login.html` (inferred)

#### Visual Layout Structure
- **Centered card** (400px max-width) on branded background
- **Form:** Email input, Password input, Remember me, Submit button
- **Branding:** "Focal" logo + tagline
- **Links:** "Forgot password?" (not implemented), version footer

#### Interaction Patterns
- **Submit:** POST `/auth/login` → on success: store token+user in localStorage → redirect to `/v3/home`
- **Error:** Inline error below form ("Invalid credentials")
- **Loading:** Button "Signing in..." with spinner
- **Enter key:** Submits form

---

### 15.27 404 / Not Found (`/v3/404`)

#### Visual Layout
- **Centered:** Large "404" (6rem), "Page not found", "Return to Command Center" button → `/v3/home`

---

### 15.28 Article Not Found (`/v3/article-not-found`)

#### Visual Layout
- **Centered:** "Article not found", "The article you're looking for doesn't exist or has been removed", "Browse Knowledge Base" button → `/v3/knowledge-base`

---

### 15.29 Global UI Patterns & Design System

#### CSS Variables (from shell/styles)
```css
:root {
  --brand: #0f62fe;           /* Primary blue */
  --brand-hover: #0043ce;
  --text-1: #111827;          /* Primary text */
  --text-2: #374151;          /* Secondary text */
  --text-muted: #6b7280;      /* Muted text */
  --panel-1: #ffffff;         /* Card background */
  --panel-2: #f5f7fb;         /* Subtle background */
  --panel-border: #d1d5db;    /* Border color */
  --focus-ring: 0 0 0 3px rgba(15,98,254,0.3);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 2px rgba(15,23,42,0.05);
  --shadow-md: 0 4px 12px rgba(15,23,42,0.1);
  --shadow-lg: 0 12px 28px rgba(15,23,42,0.15);
  --transition: 150ms ease;
}
```

#### Typography Scale
| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Hero Title | 2.5rem | 700 | 1.2 |
| Page Title | 1.75rem | 600 | 1.3 |
| Section Header | 1.125rem | 600 | 1.4 |
| Body | 0.9375rem | 400 | 1.5 |
| Small/Muted | 0.8125rem | 400 | 1.4 |
| Micro/Kicker | 0.75rem | 700 | 1.2 | (uppercase, letter-spacing 0.08em)

#### Spacing Scale (4px base)
| Token | Value |
|-------|-------|
| space-1 | 4px |
| space-2 | 8px |
| space-3 | 12px |
| space-4 | 16px |
| space-5 | 20px |
| space-6 | 24px |
| space-8 | 32px |
| space-10 | 40px |
| space-12 | 48px |

#### Button Variants
| Variant | Background | Text | Border | Hover |
|---------|------------|------|--------|-------|
| **Primary** | var(--brand) | white | none | var(--brand-hover) |
| **Ghost** | transparent | var(--text-1) | var(--panel-border) | var(--panel-2) |
| **Danger** | transparent | #b42318 | #b42318/45% | #fef2f2 bg |
| **Icon** | transparent | var(--text-muted) | none | var(--panel-2) + color: var(--text-1) |

#### Badge Variants
| Variant | Background | Text | Border |
|---------|------------|------|--------|
| **Default** | var(--panel-2) | var(--text-2) | var(--panel-border) |
| **Success** | #dcfce7 | #166534 | #86efac |
| **Warning** | #fef9c3 | #854d0e | #fde047 |
| **Error** | #fef2f2 | #991b1b | #fecaca |
| **Case Tag** | brand/14% | #1f2937 | brand/38% |
| **Unread** | var(--brand) | white | none |

#### Form Input Styles
- **Height:** 40px (standard), 48px (large)
- **Padding:** 0 12px (standard), 0 16px (large)
- **Border:** 1px solid var(--panel-border)
- **Border-radius:** var(--radius-md)
- **Focus:** outline-none + var(--focus-ring)
- **Disabled:** bg var(--panel-2), text var(--text-muted), cursor not-allowed
- **Error state:** border #ef4444, focus-ring rgba(239,68,68,0.3)

#### Animation Standards
- **Transition:** 150ms ease (color, bg, border, transform, opacity)
- **Staggered entrance:** `--delay` CSS var on list items (e.g., KB articles: 36ms per item)
- **Modal/Overlay:** fade-in 150ms + scale(0.95→1) 150ms
- **Drawer/Slide:** transform translateX(100%→0) 200ms ease-out
- **Toast:** slide-in from right 200ms, slide-out 150ms
- **Loading spinners:** 1s linear infinite rotation

#### Accessibility
- **Focus visible:** All interactive elements have :focus-visible ring
- **ARIA labels:** Icon-only buttons have aria-label
- **Live regions:** Loading states, typing indicators, toasts use aria-live="polite"
- **Semantic HTML:** <nav>, <main>, <aside>, <section>, <article>, <header>, <footer>
- **Keyboard:** All interactions keyboard-accessible (Tab, Enter, Escape, Arrow keys)
- **Color contrast:** Meets WCAG AA (4.5:1 for text, 3:1 for UI elements)

---

### 15.30 User Flows (Key Journeys)

#### Flow 1: Agent Handling a Ticket (CRM My Playlist)
1. **Login** → lands on `/v3/home`
2. **Click "CRM Inbox" card** → `/v3/crm` (My Playlist auto-selected)
3. **Oldest ticket auto-loaded** → Summary card shows details
4. **Read thread** → scroll through messages (customer/agent/internal)
5. **Compose reply** → Toggle "Email" mode → Rich text editor → Format text
6. **Add tags** → Click "Choose" → Tag picker → Select hierarchical tags
7. **Set status** → Dropdown: open/pending/resolved/closed
8. **Click "Next"** → POST reply + update ticket → Auto-loads next ticket
9. **Repeat** until playlist empty → "No ticket selected" state

#### Flow 2: Creating a KB Article with Map
1. **Navigate** → `/v3/article-management` (ADMIN/HEAD_CS only)
2. **Fill create form** → Category, Title, Content (HTML), Display order → Create
3. **Click "Edit"** on new article → `/v3/article-management/edit/:id`
4. **Write content** in TinyMCE → Save
5. **Navigate** → `/v3/kb-map-builder`
6. **Select article** from dropdown → Loads existing map (empty)
7. **Add nodes** → Position on canvas → Edit title/content per node
8. **Add choices** → Wire choices to target nodes via drag-from-wire-button
9. **Mark start node** → "Mark As Start Node"
10. **Auto-layout** → Optional hierarchical arrangement
11. **Save to DB** → POST `/api/kb-map/article/{id}/save`
12. **Verify** → `/v3/knowledge-base` → Select article → Click "Map / SOP" → Test navigation

#### Flow 3: Collaboration - Channel Discussion with KB Link
1. **Navigate** → `/v3/collaboration`
2. **Select channel** from left pane (or create new)
3. **Type message** → Click KB article dropdown → Select article → Chip added to composer
4. **Add mention** → Click @handle button → Inserts `@handle `
5. **Send** → Enter → Message appears with article chip + mention
6. **Teammate sees** → Unread badge on channel, toast if mentioned
7. **Click article chip** → Opens KB in new tab with article pre-selected
8. **Pin message** → Hover message → Click pin → Appears in right panel "Pinned Messages"
9. **React** → Click emoji palette → Adds reaction to message

#### Flow 4: Process Assistant - AI Guided Troubleshooting
1. **Navigate** → `/v3/process-assistant`
2. **Select prompt profile** (e.g., "Billing Troubleshooting") from dropdown
3. **Click "New chat"** → Creates conversation with that system prompt
4. **Type question** → "Customer says payment failed but card is valid"
5. **Send** → Shows "Thinking..." animation → Streams response from OpenAI
6. **Follow up** → "What if it's a 3D Secure issue?" → Contextual response
7. **Switch profile** → Dropdown change → New conversation with different expertise
8. **History** → Left panel shows all conversations, click to resume

#### Flow 5: Live Chat - Claim and Handle Customer Chat
1. **Navigate** → `/v3/live-chat`
2. **Click "Play"** → Claims oldest WAITING_FOR_AGENT chat
3. **Conversation opens** → Customer messages on left, agent replies on right
4. **Reply** → Type in composer → Ctrl+Enter → Sends to customer
5. **Transfer/Close** → Status dropdown → Close or reassign
6. **Filter queue** → Project dropdown + Status dropdown → Refreshes list

#### Flow 6: Admin - Configure Role Access
1. **Navigate** → `/v3/role-access-map` (ADMIN only)
2. **View matrix** → Roles as columns, Features as rows
3. **Add custom role** → "Add Role" → Name + Description
4. **Toggle checkboxes** → Grant/revoke feature access per role
5. **Save** → PUT `/api/access-control/config` → Instant navigation updates
6. **Verify** → Switch user (or check AccessControlService) → Nav items appear/disappear

---

### 15.31 State Management Summary

| Page | Loading State | Empty State | Error State | Success Feedback |
|------|---------------|-------------|-------------|------------------|
| V3 Home | Skeleton cards | N/A (always has command_center) | Toast | N/A |
| Knowledge Base | Spinner sidebar + content | "Select a document" | Toast + inline | Toast "Link copied" |
| Magic Assistance | Full-card overlay | EOP message | Toast | N/A |
| CRM | Skeleton list + thread | "No tickets" / "No ticket selected" | Toast + inline | Toast "Saved" / "Sent" |
| Collaboration | "Loading workspace..." | "No messages yet" | Red state box | Toast "Message sent" |
| Process Assistant | "Loading conversation..." | "No messages yet" | Right panel error | N/A |
| Live Chat | Skeleton session cards | "Select conversation or Play" | Toast | Toast "Sent" |
| KB Map Builder | "Loading article map..." | Empty canvas | Expandable error details | Toast "Saved" |
| Article Management | "Loading articles..." | "No articles found" | Red error above list | Toast "Created" / "Updated" |
| Article Editor | TinyMCE init | Blank editor | Inline + toast | Toast "Saved" |
| Role Access Map | Spinner | Empty matrix | Toast | Toast "Saved" |
| User Settings | Per-section | N/A | Inline field errors | Toast "Saved" |

---

### 15.32 Responsive Breakpoint Summary

| Breakpoint | Shell | KB | CRM | Collaboration | Builders | Other |
|------------|-------|-----|-----|---------------|----------|-------|
| **≥ 1440px** | 3-col (280/1fr/320) | 2-col | 3-col | 3-col | 2-col | 2-col |
| **1024-1439px** | 2-col (284/1fr) | 2-col | 2-col (list+detail) | 2-col (right→bottom) | 2-col | 2-col |
| **768-1023px** | Sidebar drawer | Sidebar drawer | Sidebar drawer | Left drawer, right bottom | Sidebar drawer | Stacked |
| **< 768px** | Sidebar drawer | Full-width panes | Stacked (tabs) | Stacked (tabs) | Stacked | Stacked |

---

*End of Detailed Page UI/UX Descriptions. This completes the comprehensive visual and interaction documentation for all 25+ pages in the Focal V3 Shell.*