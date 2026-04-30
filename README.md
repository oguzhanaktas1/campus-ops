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
  |
  v
NestJS Backend API (:5000)
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

The primary data source is PostgreSQL. Redis is used for cache and queue infrastructure. RabbitMQ offloads domain events, notifications, emails, workflows, reminders, audits, files, documents, and report generation jobs to the worker service. The AI service is a separate FastAPI application called by the backend over the internal network.

## Services and Ports

| Service | Description | Port |
| --- | --- | --- |
| `frontend` | Next.js web application | `3000` |
| `backend` | NestJS API | `5000` |
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
- Sonner and project toast components
- date-fns date helpers
- jsPDF and html2canvas PDF/export flows

### Backend

- NestJS `11.x`
- TypeScript `5.9.x`
- Prisma ORM `6.19.x`
- PostgreSQL
- Redis, ioredis
- RabbitMQ, `amqplib` and `amqp-connection-manager`
- Passport JWT, `@nestjs/jwt`
- bcrypt password hashing
- class-validator and class-transformer DTO validation
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
- Ollama/local LLM runtime
- Default model configured via env, development Docker Compose value uses `gemma4:e2b`

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

**Async work.** After any meaningful state change — a new request, an approval, a rejection — the backend publishes a domain event to RabbitMQ. The Python worker service picks it up from the relevant queue and handles the side effects: sending notifications, dispatching emails, generating PDF documents, writing audit logs, and scheduling reminders. This keeps the backend response fast and decoupled from heavy I/O.

**AI assistant.** The frontend includes a role-aware AI assistant. When a user interacts with it, the backend forwards the message to the FastAPI AI service along with the user's role and context. The AI service calls a locally running Ollama LLM, generates a response, and returns it. The AI is also used for IT ticket triage, free-text request parsing, and approval summaries.

**Caching and SLA.** Redis caches frequently read data such as dashboard metrics and user sessions. A background SLA scheduler periodically checks open requests against defined SLA policies and flags overdue items.

**Data.** All persistent state lives in PostgreSQL. Prisma ORM manages the schema and migrations. File attachments are stored in Supabase Storage and referenced via `FileLink` records in the database.

## Security

Current security layers:

- JWT-based authentication
- Password hashing with bcrypt
- Role/permission-based backend guard structure
- Global DTO whitelist and non-whitelisted field rejection
- CORS allowlist
- Mutating request origin control in production
- Basic security headers
- Internal API key for AI service
- RabbitMQ user/password protection
- Audit, login history and system event records
