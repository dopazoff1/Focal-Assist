# Focal - Project Overview & Database Schema

> This document contains the project overview, tech stack, and complete database schema needed to recreate the Focal platform from scratch.

---

## 1. PROJECT OVERVIEW

**Project Name:** focal  
**Type:** Internal Customer Support & Knowledge Management Platform  
**Architecture:** Full-stack monorepo with Next.js App Router, Route Handlers, and Server Actions  
**Package Manager:** npm  
**Language:** TypeScript  
**Database:** PostgreSQL

### Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Full-Stack Framework | Next.js (App Router) | 15+ |
| Frontend UI | Tailwind CSS + custom CSS variables | - |
| Server Runtime | Next.js Node.js runtime + TypeScript server modules | - |
| Database | PostgreSQL | 15+ |
| Data Access | Drizzle ORM, Kysely, or typed `pg` queries | - |
| Auth | OIDC with secure server-side sessions | - |
| Build Tools | Next.js CLI, npm | - |
| Testing | Vitest, Playwright | - |
| SSR | Next.js Server Components and streaming | - |
| Editor | TinyMCE 8.3.2 | - |

---

## 2. LEGACY SOURCE SCHEMA (JPA Entities; Migrate to PostgreSQL)

> The SQL in this section preserves the original field and relationship inventory. It is migration input, not PostgreSQL-ready DDL. The authoritative PostgreSQL conversion rules and production schema requirements follow in the production adaptation section.

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

## Production Database Architecture Adaptation

The SQL above records the source model. Recreate its entities and relationships in PostgreSQL; retain product fields unless an explicit migration decision changes them. Replace `BIGINT AUTO_INCREMENT` with `uuid` primary keys (UUIDv7 preferred) and `DATETIME` with `timestamptz`. All externally addressable IDs must be opaque UUIDs. Use `jsonb` only for genuinely variable metadata; use normalized tables for queryable facts.

### Tenant and identity model

Add `tenants`, `tenant_memberships`, and an immutable `audit_events` table. Every tenant-scoped business table—including users/memberships, KB, CRM, chat, academy, QA, settings, integrations, and all join tables—gets a non-null `tenant_id`. Foreign keys use tenant-aware composite constraints, for example `(tenant_id, article_id)` and `(tenant_id, user_id)`, so a row cannot point at another tenant's record.

Identity-provider subjects are stored as `identity_subject` on an application user/membership record. Roles are assigned through tenant membership, never copied from browser claims into application state without validation. The six existing role names and the configurable role-feature model are retained.

### RLS and access path

Enable and force PostgreSQL RLS on tenant-scoped tables. At the beginning of each transaction, the Next.js server layer sets a transaction-local tenant context only after authenticating the principal and resolving its membership. Policies compare `tenant_id` to that context. The application runtime database role cannot bypass RLS; a separate migration/admin role may do so only for controlled operations. RLS is defense in depth—not a substitute for service-level resource checks.

```sql
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_articles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON kb_articles
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### Storage, constraints, and lifecycle

Replace binary profile photos and academy `data_blob` values with metadata rows (`object_key`, SHA-256, size, media type, scan status) and private S3 objects. The API issues short-lived signed upload/download URLs only after authorization. Keep soft deletion only where recovery/audit is required (`deleted_at`, `deleted_by`); apply a partial unique index to preserve uniqueness among live rows. Write immutable audit events for role changes, exports, access-map changes, data deletion, OAuth connection changes, and other sensitive actions.

### Important indexes and transactions

Create indexes from actual query patterns, all prefixed with tenant scope. Examples: `(tenant_id, status, last_message_at DESC, id)` supports FlowDesk queue pagination; `(tenant_id, room_id, created_at DESC, id)` supports collaboration cursor history; `(tenant_id, category_id, is_active, display_order)` supports KB browsing; `(tenant_id, user_id, created_at DESC)` supports AI history and presence. Use unique constraints for provider external IDs per tenant, email/membership identity, and idempotency keys. Explain each index in migration comments and verify with `EXPLAIN (ANALYZE, BUFFERS)`.

All multi-row changes—including map/tree saves, ticket transitions, assignment claims, and role updates—run in bounded transactions with optimistic version columns where concurrent editing matters. Database migrations are versioned, forward-only, reviewed, tested against a production-like snapshot, and executed through CI/CD before compatible application rollout.
