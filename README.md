# CampusOps / CampusFlow

CampusOps is a multi-service campus management platform that consolidates university internal operations under a single portal. The system manages request, approval, reservation, event, appointment, notification, file, and reporting workflows for student, faculty, staff, organizer, and admin roles.

The project is organized as a monorepo:

- `1frontend`: Next.js-based web interface
- `2backend`: NestJS-based main API and domain services
- `python-workers`: Python worker service processing asynchronously over RabbitMQ
- `services/ai-service`: FastAPI-based local AI/LLM service layer
- `docker-compose.yml`: full service orchestration for development environment
- `docker-compose.prod.yml`: override file for production domain names and production settings

## General Architecture

The system operates with four main application services and three infrastructure services.

```text
Browser
  |
  v
Next.js Frontend (:3000)
  |  \
  |   WebSocket (socket.io-client)
  |       |
  v       v
NestJS Backend API (:5000)
  |  \
  |   WebSocket Gateway (/realtime namespace, socket.io)
  |
  |              |                 |
  |              |                 v
  |              |          FastAPI AI Service (:8010)
  |              |                 |
  |              |                 v
  |              |          Ollama / Local LLM runtime
  |              |
  |              v
  |        RabbitMQ (:5672, mgmt :15672)
  |              |
  |              v
  |        Python Workers (:8000 metrics, :8001 health)
  |
  +---- PostgreSQL (:5432)
  |
  +---- Redis (:6379)
```

The primary data source is PostgreSQL. Redis is used for cache, session, and rate-limit state. RabbitMQ offloads domain events to the Python worker service. The AI service is a separate FastAPI application called by the backend over the internal network. A WebSocket gateway on the `/realtime` namespace pushes live updates (notifications, status changes, dashboard metrics) to connected clients.

## Services and Ports

| Service | Description | Port |
| --- | --- | --- |
| `frontend` | Next.js web application | `3000` |
| `backend` | NestJS API + WebSocket gateway | `5000` |
| `postgres` | PostgreSQL 16 | `5432` |
| `redis` | Redis 7 | `6379` |
| `rabbitmq` | RabbitMQ broker | `5672` |
| `rabbitmq` management | RabbitMQ management panel | `15672` |
| `ai-service` | FastAPI AI service layer | `8010` |
| `python-workers` health | Worker health/readiness endpoints | `8001` |
| `python-workers` metrics | Prometheus metrics endpoint | `8000` |

Default URLs in development environment:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- AI Service: `http://localhost:8010`
- RabbitMQ Management: `http://localhost:15672`
- Worker health: `http://localhost:8001/health`
- Worker readiness: `http://localhost:8001/ready`
- Worker metrics: `http://localhost:8000/metrics`

## Tech Stack

### Frontend

- Next.js `16.1.6`
- React `19.2.4`
- TypeScript `5.7.x`
- Tailwind CSS `4.x`
- Radix UI component infrastructure
- Lucide React icons
- Recharts charts
- React Hook Form form management
- Zod validation schemas
- Sonner toast notifications
- socket.io-client `4.x` for real-time updates
- date-fns date helpers
- jsPDF and html2canvas PDF/export flows

### Backend

- NestJS `11.x`
- TypeScript `5.9.x`
- Prisma ORM `6.19.x`
- PostgreSQL
- Redis, ioredis
- RabbitMQ, `amqplib` and `amqp-connection-manager`
- socket.io `4.x` + `@nestjs/websockets` + `@nestjs/platform-socket.io` for the realtime gateway
- Passport JWT, `@nestjs/jwt`
- bcrypt password hashing
- class-validator and class-transformer DTO validation
- Redis-backed rate limiting guard and decorator
- Supabase client and storage integration
- Jest test infrastructure

### Python Workers

- Python `3.12`
- asyncio-based worker runtime
- aio-pika RabbitMQ consumer
- asyncpg PostgreSQL access
- redis async client
- Pydantic and pydantic-settings
- structlog structured logging
- Jinja2 template processing
- ReportLab document/PDF generation
- Prometheus client metrics
- httpx external service calls
- tenacity retry strategies

### AI Service

- Python `3.12`
- FastAPI
- Uvicorn
- Pydantic settings
- httpx
- Ollama / local LLM runtime
- Default model: `qwen2.5:3b-instruct`
- Fallback model: `llama3.2:1b`
- Routes: assistant chat, free-text request parser, IT ticket triage, approval summary, analytics summary, semantic ticket similarity

### Infrastructure

- Docker Compose
- PostgreSQL 16 Alpine
- Redis 7 Alpine
- RabbitMQ 3.13 Management Alpine
- Node.js 22 Bookworm Slim images
- Python 3.12 Slim images

## How It Works

A user logs in through the Next.js frontend. The browser authenticates against the NestJS backend via JWT. Once authenticated, the user is routed to their role-specific portal — student, faculty, staff, organizer, or admin — each with its own set of screens and permissions.

**Request flow.** When a user submits a request (e.g. an internship application, room reservation, or equipment request), the backend creates a `Request` record in PostgreSQL and immediately starts a `WorkflowInstance` for it. The workflow engine assigns the request to the appropriate reviewer role or user based on the request type. Each approver sees the request in their queue, takes an action (approve, reject, or request revision), and the workflow advances to the next step. Every status change is recorded in `RequestStatusHistory` and surfaced to the user as a timeline.

**Real-time updates.** The backend hosts a WebSocket gateway on the `/realtime` namespace (socket.io). After authentication via JWT handshake, clients join role- and user-scoped rooms. When a request status changes, a notification is created, or a dashboard metric updates, the backend emits a socket event to the relevant room. This keeps the frontend in sync without polling.

**Async work.** After any meaningful state change the backend publishes a domain event to RabbitMQ. The Python worker service picks it up from the relevant queue and handles the side effects. Eight consumer queues are running:

| Queue | Responsibility |
| --- | --- |
| `q.notifications` | In-app notification persistence and delivery |
| `q.emails` | Transactional email dispatch |
| `q.workflow` | Workflow step advancement and escalation |
| `q.reminders` | Scheduled reminder delivery |
| `q.audit` | Audit log writes |
| `q.attachments` | File upload post-processing |
| `q.documents` | Document generation (transcripts, certificates) |
| `q.reports` | Async report snapshots and PDF export |

A background `reminder_sweep` task (60 s interval) and a `cleanup_loop` task (24 s interval) also run inside the worker process.

**AI assistant.** The frontend includes a role-aware AI assistant. When a user interacts with it, the backend forwards the message to the FastAPI AI service along with the user's role and context. The AI service calls a locally running Ollama instance using `qwen2.5:3b-instruct` as the primary model with `llama3.2:1b` as a fallback, generates a response, and returns it. The AI service is also used for IT ticket triage, free-text request parsing, approval summaries, and semantic ticket similarity matching.

**Caching and SLA.** Redis caches frequently read data such as dashboard metrics and user sessions. A background SLA scheduler periodically checks open requests against defined SLA policies and flags overdue items, triggering escalation events through the workflow engine.

**Data.** All persistent state lives in PostgreSQL. Prisma ORM manages the schema and migrations. File attachments are stored in Supabase Storage and referenced via `FileLink` records in the database.

**Events and calendar.** The organizer portal manages event plans (`EventPlan`) through a multi-step creation request (`EventCreationRequest`) approval flow before publishing. Published events support student registration, attendance tracking, and calendar integration (ICS export). A `CalendarEvent` model aggregates appointments, reservations, and events into a unified calendar view per user.

**AI knowledge base.** The backend maintains a `KnowledgeDocument` store with embedding references (`EmbeddingsIndexRef`) used to surface similar past tickets (`TicketSimilarityMatch`) when a new IT ticket is created, reducing duplicate support load.

## Security

Current security layers:

- JWT-based authentication
- Password hashing with bcrypt
- Role/permission-based backend guard structure
- Redis-backed rate limiting guard with per-endpoint `@RateLimit()` decorator applied to auth, request submission, and AI endpoints
- Global DTO whitelist and non-whitelisted field rejection
- WebSocket gateway JWT validation on handshake
- CORS allowlist
- Mutating request origin control in production
- Basic security headers
- Internal API key for AI service
- RabbitMQ user/password protection
- Audit, login history, and system event records

## Production

In production the services are configured via `docker-compose.prod.yml`. Key differences from the development environment:

- Backend and frontend are served under production domains (`api.campusflow.com.tr`, `campusflow.com.tr`)
- The AI service connects to an external Ollama host rather than a local container
- AI models remain `qwen2.5:3b-instruct` (default) and `llama3.2:1b` (fallback)
- Load balancing and TLS termination are handled at the infrastructure layer in front of the Docker services
- Redis rate-limit state and session cache persist across backend restarts

## Photos

### Landing Page

<p align="center">
  <img src="./1frontend/public/photos/campusflow-landing-page-1.png" alt="CampusFlow Landing Page - Hero Section" width="1000">
</p>

### Landing Page - Features

<p align="center">
  <img src="./1frontend/public/photos/campusflow-landing-page-2.png" alt="CampusFlow Landing Page - Features Section" width="1000">
</p>

### Landing Page - Services

<p align="center">
  <img src="./1frontend/public/photos/campusflow-landing-page-3.png" alt="CampusFlow Landing Page - Services Section" width="1000">
</p>

### Landing Page - Footer

<p align="center">
  <img src="./1frontend/public/photos/campusflow-landing-page-4.png" alt="CampusFlow Landing Page - Footer" width="1000">
</p>

### Landing Page (Dark Mode)

<p align="center">
  <img src="./1frontend/public/photos/campusflow-landing-page-dark-mode.png" alt="CampusFlow Landing Page - Dark Mode" width="1000">
</p>

### Login Screen

<p align="center">
  <img src="./1frontend/public/photos/login-screen.png" alt="CampusFlow Login Screen" width="1000">
</p>

### Admin - All Requests

<p align="center">
  <img src="./1frontend/public/photos/admin-all-requests.png" alt="Admin Panel - All Requests" width="1000">
</p>

### Admin - Analytics Dashboard

<p align="center">
  <img src="./1frontend/public/photos/admin-analytics.png" alt="Admin Analytics Dashboard" width="1000">
</p>

### Admin - Dashboard

<p align="center">
  <img src="./1frontend/public/photos/admin-dashboard.png" alt="Admin Dashboard" width="1000">
</p>

### Admin - Reports

<p align="center">
  <img src="./1frontend/public/photos/admin-reports.png" alt="Admin Reports" width="1000">
</p>

### Admin - Request Types

<p align="center">
  <img src="./1frontend/public/photos/admin-request-types.png" alt="Admin Request Types Management" width="1000">
</p>

### Admin - Roles & Permissions

<p align="center">
  <img src="./1frontend/public/photos/admin-roles.png" alt="Admin Roles and Permissions" width="1000">
</p>

### Admin - Users

<p align="center">
  <img src="./1frontend/public/photos/admin-users.png" alt="Admin User Management" width="1000">
</p>

### Admin - Workflow Instances

<p align="center">
  <img src="./1frontend/public/photos/admin-workflow-instances.png" alt="Admin Workflow Instances" width="1000">
</p>

### Integrations

<p align="center">
  <img src="./1frontend/public/photos/integrations.png" alt="System Integrations" width="1000">
</p>

### Admin AI Assistant

<p align="center">
  <img src="./1frontend/public/photos/admin_ai_assistant.png" alt="Admin AI Assistant" width="1000">
</p>

### Resource Management

<p align="center">
  <img src="./1frontend/public/photos/resources.png" alt="Resource Management" width="1000">
</p>

### SLA Policies

<p align="center">
  <img src="./1frontend/public/photos/sla-policies.png" alt="SLA Policy Management" width="1000">
</p>

### Notification Settings

<p align="center">
  <img src="./1frontend/public/photos/settings-notifications.png" alt="Notification Settings" width="1000">
</p>

### Profile Settings

<p align="center">
  <img src="./1frontend/public/photos/settings-profile.png" alt="Profile Settings" width="1000">
</p>

### Security Settings

<p align="center">
  <img src="./1frontend/public/photos/settings-security.png" alt="Security Settings" width="1000">
</p>

### Audit Logs

<p align="center">
  <img src="./1frontend/public/photos/audit-logs.png" alt="Audit Logs" width="1000">
</p>

### Calendar

<p align="center">
  <img src="./1frontend/public/photos/calendar.png" alt="Campus Calendar" width="1000">
</p>

### Faculty - Approvals

<p align="center">
  <img src="./1frontend/public/photos/faculty-approvals.png" alt="Faculty Approval Queue" width="1000">
</p>

### Faculty - Approval Details

<p align="center">
  <img src="./1frontend/public/photos/faculty-approvals-devami.png" alt="Faculty Approval Details" width="1000">
</p>

### Notifications

<p align="center">
  <img src="./1frontend/public/photos/notifications.png" alt="Notifications Center" width="1000">
</p>

### Organizer - Event Plans

<p align="center">
  <img src="./1frontend/public/photos/organizer-event-plans.png" alt="Organizer Event Plans" width="1000">
</p>

### Organizer - Published Events

<p align="center">
  <img src="./1frontend/public/photos/organizer-publisher-events.png" alt="Organizer Published Events" width="1000">
</p>

### Request Details

<p align="center">
  <img src="./1frontend/public/photos/request_detay.png" alt="Request Details" width="1000">
</p>

### Request Timeline & History

<p align="center">
  <img src="./1frontend/public/photos/request_detay_devam.png" alt="Request Timeline and History" width="1000">
</p>

### Staff Dashboard

<p align="center">
  <img src="./1frontend/public/photos/staff-dashboard.png" alt="Staff Dashboard" width="1000">
</p>

### Staff - IT Tickets

<p align="center">
  <img src="./1frontend/public/photos/staff-it-tickets.png" alt="Staff IT Tickets" width="1000">
</p>

### Staff - Requests

<p align="center">
  <img src="./1frontend/public/photos/staff-requests.png" alt="Staff Requests" width="1000">
</p>

### Student AI Assistant

<p align="center">
  <img src="./1frontend/public/photos/student-ai-asistant.png" alt="Student AI Assistant" width="1000">
</p>

### Student Dashboard

<p align="center">
  <img src="./1frontend/public/photos/student-dashboard.png" alt="Student Dashboard" width="1000">
</p>

### Student Requests

<p align="center">
  <img src="./1frontend/public/photos/student-requests.png" alt="Student Requests" width="1000">
</p>

### Student Settings

<p align="center">
  <img src="./1frontend/public/photos/student-settings.png" alt="Student Settings" width="1000">
</p>

### System Events

<p align="center">
  <img src="./1frontend/public/photos/system-events.png" alt="System Events" width="1000">
</p>

### System Monitoring

<p align="center">
  <img src="./1frontend/public/photos/system_monitoring.png" alt="System Monitoring Dashboard" width="1000">
</p>

### Webhook Logs

<p align="center">
  <img src="./1frontend/public/photos/webhook-logs.png" alt="Webhook Logs" width="1000">
</p>

### Workflow Designer

<p align="center">
  <img src="./1frontend/public/photos/workflows.png" alt="Workflow Management" width="1000">
</p>