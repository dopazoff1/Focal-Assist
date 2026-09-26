# Focal - Backend Architecture

> Legacy Spring Boot structure is retained as a source-domain reference. The authoritative target is the Next.js server architecture defined in the production adaptation below.

---

## 6. BACKEND ARCHITECTURE

### 6.1 Project Structure (Maven)

```
backend/
├── src/main/java/com/creditplus/focalassist/
│   ├── focalAssistApplication.java          # Main entry point
│   ├── config/
│   │   ├── SecurityConfig.java             # Spring Security, JWT, CORS
│   │   ├── WebConfig.java                  # MVC config, static resources
│   │   └── OpenAiConfig.java               # OpenAI client config
│   ├── controller/
│   │   ├── AuthController.java             # /auth endpoints
│   │   ├── KbController.java               # /api/kb/*
│   │   ├── PageController.java             # /api/pages/*
│   │   ├── CrmController.java              # /api/crm/*
│   │   ├── CollaborationController.java    # /api/collaboration/*
│   │   ├── SettingsController.java         # /api/settings/*
│   │   ├── PresenceController.java         # /api/presence/*
│   │   ├── StaffController.java            # /api/staff/*
│   │   ├── AccessControlController.java    # /api/access-control/*
│   │   ├── TrainingController.java         # /api/training/*
│   │   ├── QaController.java               # /api/qa/*
│   │   ├── ProcessAssistantController.java # /api/process-assistant/*
│   │   ├── ChatController.java             # /api/crm/chats/*, /api/chat/projects/*
│   │   ├── CaseTagController.java          # /api/case-tags/*
│   │   └── GmailController.java            # /api/gmail/*
│   ├── service/
│   │   ├── AuthService.java                # Login, token generation
│   │   ├── KbService.java                  # KB business logic
│   │   ├── PageService.java                # Decision tree logic
│   │   ├── CrmService.java                 # CRM ticket logic
│   │   ├── CollaborationService.java       # Chat room/message logic
│   │   ├── SettingsService.java            # User preferences
│   │   ├── PresenceService.java            # Status management
│   │   ├── StaffService.java               # User management
│   │   ├── AccessControlService.java       # RBAC logic
│   │   ├── TrainingService.java            # Academy logic
│   │   ├── QaService.java                  # QA evaluation logic
│   │   ├── ProcessAssistantService.java    # OpenAI integration
│   │   ├── ChatService.java                # Live chat logic
│   │   ├── CaseTagService.java             # Tag hierarchy logic
│   │   ├── GmailService.java               # Gmail sync
│   │   └── NotificationService.java        # Email/push notifications
│   ├── repository/
│   │   ├── UserRepository.java
│   │   ├── KbCategoryRepository.java
│   │   ├── KbArticleRepository.java
│   │   ├── KbMapNodeRepository.java
│   │   ├── KbMapEdgeRepository.java
│   │   ├── PageRepository.java
│   │   ├── ChoiceRepository.java
│   │   ├── CemContactRepository.java
│   │   ├── CemConversationRepository.java
│   │   ├── CemInternalNoteRepository.java
│   │   ├── CaseTagNodeRepository.java
│   │   ├── CaseTagEdgeRepository.java
│   │   ├── CollabRoomRepository.java
│   │   ├── CollabRoomMemberRepository.java
│   │   ├── CollabMessageRepository.java
│   │   ├── TrainingAssetRepository.java
│   │   ├── QaEvaluationRepository.java
│   │   ├── ProcessAssistantProfileRepository.java
│   │   ├── ProcessAssistantConversationRepository.java
│   │   ├── ProcessAssistantMessageRepository.java
│   │   ├── ChatWidgetConfigRepository.java
│   │   ├── ChatConversationRepository.java
│   │   └── ChatMessageRepository.java
│   ├── entity/
│   │   ├── User.java
│   │   ├── UserStatusHistory.java
│   │   ├── KbCategory.java
│   │   ├── KbArticle.java
│   │   ├── KbMapNode.java
│   │   ├── KbMapEdge.java
│   │   ├── KbArticleFeedback.java
│   │   ├── KbArticleTimeTracking.java
│   │   ├── Page.java
│   │   ├── Choice.java
│   │   ├── CemContact.java
│   │   ├── CemConversation.java
│   │   ├── CemInternalNote.java
│   │   ├── CaseTagNode.java
│   │   ├── CaseTagEdge.java
│   │   ├── CollabRoom.java
│   │   ├── CollabRoomMember.java
│   │   ├── CollabMessage.java
│   │   ├── TrainingAsset.java
│   │   ├── QaEvaluation.java
│   │   ├── ProcessAssistantPromptProfile.java
│   │   ├── ProcessAssistantConversation.java
│   │   ├── ProcessAssistantMessage.java
│   │   ├── ChatWidgetConfig.java
│   │   ├── ChatConversation.java
│   │   └── ChatMessage.java
│   ├── dto/
│   │   ├── AuthDtos.java
│   │   ├── KbDtos.java
│   │   ├── PageDtos.java
│   │   ├── CrmDtos.java
│   │   ├── CollaborationDtos.java
│   │   ├── SettingsDtos.java
│   │   ├── AccessControlDtos.java
│   │   ├── TrainingDtos.java
│   │   ├── QaDtos.java
│   │   ├── ProcessAssistantDtos.java
│   │   ├── ChatDtos.java
│   │   └── CaseTagDtos.java
│   ├── security/
│   │   ├── JwtFilter.java                  # JWT extraction & validation
│   │   ├── JwtUtil.java                    # Token generation/parsing
│   │   ├── UserDetailsServiceImpl.java     # Loads user by email
│   │   └── CustomAuthenticationProvider.java
│   └── exception/
│       ├── GlobalExceptionHandler.java     # @ControllerAdvice
│       └── ResourceNotFoundException.java
├── src/main/resources/
│   ├── application.yml                     # Main config
│   ├── application-dev.yml                 # Dev overrides
│   └── application-prod.yml                # Prod overrides
└── pom.xml
```

### 6.2 Key Configuration (application.yml)

```yaml
server:
  port: 8080
  servlet:
    context-path: /api

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/creditplus_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
    username: ${DB_USER:root}
    password: ${DB_PASSWORD:password}
    hikari:
      maximum-pool-size: 20
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.MySQL8Dialect
        format_sql: true
  servlet:
    multipart:
      max-file-size: 50MB
      max-request-size: 50MB

security:
  jwt:
    secret: ${JWT_SECRET:your-super-secret-key-change-in-production-min-32-chars}
    expiration-seconds: 43200  # 12 hours

openai:
  api-key: ${OPENAI_API_KEY}
  model: gpt-4o-mini
  timeout-seconds: 30

gmail:
  client-id: ${GMAIL_CLIENT_ID}
  client-secret: ${GMAIL_CLIENT_SECRET}
  redirect-uri: ${GMAIL_REDIRECT_URI}

meta:
  app-id: ${META_APP_ID}
  app-secret: ${META_APP_SECRET}
  redirect-uri: ${META_REDIRECT_URI}

logging:
  level:
    com.creditplus.focalassist: DEBUG
    org.springframework.security: DEBUG
```

### 6.3 Security Configuration Details

**JWT Filter Chain:**
1. `JwtFilter` extracts `Authorization: Bearer <token>`
2. Validates signature & expiry via `JwtUtil`
3. Loads user via `UserDetailsServiceImpl`
4. Sets `SecurityContextHolder` with `UsernamePasswordAuthenticationToken`
5. Continues filter chain

**Public Endpoints (permitAll):**
- `/auth/**`
- `/api/kb/articles/**` (GET only for feedback/track-time)
- `/api/kb/categories` (GET)
- `/api/kb/analytics/**` (GET)
- `/api/pages` (GET - for Magic Assistance)
- `/api/access-control/config` (GET - for feature flags)
- `/api/collaboration/channel-access/map` (GET)
- `/api/crm/tags` (GET)
- `/api/process-assistant/profiles` (GET)

**Protected Endpoints:** All others require valid JWT

### 6.4 Service Layer Patterns

**Transactional Boundaries:**
- Read operations: `@Transactional(readOnly = true)`
- Write operations: `@Transactional` (default read-write)
- Bulk operations: Explicit transaction management

**Entity Mapping:**
- JPA annotations on entities
- DTOs for API layer (no entity exposure)
- Manual mapping in controllers/services (no MapStruct)

**Pagination:**
- Spring Data `Pageable` for list endpoints
- Default page size: 20, max: 100

**Error Handling:**
- `GlobalExceptionHandler` catches all exceptions
- Returns standardized error response:
```json
{
  "timestamp": "2024-01-01T12:00:00",
  "status": 404,
  "error": "Not Found",
  "message": "Article not found with id: 999",
  "path": "/api/kb/articles/999"
}
```

### 6.5 OpenAI Integration (Process Assistant)

**Flow:**
1. Frontend sends message to `/api/process-assistant/conversations/{id}/messages`
2. `ProcessAssistantService` builds conversation history
3. Prepends system prompt from selected profile
4. Calls OpenAI Chat Completions API (streaming not used - returns full response)
5. Saves assistant message to DB
6. Returns full response to frontend

**Prompt Profile Structure:**
```java
@Entity
public class ProcessAssistantPromptProfile {
    @Id @GeneratedValue
    private Long id;
    private String name;
    private String description;
    @Column(columnDefinition = "LONGTEXT")
    private String systemPrompt;
    private String modelName = "gpt-4o-mini";
    private BigDecimal temperature = BigDecimal.valueOf(0.3);
    private Integer maxTokens = 2000;
    private Boolean isActive = true;
}
```

### 6.6 Gmail Integration

**OAuth Flow:**
1. Frontend → `/api/gmail/oauth/start` → redirects to Google consent
2. Google redirects to `/api/gmail/oauth/callback?code=...`
3. Backend exchanges code for tokens, stores in DB (encrypted)
4. Sync triggered manually or via scheduler

**Sync Process:**
- Fetches recent threads from Gmail API
- Creates/updates `CemContact` for senders
- Creates/updates `CemConversation` for threads
- Downloads message bodies & attachments
- Links to existing tickets or creates new

### 6.7 Database Indexes (Critical for Performance)

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_active ON users(role, active);

-- KB
CREATE INDEX idx_kb_articles_category ON kb_articles(category_id, is_active);
CREATE INDEX idx_kb_map_nodes_article ON kb_map_nodes(article_id);
CREATE INDEX idx_kb_map_edges_article ON kb_map_edges(article_id);

-- CRM
CREATE INDEX idx_cem_conversations_assigned ON cem_conversations(assigned_user_id, status);
CREATE INDEX idx_cem_conversations_queue ON cem_conversations(queue_name, status);
CREATE INDEX idx_cem_conversations_contact ON cem_conversations(contact_id);

-- Collaboration
CREATE INDEX idx_collab_messages_room_created ON collab_messages(room_id, created_at);
CREATE INDEX idx_collab_room_members_user ON collab_room_members(user_id);

-- Presence
CREATE INDEX idx_user_status_history_user_changed ON user_status_history(user_id, changed_at);

-- Process Assistant
CREATE INDEX idx_pa_conversations_user ON process_assistant_conversations(user_id);
CREATE INDEX idx_pa_messages_conversation ON process_assistant_messages(conversation_id, created_at);
```

### 6.8 Scheduled Tasks

```java
@EnableScheduling
@Configuration
public class SchedulerConfig {
    
    @Scheduled(fixedRate = 300000) // 5 minutes
    public void syncGmailAccounts() { ... }
    
    @Scheduled(fixedRate = 60000) // 1 minute
    public void cleanupTypingIndicators() { ... }
    
    @Scheduled(cron = "0 0 3 * * ?") // 3 AM daily
    public void archiveOldSessions() { ... }
}
```

---

## Production Next.js Server Architecture Adaptation

The Spring Boot layout above documents the source-system domains. Rebuild them as a **modular Next.js full-stack application** with server-only TypeScript modules; do not create microservices merely to mirror controllers. Deploy the web runtime and background workers as independently scalable processes from the same repository when their workloads differ.

```text
frontend/
  app/                         # pages, layouts, Route Handlers, and Server Actions
  components/                  # shared Server and Client Components
  server/
    platform/{auth,tenant,postgres,redis,sqs,s3,otel,config}/
    modules/
      identity/ knowledge/ workflow/ crm/ collaboration/ academy/
      qa/ ai/ integrations/ access/ notifications/
  workers/                     # TypeScript background worker entry points
  api/openapi/                 # versioned external contracts where required
  migrations/                  # PostgreSQL forward-only migrations
  deployments/                 # ECS/task configuration references
```

Each module owns its Route Handler or Server Action entry points, DTO validation, service/policy layer, repository, and domain tests. Cross-module effects use explicit interfaces and transactional outbox events; the database is not a shared implicit API. Route Handlers are the default HTTP boundary. Use a separate private protocol only after measurement proves a high-volume internal interface requires it.

### Request path and policy enforcement

Request handling order is: trusted request ID/trace context → Cloudflare/proxy validation → body limit and schema validation → authentication → tenant resolution → authorization policy → handler/action → structured audit/logging. Set a per-request deadline; propagate cancellation to PostgreSQL, Redis, SQS, and external calls. Use prepared/parameterized queries only. The server layer binds `SET LOCAL app.tenant_id` inside each PostgreSQL transaction and still applies explicit resource/ownership checks.

### Background processing

Replace in-process scheduled sync and cleanup work with SQS queues plus TypeScript workers. Write the change and an outbox event in one PostgreSQL transaction; a relay sends events to SQS. Workers use stable job IDs/idempotency records, visibility-timeout extension only while active, bounded exponential backoff with jitter, and a DLQ with alarm/runbook after retry exhaustion. Separate queues and concurrency limits for Gmail/Meta sync, notifications, malware scanning, exports, AI post-processing, and retention cleanup. Redis locks prevent duplicate periodic work but never establish business truth.

### Performance and scaling

Critical paths are sign-in/session verification, FlowDesk queue/ticket reads, collaboration history/send, KB browse/search, and AI streaming. Keep the Next.js server runtime stateless, horizontally scale on request concurrency/latency, and keep workers scaled by queue depth and oldest-message age. Use bounded PostgreSQL connection pools sized to database capacity; use read replicas only for measured, replica-safe read workloads. Cache low-churn, permission-safe data (feature configuration, public KB metadata) under a tenant/version namespace with explicit TTL/invalidation; do not cache authorization grants or personal ticket responses as shared data.

Monitor query plans and p50/p95/p99 latency before adding indexes. Put strict maximum page sizes, payload limits, and streaming/backpressure limits on API calls. Compression is negotiated at Cloudflare/Next.js; do not compress already compressed media.

### Reliability and failure policy

| Dependency/failure | Behaviour |
|---|---|
| PostgreSQL unavailable | Fail closed for writes/authz; readiness fails; retry only safe transient operations |
| Redis unavailable | Bypass noncritical cache, use degraded presence; do not bypass essential rate limits without a conservative edge policy |
| SQS/worker failure | Persist outbox, retry asynchronously, alert on queue age/DLQ |
| External API failure | Bounded timeout, circuit breaker, retry only idempotent calls; expose delayed status rather than blocking user flow |
| Duplicate request/job | Idempotency key + unique record; return previous compatible result |
| Deployment failure | Immutable image rollback; readiness gate prevents traffic before dependencies/config are valid |

Suggested defaults: 2–5 second internal database/Redis timeouts, 10–30 seconds bounded external calls, three to five jittered retries only for transient/idempotent operations, and no blind retries for user-visible mutation without an idempotency key. Liveness checks only detect a stuck process; readiness checks verify required configuration and essential dependency reachability without leaking details.

### Threat model and security controls

| Threat | Primary mitigations |
|---|---|
| Account takeover/brute force | OIDC MFA/passkeys, provider protections, short sessions, revocation, rate limits, audit alerts |
| BOLA/IDOR and cross-tenant access | membership-derived tenant, policy checks, composite FKs, RLS, tenant-scoped cache/job/object keys |
| SQLi/XSS/CSRF/SSRF | parameterized SQL, schema validation, sanitization/CSP, CSRF controls, outbound allowlists and blocked private IP ranges |
| Malicious files | private S3, signed URLs, type/magic-byte/size checks, malware scanning, quarantine, safe download headers |
| Secret/infrastructure compromise | IAM least privilege, Secrets Manager/KMS, private subnets, no public database, rotation and audit trails |
| Supply-chain/DDoS/abuse | locked dependencies, SAST/SCA/image scanning, signed immutable builds, Cloudflare WAF/rate limits/bot controls |

Structured logs redact credentials, tokens, cookies, authorization headers, raw payment data, and sensitive personal content. Include timestamp, level, request/trace ID, tenant pseudonym or controlled ID, actor ID where authorized, route, outcome, and latency. Security-sensitive audit events are append-only and separately retained.
