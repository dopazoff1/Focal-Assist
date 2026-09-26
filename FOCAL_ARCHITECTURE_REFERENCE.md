# Focal — Unified Production Architecture Reference

## Purpose
This document consolidates the Focal blueprint into a single reference for product, engineering, security, infrastructure, and implementation planning. It preserves the original business functionality while adapting the system into a production-grade, multi-tenant SaaS-ready architecture optimized for security, performance, scalability, reliability, and maintainability.

## Source Basis
This reference is grounded in the provided Focal documentation set:
- 01 Project Overview & Database Schema
- 02 API Endpoints
- 03 Frontend Architecture
- 04 Authentication & Authorization Flow
- 05 Core Page UI/UX
- 06 Collaboration & AI UI/UX
- 07 Builder & Admin UI/UX
- 08 Remaining Pages & Global Design System
- 09 Backend Architecture
- 10 Deployment & Operations

---

# 1. Executive Architecture Summary

Focal is a support operations and knowledge platform spanning dashboarding, FlowDesk/CRM, knowledge base management, collaboration, live chat, academy/training, QA evaluation, decision-tree builders, process assistant AI, role access configuration, and operational settings.

The production target architecture is:
- **Next.js + TypeScript + React** for the web application and BFF layer
- **Go** for the core backend API and workers
- **PostgreSQL** as the system of record
- **Redis** for cache, rate limiting, ephemeral collaboration state, and coordination
- **SQS** for durable asynchronous processing
- **S3** for private file storage with signed access
- **Cloudflare** for CDN, WAF, DDoS mitigation, and edge protection
- **AWS ECS/Fargate** for containerized runtime
- **AWS Secrets Manager + KMS** for secrets and encryption
- **Terraform** for infrastructure as code
- **GitHub Actions** for CI/CD
- **OpenTelemetry + Sentry** for observability

This architecture keeps the original business flows intact while improving the weakest areas in the original blueprint: browser-side token handling, limited tenant isolation, polling-heavy real-time behavior, coarse-grained infrastructure security, and less mature operational controls.

---

# 2. Technology Stack

## Frontend / BFF
- Next.js App Router
- React
- TypeScript
- Server Components for low-interaction pages
- Client Components only where interaction requires them
- Route Handlers as browser-facing BFF endpoints
- Server Actions for a narrow set of safe, same-origin mutations

## Backend
- Go modular monolith for core business logic
- REST APIs as the primary interface
- Internal domain services with explicit DTOs/contracts
- Stateless services where possible

## Database
- Aurora PostgreSQL in production
- Strong relational modeling, constraints, explicit indexing
- RLS for tenant-scoped business data
- SQL-first migrations

## Cache / Coordination
- Redis for:
  - cache
  - rate limiting
  - presence/typing state
  - distributed locks
  - idempotency windows

## Background Processing
- Amazon SQS
- Go workers
- Dead-letter queues
- Idempotent jobs with retries and backoff

## Object Storage
- S3 private buckets
- signed upload/download URLs
- malware scan and validation before release

## Edge / Security / Infra
- Cloudflare
- AWS VPC private networking
- ECS/Fargate
- Secrets Manager
- KMS
- IAM least privilege

## Auth / Identity
- Amazon Cognito or Auth0
- OIDC Authorization Code + PKCE
- MFA/passkeys where appropriate
- Short-lived credentials and server-managed sessions

## Observability
- OpenTelemetry
- centralized structured logs
- metrics and dashboards
- distributed tracing
- Sentry for app errors
- audit logging for sensitive actions

---

# 3. System Architecture

flowchart TD
    U[Users] --> CF[Cloudflare\nCDN + WAF + DDoS + Rate Limits]
    TP[Third-Party Providers\nGoogle Meta Jira OpenAI Stripe] --> CF

    CF --> ALB[Public AWS ALB]
    ALB --> WEB[Next.js Web + BFF\nECS Fargate]
    ALB --> WH[Webhook Ingress]

    WEB --> API[Go Core API\nPrivate ECS Fargate]
    WH --> API

    API --> PG[(Aurora PostgreSQL)]
    API --> REDIS[(Redis)]
    API --> Q[(Amazon SQS)]
    API --> S3[(S3 Private Buckets)]
    API --> SEC[Secrets Manager + KMS]

    Q --> WKR[Go Workers\nPrivate ECS Fargate]
    WKR --> PG
    WKR --> REDIS
    WKR --> S3
    WKR --> TP

    WEB --> IDP[OIDC Provider\nCognito/Auth0]
    WEB --> OTEL[OpenTelemetry]
    API --> OTEL
    WKR --> OTEL
    OTEL --> OBS[Logs + Metrics + Traces + Alerts + Sentry]

---

# 4. Application Architecture

## 4.1 Next.js Structure
Suggested route groups:
- `app/(public)`
  - login
  - invite acceptance
  - password reset
  - public widget surfaces if needed
- `app/(app)`
  - home
  - flowdesk
  - knowledge-base
  - collaboration
  - live-chat
  - process-assistant
  - academy
  - builders
  - settings
  - staff-management
  - role-access-map
  - channel-access-map

## 4.2 Rendering Model
Use Server Components for:
- dashboards
- settings pages
- analytics overviews
- article detail/read views
- staff/admin lists

Use Client Components for:
- builders/canvas tools
- rich text editing
- chat and messaging panes
- drag-drop interactions
- file upload UI
- live presence indicators

## 4.3 BFF Responsibilities
Next.js Route Handlers should:
- validate session/cookies
- resolve current tenant context
- enforce origin/CSRF protections where applicable
- call private Go APIs
- normalize frontend-facing responses
- hide internal tokens/secrets from the browser

## 4.4 Go Backend Domains
Recommended modules:
- identity
- tenancy
- access-control
- settings
- knowledge-base
- flowdesk
- collaboration
- live-chat
- chat-projects
- academy
- qa
- process-assistant
- files
- integrations
- audit
- jobs

## 4.5 Domain Boundary Principles
- Keep a modular monolith initially
- Extract separate services only for clear reasons:
  - independent scaling
  - fault isolation
  - special runtime needs
  - organizational ownership boundaries

---

# 5. Authentication and Authorization Architecture

## 5.1 Original Baseline
The original blueprint describes:
- JWT auth
- stateless Spring Security
- frontend AuthGuard and RoleGuard
- localStorage token storage
- 12-hour token expiry
- no auto refresh

## 5.2 Production Adaptation
Replace browser-stored JWT handling with:
- OIDC login via Cognito/Auth0
- secure server-managed session pattern through the BFF
- HttpOnly, Secure, SameSite cookies
- short-lived access tokens kept server-side where practical

## 5.3 Authorization Model
Authorization must be server-side only and include:
- authenticated identity
- tenant membership validation
- RBAC role resolution
- feature entitlement checks
- resource-level ownership/scope checks
- audit logging for sensitive mutations

## 5.4 Frontend Guards
Frontend feature guards may remain for UX, but they are not authoritative security controls.

---

# 6. Multi-Tenant Architecture

Focal should be adapted as a multi-tenant SaaS-ready platform.

## 6.1 Core Rules
- Every tenant-scoped resource must carry a `tenant_id`
- Tenant context must be derived from authenticated membership, not client input
- No endpoint may trust client-provided tenant IDs for authorization
- All cache keys, queues, files, audit events, and analytics must be tenant-aware

## 6.2 Tenant Isolation Layers
1. request-level authz in Go
2. repository/query-level tenant filters
3. PostgreSQL RLS for tenant-owned tables

## 6.3 Tenant-Aware Resource Patterns
- DB rows include `tenant_id`
- S3 keys prefix tenant scope
- Redis keys include tenant scope
- SQS messages carry tenant metadata
- audit records store tenant context

---

# 7. Domain Model Summary

## 7.1 Identity / Access
- tenants
- users
- tenant_memberships
- roles
- feature_grants
- sessions
- invitations

## 7.2 Knowledge Base
- categories
- articles
- article_versions
- article_feedback
- kb_map_nodes
- kb_map_edges

## 7.3 Process Assistant / Decision Trees
- pages
- page_choices
- prompt_profiles
- ai_conversations
- ai_messages
- ai_usage_events

## 7.4 FlowDesk / CRM
- contacts
- tickets
- conversations
- conversation_messages
- internal_notes
- assignments
- queues
- escalations

## 7.5 Case Tags / Builders
- case_tag_nodes
- case_tag_edges
- tree_nodes
- tree_edges
- prompt_map_nodes
- prompt_map_edges

## 7.6 Collaboration / Live Chat
- collaboration_rooms
- room_members
- collaboration_messages
- reactions
- live_chat_projects
- widget_configs
- visitor_sessions
- live_chat_conversations

## 7.7 Academy / QA
- courses
- assets
- enrollments
- progress
- qa_templates
- qa_evaluations
- qa_scores

## 7.8 Operational Tables
- file_objects
- integration_accounts
- oauth_tokens
- webhook_events
- outbox_events
- job_runs
- audit_log
- idempotency_keys

---

# 8. Database Architecture

## 8.1 PostgreSQL Strategy
Use Aurora PostgreSQL with domain-oriented schemas such as:
- `core`
- `kb`
- `flowdesk`
- `collab`
- `academy`
- `qa`
- `ai`
- `integrations`
- `files`
- `audit`
- `jobs`

## 8.2 Common Table Standards
For tenant-scoped entities:
- UUID primary keys or UUIDv7 public IDs
- `tenant_id` not null
- `created_at`, `updated_at`
- `deleted_at` only where business recovery requires soft deletion
- strict foreign keys
- check constraints where useful

## 8.3 RLS Strategy
Enable RLS on tenant-owned business tables. Set request-scoped tenant context at transaction level and enforce tenant equality in policies.

## 8.4 Indexing Strategy
Important index patterns:
- login and membership lookup
- tenant-scoped article listing by status/date
- ticket inbox by assignee/status/priority
- conversation listing by channel and recency
- collaboration messages by room and time
- live chat conversations by project/status
- feature grants and role resolution

Every index should support a known access path, not just be added speculatively.

## 8.5 Migration Strategy
- SQL-first migrations
- zero-downtime discipline
- additive changes first
- backfills where needed
- no ORM auto-migration in production

---

# 9. Major Product Areas and Adapted Architecture

## 9.1 Home Dashboard
Original behavior: role-aware dashboard with gated cards and shortcut flows.

Adaptation:
- server-render dashboard frame and summary data
- cache safe aggregates in Redis
- load user-specific actions and shortcuts server-side
- keep card gating server-authoritative

## 9.2 Knowledge Base
Original behavior: article browsing, management, map builder, analytics.

Adaptation:
- articles and categories in PostgreSQL
- versioned draft/publish workflow
- server-side search endpoint
- async analytics aggregation when needed
- builder graph writes validated transactionally

## 9.3 FlowDesk / CRM
Original behavior: ticket handling, next-ticket flow, notes, tags, channel interactions.

Adaptation:
- cursor-paginated inbox APIs
- idempotent ticket state mutations
- queue-backed notifications and sync side effects
- resource-level ticket authz
- full audit trail for assignment and escalation

## 9.4 Collaboration Hub
Original behavior: rooms, messaging, presence, multi-pane interface.

Adaptation:
- WebSocket/SSE delivery for message and presence events
- HTTP APIs for history, membership, and room setup
- Redis for ephemeral presence/typing state
- PostgreSQL for durable messages and membership

## 9.5 Process Assistant
Original behavior: AI chat and prompt-aware assistance.

Adaptation:
- provider calls from Go only
- prompt profiles and conversation history stored in PostgreSQL
- rate limits and quotas per tenant/user
- stream responses to frontend where useful
- redact sensitive fields before provider submission when policy requires

## 9.6 Live Chat / Chat Projects
Original behavior: agent queueing, widget config, chat project setup, API credentials.

Adaptation:
- public widget ingress isolated from internal agent operations
- signed or publishable project identifiers only
- secret credentials encrypted at rest
- conversation routing via backend policies
- async notifications and transcript processing

## 9.7 Academy / QA / Admin
Original behavior: course catalog/studio, evaluations, staff management, access maps.

Adaptation:
- admin pages server-rendered where possible
- strict role-based and resource-based mutations
- audit role changes, score changes, and assignment changes
- analytics paths optimized separately from authoring paths

---

# 10. API Architecture

## 10.1 Principles
For every API:
- define auth requirement
- define authorization rule
- define tenant scope
- validate input server-side
- return explicit DTOs
- standardize errors
- log/audit sensitive actions
- use pagination where appropriate
- support idempotency for retryable mutations

## 10.2 Major API Groups
- authentication and session
- user settings
- knowledge base articles
- knowledge base categories
- KB map builder
- KB analytics
- process assistant / decision trees
- FlowDesk / CRM
- presence
- collaboration
- staff management
- role access control
- training / academy
- QA evaluation
- live chat
- chat projects
- case tag builder
- Gmail integration

## 10.3 API Design Notes
- Browser should talk to Next.js BFF, not directly to private internal services
- Third-party webhooks may enter through dedicated verified endpoints
- Public widget APIs must be carefully scoped and isolated from internal APIs

---

# 11. Security Architecture

## 11.1 Security Principles
- zero trust
- least privilege
- defense in depth
- secure-by-default configuration
- server-side authorization
- strong tenant isolation

## 11.2 Key Threats
- account takeover
- broken authorization
- cross-tenant data access
- IDOR/BOLA
- XSS
- CSRF
- SSRF
- SQL injection
- malicious file upload
- webhook forgery
- token/secret leakage
- provider credential compromise
- abuse and DDoS
- supply chain compromise

## 11.3 Mitigations
- MFA/passkeys
- secure cookies
- no localStorage tokens
- explicit resource authz checks
- tenant-aware DB access and RLS
- sanitization and CSP
- CSRF defenses on cookie-authenticated mutations
- parameterized SQL only
- malware scanning for uploads
- webhook signature verification
- encrypted provider tokens
- rate limiting at Cloudflare and app level
- audit logging for sensitive actions
- dependency and image scanning in CI/CD

## 11.4 File Security
- private buckets by default
- signed URLs only
- validate size, type, and file signature
- quarantine until scan completes

## 11.5 Secrets Security
- Secrets Manager only
- KMS encryption
- no secrets in code or logs
- defined rotation process

---

# 12. Performance Architecture

## 12.1 Critical Paths
- login/session bootstrap
- dashboard load
- FlowDesk inbox and ticket detail
- KB article list/search/read
- collaboration and live chat delivery
- process assistant response time

## 12.2 Optimizations
- Server Components for low-interaction views
- route-level code splitting
- cursor-based pagination
- tenant-aware Redis caching
- WebSocket/SSE for real-time features
- async offload for non-critical side effects
- DB indexes aligned to real query patterns
- compression and streaming where beneficial

## 12.3 Likely Bottlenecks
- inbox queries at scale
- polling-based presence updates
- AI latency and spend spikes
- N+1 query patterns in analytics/admin pages
- file upload/scan delays

## 12.4 Monitoring Targets
- p95 and p99 latency by domain
- DB slow queries
- queue depth and worker lag
- cache hit rate
- AI provider latency and failure rate

---

# 13. Reliability Architecture

## 13.1 Design for Failure
Plan for:
- DB failover
- Redis outage
- queue backlog
- worker crash
- third-party API errors
- webhook duplicates
- partial failures during multi-step operations
- deployment regressions

## 13.2 Reliability Controls
- retries with exponential backoff and jitter
- dead-letter queues
- idempotency keys
- timeout budgets
- health/readiness/liveness endpoints
- graceful degradation for degraded dependencies
- synthetic checks for critical flows

## 13.3 Backup and Recovery
- automated DB backups with PITR
- periodic restore drills
- S3 versioning where needed
- immutable image releases

## 13.4 Initial Recovery Targets
- target RPO: 15 minutes
- target RTO: 2 hours

These should be refined once business SLA requirements are explicit.

---

# 14. Infrastructure Architecture

## 14.1 Public vs Private Components
Public:
- Cloudflare edge
- ALB
- Next.js public entry
- provider webhook ingress

Private:
- Go API
- workers
- PostgreSQL
- Redis
- internal queues
- secrets infrastructure

## 14.2 AWS Design
- separate environments: local, test/CI, staging, prod
- VPC with isolated subnets
- ECS/Fargate services
- private DB and cache
- no public PostgreSQL
- IAM least privilege
- security groups narrowly scoped

## 14.3 Terraform Scope
- networking
- ECS services
- DB/cache
- SQS
- S3
- IAM
- secrets
- monitoring
- Cloudflare integration where practical

---

# 15. CI/CD Architecture

## 15.1 Pull Request Pipeline
- linting
- type checking
- unit tests
- integration tests
- focused E2E tests
- SAST
- dependency scanning
- secret scanning
- container scanning
- Terraform validate/plan

## 15.2 Deployment Pipeline
- build immutable artifacts
- sign images
- publish SBOM
- deploy to staging
- run smoke tests
- require approval for production
- deploy with rollback support

## 15.3 Release Safety
- protected branches
- protected environments
- migration reviews
- rollback runbook
- audit deploy actor and change set

---

# 16. Observability Architecture

## 16.1 Logs
Structured JSON logs with:
- request ID
- trace ID
- tenant ID
- user ID where appropriate
- route
- latency
- result status
- job ID/event ID when relevant

Never log:
- passwords
- tokens
- API keys
- card data
- sensitive secrets

## 16.2 Metrics
Track:
- request latency
- error rate
- throughput
- DB latency and connection usage
- cache hit ratio
- queue depth
- worker failures
- auth failures
- rate-limit triggers
- AI latency and usage

## 16.3 Tracing
Use OpenTelemetry across:
- Next.js
- Go API
- PostgreSQL
- Redis
- SQS workers
- external providers

## 16.4 Audit Events
Audit:
- login success/failure
- MFA changes
- tenant switch
- invite events
- role/access changes
- article publish/unpublish
- ticket assignment/escalation/status changes
- prompt profile updates
- integration connect/disconnect
- export generation
- file access grants/downloads

---

# 17. Environment Strategy

## Local Development
- local DB/containers or managed dev DB
- isolated dev credentials
- no production data without sanitization

## Test / CI
- disposable databases and queues
- deterministic fixtures
- isolated secrets

## Staging
- production-like networking and auth
- separate providers or sandbox tenants
- realistic but non-production secrets

## Production
- fully isolated account or environment
- strict access controls
- audited changes only

Production credentials must never be reused in development.

---

# 18. Key End-to-End Flows

## 18.1 Login Flow
1. user authenticates with OIDC
2. BFF establishes secure session cookie
3. active tenant resolved from membership
4. frontend receives only necessary user/session context

## 18.2 Ticket Handling Flow
1. agent opens FlowDesk
2. server renders inbox and ticket context
3. agent adds note/tag/reply/assignment
4. mutation is validated and authorized server-side
5. durable state saved in PostgreSQL
6. notifications/integration sync handled asynchronously

## 18.3 KB Article Creation Flow
1. author opens article editor
2. draft saved via server-authorized mutation
3. version row created
4. optional builder graph updates stored transactionally
5. publish action audited and indexed for read paths

## 18.4 Collaboration Flow
1. user joins room
2. membership validated
3. history loaded from PostgreSQL
4. presence/typing tracked in Redis
5. new messages persisted and broadcast via real-time channel

## 18.5 File Upload Flow
1. client requests signed upload URL
2. server validates intent and policy
3. upload goes to private S3 path
4. scan/validation runs asynchronously
5. file becomes downloadable only after clean status

## 18.6 Integration/Webhook Flow
1. provider sends signed callback
2. signature verified
3. duplicate detection applied
4. event stored and queued
5. worker processes and updates tenant-scoped records

---

# 19. Security Checklist

- OIDC configured correctly
- MFA enforced for privileged roles
- no localStorage auth tokens
- HttpOnly Secure cookies enabled
- CSRF protections enabled
- strict CORS configured
- CSP enforced and tested
- RLS enabled on tenant-owned tables
- tenant-aware authz tests written
- signed URLs only for files
- malware scanning enabled
- webhook signature verification enabled
- provider tokens encrypted
- secrets only in Secrets Manager
- DB not public
- Redis not public
- rate limits configured
- WAF configured
- audit logging enabled
- break-glass access documented

---

# 20. Performance Checklist

- dashboard and inbox queries benchmarked
- cursor pagination implemented
- high-volume indexes reviewed
- caching keys tenant-aware
- polling replaced where feasible with real-time channels
- bundle size reviewed per route
- AI responses streamed where possible
- queue backlogs monitored
- slow query logging enabled
- p95 budgets defined for core flows

---

# 21. Deployment Checklist

- Terraform plans reviewed
- env separation verified
- ALB and Cloudflare configured
- TLS enabled
- secrets provisioned
- DB backup and PITR enabled
- observability stack live before traffic
- CI/CD approvals configured
- rollback procedure tested
- smoke tests cover auth, home, FlowDesk, KB, collaboration, AI, admin

---

# 22. Changes From Original Blueprint

| Original | Adapted Architecture | Reason |
| --- | --- | --- |
| Angular frontend | Next.js App Router | Better SSR/BFF/server boundaries |
| Spring Boot backend | Go modular monolith | Stronger fit for stateless API/workers and performance-sensitive paths |
| MySQL | PostgreSQL/Aurora | RLS, stronger tenant model, explicit schema control |
| localStorage JWT | secure cookie session via BFF | improved security posture |
| route-guard-heavy auth model | server-authoritative authz | prevents client-side trust issues |
| polling-oriented real-time behavior | WebSocket/SSE where needed | lower latency and lower load |
| scheduler-centric integration work | SQS + workers | durability, retries, and better scaling |
| VM/nginx-oriented deployment guidance | Cloudflare + AWS managed runtime | stronger edge and ops posture |

---

# 23. Risks and Tradeoffs

## Security Tradeoffs
- Cognito/Auth0 adds operational dependency but is safer than rolling auth
- RLS adds complexity but materially improves tenant isolation

## Performance Tradeoffs
- Modular monolith is simpler than microservices but less independently scalable
- Server Components improve initial load but require disciplined boundary management

## Cost Tradeoffs
- managed infra is more expensive than a simple VM stack
- operational maturity justifies cost for production SaaS posture

## Complexity Tradeoffs
- migration from Angular/Spring to Next.js/Go is non-trivial
- staged migration may be safer than a full cutover depending on team strength

---

# 24. Implementation Roadmap

## Phase 1 — Foundation
- settle tenant model
- settle identity model
- define domain boundaries
- create architecture decision records

## Phase 2 — Infrastructure
- provision AWS base infra
- configure Cloudflare
- set up secrets, CI/CD, observability

## Phase 3 — Authentication
- implement OIDC
- implement secure session model
- implement tenant membership resolution

## Phase 4 — Database
- design PostgreSQL schemas
- write migrations
- implement RLS and indexes

## Phase 5 — Core Backend
- identity/access-control
- settings/staff/admin
- KB and builders
- FlowDesk/CRM
- collaboration/live chat
- academy/QA
- process assistant
- integrations/files/audit

## Phase 6 — Frontend
- Next.js shell
- navigation and session bootstrap
- migrate key domains in priority order

## Phase 7 — Async Processing
- SQS workers
- retry and DLQ strategy
- notifications, sync, scans, analytics

## Phase 8 — Security Hardening
- threat modeling
- rate limit tuning
- CSP/CSRF hardening
- secret rotation exercises

## Phase 9 — Observability and Load Testing
- dashboards and alerts
- synthetic checks
- load and failure tests

## Phase 10 — Production Launch
- staging validation
- rehearsed cutover
- monitored rollout
- post-launch hardening

---

# 25. Open Decisions and Conflicts

## Conflicts Found in Source Material
- Java version references are inconsistent across source docs
- route naming around CRM/FlowDesk is not fully consistent
- feature/card counts appear slightly inconsistent in summary views

## Recommended Resolution
- standardize runtime decisions in the new target architecture
- canonicalize route naming early
- make backend policy and feature catalog the single source of truth

## Architectural Decisions Required
- tenant onboarding model
- enterprise SSO depth
- billing scope and Stripe usage
- data residency/compliance requirements
- migration strategy: phased coexistence vs hard cutover

---

# 26. Final Recommendation

Focal should evolve into a secure, modular, SaaS-ready platform without losing the operational workflows documented in the original blueprint. The priority is not adding maximum complexity; it is enforcing secure sessions, strict tenant isolation, server-side authorization, durable async processing, explicit database design, and strong observability.

If implemented in phases, this architecture provides a practical path from the original Angular/Spring/MySQL blueprint to a production-grade Next.js/Go/PostgreSQL platform while preserving the product's business capabilities.