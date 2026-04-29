# CampusOps / CampusFlow

CampusOps, üniversite içi operasyonları tek bir portal altında toplayan çok servisli bir kampüs yönetim platformudur. Sistem; öğrenci, akademisyen, personel, organizatör ve yönetici rollerinin talep, onay, rezervasyon, etkinlik, randevu, bildirim, dosya ve raporlama süreçlerini yönetir.

Proje bir monorepo olarak düzenlenmiştir:

- `1frontend`: Next.js tabanlı web arayüzü
- `2backend`: NestJS tabanlı ana API ve domain servisleri
- `python-workers`: RabbitMQ üzerinden asenkron işleyen Python worker servisi
- `services/ai-service`: FastAPI tabanlı yerel AI/LLM servis katmanı
- `docker-compose.yml`: geliştirme ortamı için tüm servis orkestrasyonu
- `docker-compose.prod.yml`: üretim alan adları ve üretim ayarları için override dosyası

## İçindekiler

- [Genel Mimari](#genel-mimari)
- [Servisler ve Portlar](#servisler-ve-portlar)
- [Tech Stack](#tech-stack)
- [Klasör Yapısı](#klasör-yapısı)
- [Frontend Mimarisi](#frontend-mimarisi)
- [Backend Mimarisi](#backend-mimarisi)
- [Veri Modeli](#veri-modeli)
- [Workflow ve Talep Yaşam Döngüsü](#workflow-ve-talep-yaşam-döngüsü)
- [Asenkron Worker Mimarisi](#asenkron-worker-mimarisi)
- [AI Servis Mimarisi](#ai-servis-mimarisi)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Geliştirme Komutları](#geliştirme-komutları)
- [Veritabanı ve Seed](#veritabanı-ve-seed)
- [Güvenlik](#güvenlik)
- [Gözlemlenebilirlik](#gözlemlenebilirlik)
- [Üretim Dağıtımı](#üretim-dağıtımı)
- [Açık Kaynak Yayına Hazırlık](#açık-kaynak-yayına-hazırlık)

## Genel Mimari

Sistem dört ana uygulama servisi ve üç altyapı servisi ile çalışır.

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

Ana veri kaynağı PostgreSQL'dir. Redis cache ve queue altyapısı için kullanılır. RabbitMQ domain event, bildirim, e-posta, workflow, hatırlatma, audit, dosya, doküman ve rapor üretimi gibi işleri worker servisine taşır. AI servisi backend tarafından iç ağ üzerinden çağrılan ayrı bir FastAPI uygulamasıdır.

## Servisler ve Portlar

| Servis | Açıklama | Port |
| --- | --- | --- |
| `frontend` | Next.js web uygulaması | `3000` |
| `backend` | NestJS API | `5000` |
| `postgres` | PostgreSQL 16 | `5432` |
| `redis` | Redis 7 | `6379` |
| `rabbitmq` | RabbitMQ broker | `5672` |
| `rabbitmq` management | RabbitMQ yönetim paneli | `15672` |
| `ai-service` | FastAPI AI servis katmanı | `8010` |
| `python-workers` health | Worker health/readiness endpointleri | `8001` |
| `python-workers` metrics | Prometheus metrics endpointi | `8000` |

Geliştirme ortamında varsayılan URL'ler:

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
- Radix UI bileşen altyapısı
- Lucide React ikonları
- Recharts grafikler
- React Hook Form form yönetimi
- Zod validasyon şemaları
- Sonner ve proje toast bileşenleri
- date-fns tarih yardımcıları
- jsPDF ve html2canvas PDF/export akışları

### Backend

- NestJS `11.x`
- TypeScript `5.9.x`
- Prisma ORM `6.19.x`
- PostgreSQL
- Redis, ioredis
- RabbitMQ, `amqplib` ve `amqp-connection-manager`
- Passport JWT, `@nestjs/jwt`
- bcrypt parola hashleme
- class-validator ve class-transformer DTO validasyonu
- Supabase istemcisi ve storage entegrasyonu
- Jest test altyapısı

### Python Workers

- Python `3.12`
- asyncio tabanlı worker runtime
- aio-pika RabbitMQ consumer
- asyncpg PostgreSQL erişimi
- redis async client
- Pydantic ve pydantic-settings
- structlog yapılandırılmış loglama
- Jinja2 template işleme
- ReportLab doküman/PDF üretimi
- Prometheus client metrics
- httpx dış servis çağrıları
- tenacity retry stratejileri

### AI Service

- Python `3.12`
- FastAPI
- Uvicorn
- Pydantic settings
- httpx
- Ollama/local LLM runtime
- Varsayılan model env ile ayarlanır, Docker Compose geliştirme değerinde `gemma4:e2b` kullanılır

### Altyapı

- Docker Compose
- PostgreSQL 16 Alpine
- Redis 7 Alpine
- RabbitMQ 3.13 Management Alpine
- Node.js 22 Bookworm Slim imajları
- Python 3.12 Slim imajları

## Klasör Yapısı

```text
campus-ops/
  1frontend/
    app/                  Next.js App Router rotaları
    components/           Ortak UI, portal layout, auth guard, AI assistant
    lib/                  Auth, tema, tarih, workflow ve yardımcı fonksiyonlar
    hooks/                React hook'ları
    types/                Frontend tipleri
    Dockerfile
    package.json

  2backend/
    prisma/
      schema.prisma       Ana veritabanı şeması
      migrations/         Prisma migration dosyaları
    src/
      auth/               Kimlik doğrulama
      admin/              Yönetim panelleri
      student/            Öğrenci portal API'leri
      faculty/            Akademisyen portal API'leri
      staff/              Personel portal API'leri
      organizer/          Organizatör portal API'leri
      requests/           Genel talep API ve timeline
      workflow/           Workflow engine, SLA ve assignment
      tickets/            IT destek talepleri
      resources/          Kaynak, oda, ekipman varlıkları
      reservations/       Oda/kaynak rezervasyon talepleri
      appointments/       Randevu talepleri ve uygunluk
      events/             Etkinlik yönetimi
      event-plans/        Etkinlik planlama akışı
      documents/          Doküman talepleri
      internships/        Staj talepleri
      access-requests/    Erişim talepleri
      procurement/        Satın alma talepleri
      notifications/      Bildirim API'leri
      files/              Dosya bağlantıları
      infrastructure/     Redis, cache, queue, RabbitMQ altyapısı
      modules/ai/         Backend tarafı AI client/controller
    Dockerfile
    package.json

  python-workers/
    app/
      main.py             Worker bootstrap
      config.py           Worker ayarları
      payloads.py         Kuyruk payload şemaları
      consumers.py        Queue consumer kayıtları
      handlers.py         İş handler'ları
    Dockerfile
    requirements.txt

  services/
    ai-service/
      main.py             FastAPI bootstrap
      app/api/routes/     AI endpointleri
      app/models/         Request/response modelleri
      app/prompts/        Prompt şablonları
      app/services/       Ollama client, parser, triage, assistant servisleri
      app/core/           Config ve internal API key güvenliği
    Dockerfile
    requirements.txt
```

## Frontend Mimarisi

Frontend Next.js App Router ile role göre ayrılmış portal alanlarından oluşur.

### Ana rota grupları

- `(auth)`: login, sign-up, forgot-password, reset-password ve unauthorized ekranları
- `(portal)/admin`: sistem yönetimi, kullanıcı/rol/izin, workflow, rapor, audit ve entegrasyon ekranları
- `(portal)/student`: öğrenci dashboard, talepler, randevu, etkinlik, dosya ve bildirim ekranları
- `(portal)/faculty`: akademisyen dashboard, approvals, request/ticket/detail/revision ekranları
- `(portal)/staff`: personel dashboard, staff request workflow, ticket, reports ve operasyon ekranları
- `(portal)/organizer`: organizatör dashboard, etkinlik planları ve organizasyon talepleri

### Önemli frontend bileşenleri

- `components/portal-layout.tsx`: portal sayfa iskeleti
- `components/AuthGuard/auth-guard.tsx`: rol bazlı route koruma
- `components/request-form.tsx`: ortak talep form yüzeyi
- `components/request-timeline.tsx`: talep geçmişi ve statü akışı
- `components/workflow-step-indicator.tsx`: workflow adım gösterimi
- `components/status-badge.tsx`: status görselleştirme
- `components/notification-bell.tsx`: bildirim erişimi
- `components/ai/portal-assistant.tsx`: role-aware AI asistan arayüzü

### UI yaklaşımı

UI bileşenleri Radix tabanlı `components/ui` klasöründe toplanmıştır. Sayfalar role ve domain'e göre ayrılır, ortak davranışlar `lib` altında tutulur. API erişimleri frontend tarafında backend base URL üzerinden yapılır.

## Backend Mimarisi

Backend NestJS modüler mimarisi ile kuruludur. `AppModule`, altyapı modüllerini ve domain modüllerini tek uygulamada birleştirir.

### Çekirdek modüller

- `PrismaModule`: PostgreSQL erişimi
- `AuthModule`: login, JWT, kullanıcı kimliği ve guard akışları
- `RedisModule`: Redis bağlantısı
- `CacheModule`: paylaşımlı cache altyapısı
- `QueueModule`: queue abstraction
- `RabbitmqModule`: RabbitMQ bağlantısı ve event publish/consume altyapısı
- `FilesModule`: dosya ve dosya ilişkilendirme servisleri
- `AiModule`: FastAPI AI servisi ile backend arasındaki client katmanı

### Portal ve domain modülleri

- `AdminModule`: yönetim panelleri, sistem kayıtları, kullanıcı/rol/izin yönetimi
- `StudentModule`: öğrenciye ait dashboard ve talep görünümü
- `FacultyModule`: akademisyen talepleri, approvals ve profil alanları
- `StaffModule`: personel queue, request workflow ve operasyonel listeler
- `OrganizerModule`: etkinlik organizatörü iş akışları
- `RequestsModule`: generic request listesi, detay, timeline, comment ve watcher/tag davranışları
- `WorkflowModule`: workflow engine, transition, assignment ve SLA servisleri
- `TicketsModule`: IT destek talebi domain'i
- `ResourcesModule`: oda, ekipman ve kampüs kaynakları
- `ReservationsModule`: oda/kaynak rezervasyon talepleri
- `AppointmentsModule`: randevu talepleri ve katılımcı/uygunluk yönetimi
- `CalendarModule`: takvim olayları
- `DocumentsModule`: belge/doküman talepleri
- `InternshipsModule`: staj talep akışı
- `AccessRequestsModule`: erişim yetkisi talepleri
- `ProcurementModule`: satın alma talepleri
- `EventsModule`: yayınlanan etkinlikler
- `EventPlansModule`: etkinlik oluşturma/planlama workflow'u
- `PublicEventsModule`: herkese açık etkinlik endpointleri
- `NotificationsModule`: bildirimler ve tercihleri

### API davranışı

Backend bootstrap sırasında:

- JSON body limiti `1mb` olarak ayarlanır
- Global `ValidationPipe` kullanılır
- DTO dışı alanlar reddedilir
- CORS `FRONTEND_URL` değerinden türetilir
- Production ortamında unsafe origin POST/PATCH/DELETE istekleri reddedilir
- Güvenlik header'ları eklenir

## Veri Modeli

Ana veritabanı şeması `2backend/prisma/schema.prisma` dosyasındadır. Model grupları aşağıdaki şekilde ayrılabilir.

### Kimlik, organizasyon ve RBAC

- `User`, `UserProfile`
- `Campus`, `Faculty`, `Department`, `Unit`, `AcademicTerm`
- `Role`, `Permission`, `RolePermission`, `UserRole`

Bu grup kullanıcı kimliğini, akademik organizasyon ağacını, rol ve izin sistemini yönetir.

### Talep ve workflow çekirdeği

- `RequestType`
- `Request`
- `RequestStatusHistory`
- `RequestAssignment`
- `RequestComment`
- `RequestWatcher`
- `RequestTag`, `RequestTagLink`
- `WorkflowDefinition`
- `WorkflowStep`
- `WorkflowTransition`
- `WorkflowInstance`
- `WorkflowInstanceStep`
- `ApprovalAction`

Bu grup her domain talebinin ortak status, assignment, timeline, yorum, watcher, tag ve workflow geçmişini taşır.

### Domain talep modelleri

- `InternshipRequest`
- `EquipmentRequest`
- `ItTicket`
- `RoomReservationRequest`
- `EventRequest`
- `AccessRequest`
- `ProcurementRequest`
- `DocumentRequest`
- `AppointmentRequest`
- `EventCreationRequest`

Her domain modeli ortak `Request` kaydına bağlanır ve kendi form alanlarını saklar.

### Kaynak, randevu, rezervasyon ve takvim

- `Resource`
- `ResourceAvailability`
- `Reservation`
- `ReservationConflict`
- `Appointment`
- `AppointmentParticipant`
- `UserAvailabilitySlot`
- `CalendarEvent`

Bu grup oda/kaynak rezervasyonu, uygunluk, randevu katılımcıları ve takvim görünümü için kullanılır.

### Etkinlik ve kulüp yönetimi

- `Club`
- `ClubMember`
- `EventPlan`
- `Event`
- `EventPlanRegistration`
- `EventRegistration`
- `EventDecisionLog`

Bu modeller etkinlik planlama, yayınlama, kayıt ve karar geçmişi süreçlerini destekler.

### Dosya, bildirim ve iletişim

- `File`
- `FileLink`
- `Notification`
- `NotificationPreference`
- `EmailLog`

Dosya ekleri, modele bağlanan dosya linkleri, kullanıcı bildirimleri ve e-posta kayıtları bu gruptadır.

### Audit, entegrasyon, SLA ve raporlama

- `AuditLog`
- `SystemEvent`
- `LoginHistory`
- `Integration`
- `WebhookLog`
- `IntegrationJob`
- `N8nWorkflowRun`
- `SlaPolicy`
- `SlaEvent`
- `DailyMetric`
- `ReportSnapshot`
- `DashboardCache`

Bu grup izlenebilirlik, sistem olayları, dış entegrasyonlar, SLA olayları ve raporlama cache'lerini tutar.

### AI ve bilgi tabanı

- `AiConversation`
- `AiMessage`
- `KnowledgeDocument`
- `EmbeddingsIndexRef`
- `TicketSimilarityMatch`

AI asistan konuşma geçmişi, bilgi dokümanları, embedding index referansları ve benzer ticket eşleşmeleri için kullanılır.

### Outbox ve idempotency

- `OutboxEvent`
- `ProcessedEvent`

Asenkron event publish ve worker tarafında tekrarlı işlemeyi engellemek için kullanılır.

## Workflow ve Talep Yaşam Döngüsü

CampusOps'ta genel status ile domain'e özel workflow adımı ayrıdır.

Genel request status alanı, talebin dışarıdan görünen yaşam döngüsünü temsil eder:

```text
DRAFT -> SUBMITTED -> IN_REVIEW -> APPROVED / REJECTED -> IN_PROGRESS -> COMPLETED -> CLOSED
```

Workflow adımları ise talebin hangi rol, birim veya kullanıcı tarafından işleneceğini gösterir. Örnek akışlar:

- `INTERNSHIP_REQUEST`: advisor review -> internship coordinator review -> approved/rejected
- `DOCUMENT_REQUEST`: document processing -> approved
- `ROOM_RESERVATION`: resource review -> security review -> approved
- `APPOINTMENT`: resource review -> approved
- `IT_SUPPORT`: IT review -> manager approval -> approved -> in progress -> completed
- `EQUIPMENT`: technical review -> resource review -> approved
- `ACCESS_REQUEST`: security review -> IT review -> manager approval -> approved
- `PROCUREMENT_REQUEST`: budget review -> procurement review -> finance approval -> approved
- `EVENT_REQUEST`: event coordinator -> resource review -> security review -> approved
- `EVENT_CREATION_REQUEST`: advisor/event coordinator -> resource -> security -> approved

Workflow motorunun temel parçaları:

- `WorkflowDefinition`: request type için tanımlanan workflow
- `WorkflowStep`: role, unit veya kullanıcı bazlı onay/işlem adımı
- `WorkflowTransition`: adımlar arası geçiş kuralı
- `WorkflowInstance`: belirli bir request için çalışan workflow
- `WorkflowInstanceStep`: instance içindeki adım durumu
- `ApprovalAction`: approve, reject, request revision gibi aksiyon geçmişi
- `RequestAssignment`: aktif sorumlu kullanıcı/rol/birim bilgisi
- `RequestStatusHistory`: kullanıcıya ve admin'e gösterilen status timeline

Revision mantığı, talebi requester'a geri gönderir. Requester revize edip tekrar gönderdiğinde workflow ilgili review adımından devam etmelidir. Terminal durumlar `APPROVED`, `REJECTED`, `COMPLETED` ve `CLOSED` gibi bitmiş durumları temsil eder.

## Asenkron Worker Mimarisi

`python-workers` servisi RabbitMQ üzerinden gelen işleri tüketir. Worker runtime `app/main.py` içinde başlar ve aşağıdaki kuyrukları dinler:

- `q.notifications`
- `q.emails`
- `q.workflow`
- `q.reminders`
- `q.audit`
- `q.attachments`
- `q.documents`
- `q.reports`

Desteklenen payload aileleri:

- `request.created`
- `request.updated`
- `request.cancelled`
- `request.status_changed`
- `workflow.assigned`
- `workflow.approved`
- `workflow.rejected`
- `workflow.revision_requested`
- `notification.create`
- `email.send`
- `reminder.schedule`
- `sla.check`
- `event.published`
- `audit.append`
- `attachment.process`
- `document.generate`
- `report.generate`

Worker ayrıca şu background görevlerini başlatır:

- Reminder sweep
- Cleanup loop
- Health server
- Metrics server

Bu ayrım sayesinde kullanıcı isteğini bloklamayan işler backend API dışına alınır.

## AI Servis Mimarisi

AI servisi `services/ai-service` altında FastAPI uygulaması olarak çalışır. Backend iç ağdan bu servise istek atar. Servis kendi endpointlerini internal API key ile korur.

### Endpointler

- `POST /assistant/ask`: portal içi role-aware asistan
- `POST /triage/ticket`: IT ticket sınıflandırma, öncelik ve öneri
- `POST /parse/request`: serbest metinden request alanı çıkarma
- `POST /summary/approval`: onay ekranı için özet üretme
- `POST /analytics/summary`: dashboard/analitik özetleri
- `GET /health`: servis sağlık kontrolü

### İç yapı

- `assistant_intent_router.py`: kullanıcının amacını route eder
- `assistant_tools.py`: portal navigasyonu ve rol bazlı tool yanıtları
- `ollama_client.py`: lokal model runtime çağrısı
- `prompt_service.py`: markdown prompt şablonlarını yükler
- `triage_service.py`: ticket triage akışı
- `parser_service.py`: request parse akışı
- `summary_service.py`: approval summary akışı
- `analytics_service.py`: analitik özet akışı

AI servisi rol, kapsam ve domain bağlamını backend'den alır. Yetki kontrolünün nihai kaynağı backend olmalıdır; AI yanıtları doğrudan veri yetkisi yerine yönlendirme ve özet üretme amaçlı kullanılmalıdır.

## Kurulum

### Ön koşullar

- Docker Desktop veya Docker Engine
- Docker Compose v2
- Node.js 22 önerilir
- npm
- Python 3.12, sadece servisleri Docker dışında çalıştıracaksanız gerekir
- Ollama veya uyumlu local LLM runtime, AI özelliklerini tam çalıştırmak için gerekir

### Hızlı başlangıç: Docker Compose

Kök dizinden çalıştırın:

```bash
docker compose up -d --build
```

Servisleri kontrol edin:

```bash
docker compose ps
```

İlk veritabanı kurulumu için migration ve seed çalıştırın:

```bash
docker compose up -d postgres redis rabbitmq
cd 2backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
```

Sonra tüm stack'i açın:

```bash
cd ..
docker compose up -d --build
```

Seed sonrası demo girişleri (yalnızca yerel geliştirme ortamı için):

```text
admin@campusops.edu.tr    / (seed dosyasındaki şifre)
student@campusops.edu.tr  / (seed dosyasındaki şifre)
faculty@campusops.edu.tr  / (seed dosyasındaki şifre)
staff@campusops.edu.tr    / (seed dosyasındaki şifre)
```

> **Uyarı:** Bu hesaplar yalnızca lokal geliştirme seed verisidir. Canlı ortamda seed şifrelerini mutlaka değiştirin.

### Lokal geliştirme

Altyapıyı Docker ile açıp frontend/backend'i makinede çalıştırmak pratik geliştirme senaryosudur.

```bash
docker compose up -d postgres redis rabbitmq ai-service python-workers
```

Backend:

```bash
cd 2backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run start:dev
```

Frontend:

```bash
cd 1frontend
npm install
npm run dev
```

AI service'i lokal çalıştırmak isterseniz:

```bash
cd services/ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8010
```

Python workers'ı lokal çalıştırmak isterseniz:

```bash
cd python-workers
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

## Ortam Değişkenleri

Geliştirme compose dosyası bazı değerleri servis tanımında verir. Üretim ve açık kaynak paylaşımında gerçek secret değerleri repoda tutulmamalıdır.

### Frontend

- `NEXT_PUBLIC_BACKEND_URL`: Browser'ın çağıracağı backend URL'i
- `NEXT_PUBLIC_APP_URL`: Frontend public URL'i

### Backend

- `DATABASE_URL`: Prisma için PostgreSQL bağlantısı
- `DIRECT_URL`: Prisma direct connection URL'i, gerekiyorsa
- `BACKEND_PORT`: varsayılan `5000`
- `FRONTEND_URL`: CORS ve origin kontrolü için izin verilen frontend URL listesi
- `JWT_SECRET`: JWT imzalama secret'ı
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_TLS`
- `REDIS_URL`: tek connection string kullanımı
- `RABBITMQ_URL`: AMQP bağlantısı
- `RABBITMQ_MANAGEMENT_URL`: management API URL'i
- `WORKERS_INTERNAL_URL`: worker health/internal URL'i
- `WORKERS_METRICS_INTERNAL_URL`: worker metrics URL'i
- `AI_SERVICE_URL`: AI service internal URL'i
- `AI_SERVICE_API_KEY`: AI service internal API key
- `AI_SERVICE_TIMEOUT_MS`: AI servis çağrısı timeout değeri
- `PUBLIC_API_URL`: public backend URL'i
- `RUN_MIGRATIONS`: Docker production container açılırken migration çalıştırmak için `true`

### Python Workers

`python-workers/.env.example` temel örneği içerir.

- `RABBITMQ_URL`
- `DATABASE_URL`
- `REDIS_URL`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `FRONTEND_URL`
- `ENV`
- `LOG_LEVEL`

### AI Service

- `APP_ENV`
- `HOST`
- `PORT`
- `ENABLE_DOCS`
- `AI_ENABLED`
- `AI_RUNTIME_PROVIDER`
- `AI_DEFAULT_MODEL`
- `OLLAMA_MODEL`
- `AI_RUNTIME_BASE_URL`
- `OLLAMA_BASE_URL`
- `AI_REQUEST_TIMEOUT_SECONDS`
- `AI_INTERNAL_API_KEY`
- `AI_FALLBACK_CONFIDENCE`

## Geliştirme Komutları

### Frontend

```bash
cd 1frontend
npm run dev
npm run build
npm run start
npm run lint
```

### Backend

```bash
cd 2backend
npm run start
npm run start:dev
npm run build
npm run start:prod
npm run lint
npm run test
npm run test:e2e
npm run test:cov
npm run seed
npm run seed:users
npm run seed:resources
npm run seed:organizers
```

### Prisma

```bash
cd 2backend
npx prisma generate
npx prisma migrate dev
npx prisma migrate deploy
npx prisma db push
```

`migrate dev` lokal migration geliştirmek için, `migrate deploy` mevcut migration'ları ortam veritabanına uygulamak için, `db push` hızlı geliştirme senaryoları için uygundur.

### Docker

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f python-workers
docker compose logs -f ai-service
docker compose down
```

## Veritabanı ve Seed

Prisma şeması `2backend/prisma/schema.prisma` dosyasındadır. Migration dosyaları `2backend/prisma/migrations` altında tutulur.

Önerilen geliştirme akışı:

1. Schema değişikliği yapın.
2. `npx prisma migrate dev` ile migration üretin.
3. `npx prisma generate` ile Prisma Client'ı güncelleyin.
4. Backend tip ve runtime davranışlarını kontrol edin.
5. Gerekirse seed dosyalarını güncelleyin.

Seed komutları:

```bash
npm run seed
npm run seed:users
npm run seed:resources
npm run seed:organizers
```

## Güvenlik

Mevcut güvenlik katmanları:

- JWT tabanlı kimlik doğrulama
- bcrypt ile parola hashleme
- Role/permission temelli backend guard yapısı
- Global DTO whitelist ve non-whitelisted alan reddi
- CORS allowlist
- Production ortamında mutating request origin kontrolü
- Temel security header'ları
- AI service için internal API key
- RabbitMQ kullanıcı/parola koruması
- Audit, login history ve system event kayıtları

Üretimde yapılması gerekenler:

- `JWT_SECRET`, RabbitMQ şifreleri, database şifreleri ve AI internal key değerlerini değiştirin.
- `.env` dosyalarını repoya koymayın.
- Demo kullanıcı şifrelerini kullanmayın.
- HTTPS terminasyonu ve reverse proxy ayarlarını production ortamında zorunlu tutun.
- Supabase, Resend ve benzeri dış servis key'lerini secret manager ile yönetin.

## Gözlemlenebilirlik

Sistem aşağıdaki gözlem noktalarına sahiptir:

- Worker metrics: `http://localhost:8000/metrics`
- Worker health: `http://localhost:8001/health`
- Worker readiness: `http://localhost:8001/ready`
- RabbitMQ Management UI: `http://localhost:15672`
- Backend `SystemEvent`, `AuditLog`, `LoginHistory`
- Entegrasyon kayıtları: `WebhookLog`, `IntegrationJob`, `N8nWorkflowRun`
- Raporlama/cache modelleri: `DailyMetric`, `ReportSnapshot`, `DashboardCache`
- SLA olayları: `SlaPolicy`, `SlaEvent`

## Üretim Dağıtımı

Üretim override dosyası `docker-compose.prod.yml` içinde alan adı ve production URL ayarları için kullanılır.

Örnek:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Üretim compose override'ında örnek alan adları:

- Frontend: `https://campusflow.com.tr`
- Backend API: `https://api.campusflow.com.tr`
- RabbitMQ Management: `https://mq.campusflow.com.tr`
