# Campus Ops — RabbitMQ + Python Worker Service Tasarımı

## Amaç

Bu doküman, **Campus Ops** projesinde RabbitMQ’nun **nerelerde kullanılacağını**, **hangi akışlara entegre edileceğini**, **hangi worker servislerinin çalışacağını** ve bu yapının mevcut teknoloji stack’ine göre nasıl uygulanacağını açıklar.

## Mevcut Stack

- **Frontend:** Next.js
- **Backend API:** NestJS
- **Cache / hızlı durum yönetimi / rate-limit / geçici state:** Redis
- **Veritabanı:** PostgreSQL (Supabase DB)
- **Mesajlaşma altyapısı:** RabbitMQ
- **Arka plan işleyici servisler:** Python worker service
- **Ana domain:** Campus request / workflow / approval / notification sistemi

---

## Neden RabbitMQ Kullanıyoruz?

Campus Ops içinde birçok işlem kullanıcıya anında cevap dönmeli, ama bazı işler arka planda güvenli ve ölçeklenebilir şekilde işlenmelidir.

RabbitMQ burada şu ihtiyaçları çözer:

- API response süresini düşürür
- ağır işleri arka plana taşır
- retry ve hata yönetimi sağlar
- servisleri gevşek bağlı hale getirir
- event tabanlı iş akışı kurmayı kolaylaştırır
- notification / email / reminder / document generation / escalation gibi işleri izole eder

### Kural
**State değişikliği önce NestJS + PostgreSQL tarafında yapılır.**  
RabbitMQ, state’in kendisi değil; **arka plan işlerinin taşınması** içindir.

---

## RabbitMQ Bu Projede Nerelerde Kullanılmalı?

RabbitMQ’yu tüm CRUD işlemleri için değil, **asenkron ve kullanıcıyı bekletmemesi gereken işler** için kullanacağız.

### Kullanılması gereken alanlar

1. **Notification üretimi**
2. **Email gönderimi**
3. **Workflow assignment sonrası arka plan işlemleri**
4. **Reminder / SLA / escalation işleri**
5. **Document generation / export işleri**
6. **Attachment processing**
7. **Audit enrichment / activity feed generation**
8. **Search indexing veya read-model güncelleme**
9. **External integration işleri**
10. **Heavy reporting / scheduled summary işlemleri**

### Kullanılmaması gereken yerler

Aşağıdaki işlemler doğrudan NestJS API + DB transaction ile çalışmalı:

- login / auth
- request create
- request approve / reject / revision kararının DB’ye yazılması
- request detail getirme
- dashboard için anlık kritik data yazımı
- authorization / RBAC check
- conflict check’in anlık cevap gerektiren kısmı

---

## Genel Mimari

```text
Next.js Frontend
   |
   v
NestJS API
   |
   |-- PostgreSQL (Supabase)
   |
   |-- Redis
   |
   |-- RabbitMQ Publisher
            |
            v
        RabbitMQ
            |
    -------------------------
    |     |      |     |    |
    v     v      v     v    v
 notif  email  workflow file report
worker worker  worker   worker worker
            |
            v
      Python Worker Service(s)
```

---

## Sistem Rolleri ile Bağlantı

Campus Ops’ta roller ve request tipleri çok olduğu için RabbitMQ özellikle role-based workflow sonrasında devreye girecek.

Örnek roller:
- student
- faculty
- staff
- admin

Örnek alt roller:
- advisor
- department chair
- faculty secretary
- internship coordinator
- it agent
- it manager
- resource manager
- procurement officer
- security officer
- document officer

Örnek request tipleri:
- document
- reservation
- appointment
- access request
- internship
- equipment
- event
- procurement
- it ticket

---

## RabbitMQ Kullanım Mantığı

### Temel yaklaşım

1. Kullanıcı Next.js üzerinden işlem başlatır
2. NestJS API validasyon yapar
3. PostgreSQL’e state değişikliği yazar
4. Gerekirse Redis cache / ephemeral state güncellenir
5. Sonra RabbitMQ’ya bir veya daha fazla event publish edilir
6. Python worker’lar ilgili queue’ları dinler
7. Worker işini yapar
8. Sonuç gerekiyorsa DB’ye yazar veya yeni event üretir

---

## Ana Event Kategorileri

Önerilen ana event grupları:

- `request.created`
- `request.updated`
- `request.cancelled`
- `workflow.assigned`
- `workflow.approved`
- `workflow.rejected`
- `workflow.revision_requested`
- `notification.create`
- `email.send`
- `reminder.schedule`
- `sla.check`
- `attachment.process`
- `document.generate`
- `report.generate`
- `search.index`
- `audit.append`

---

## Önerilen Exchange / Queue Yapısı

### Exchange
- `campusops.events` (topic exchange)

### Queue’lar
- `q.notifications`
- `q.emails`
- `q.workflow`
- `q.reminders`
- `q.attachments`
- `q.documents`
- `q.reports`
- `q.search`
- `q.audit`
- `q.deadletter`

### Routing key örnekleri
- `request.created`
- `workflow.assigned`
- `workflow.approved`
- `workflow.rejected`
- `workflow.revision_requested`
- `notification.create`
- `email.send`
- `attachment.process`
- `document.generate`
- `report.generate`
- `audit.append`

---

## Worker Servisleri

Python tarafında tek bir repo içinde birden fazla worker process ya da ayrı servisler olabilir.

### 1. Notification Worker

**Görevleri:**
- in-app notification üretmek
- role/user bazlı bildirim kaydı oluşturmak
- okunmamış bildirim sayısını etkileyecek eventleri işlemek
- websocket/push entegrasyonu varsa tetik üretmek

**Dinlediği eventler:**
- `workflow.assigned`
- `workflow.approved`
- `workflow.rejected`
- `workflow.revision_requested`
- `request.created` (bazı tipler için)
- `request.updated`

**Yazdığı alanlar:**
- PostgreSQL `notifications` tablosu
- gerekirse Redis unread count cache
- gerekirse websocket broadcast trigger

---

### 2. Email Worker

**Görevleri:**
- template bazlı email göndermek
- assignment email
- approval email
- rejection email
- revision request email
- reminder email
- escalation email

**Dinlediği eventler:**
- `email.send`
- `workflow.assigned`
- `workflow.approved`
- `workflow.rejected`
- `workflow.revision_requested`
- `reminder.schedule`

**En iyi pratikler:**
- template id kullan
- payload’a tüm user datasını değil gerekli id’leri koy
- gönderim logu tut
- retry + DLQ kur

---

### 3. Workflow Support Worker

**Görevleri:**
- workflow step sonrası yardımcı işlemler
- otomatik assignment
- role bazlı assignee resolution
- timeout kontrolü
- escalation logic
- reminder planlama
- bazı otomatik step geçişleri

**Dinlediği eventler:**
- `request.created`
- `workflow.assigned`
- `workflow.approved`
- `workflow.revision_requested`
- `sla.check`

**Örnek işler:**
- request tipi `internship` ise advisor bulundu mu?
- request tipi `it_ticket` ise department’e göre IT queue belirlendi mi?
- request 48 saat beklediyse reminder event’i oluştur
- step SLA aşıldıysa manager escalation üret

---

### 4. Reminder / SLA Worker

**Görevleri:**
- bekleyen işleri zaman bazlı kontrol etmek
- geciken approval süreçleri için reminder üretmek
- SLA breach tespiti
- escalation event üretmek

**Dinlediği eventler:**
- `reminder.schedule`
- `sla.check`

**Kullandığı yardımcı altyapı:**
- Redis: kısa süreli schedule marker / distributed lock / dedup
- PostgreSQL: kalıcı SLA kayıtları ve reminder logları

---

### 5. Attachment Processing Worker

**Görevleri:**
- yüklenen dosyaların metadata işlenmesi
- virüs tarama entegrasyonu varsa tetiklemek
- mime/type doğrulama
- thumbnail / preview üretme
- PDF parse veya OCR gerekiyorsa başlatma
- attachment status update

**Dinlediği eventler:**
- `attachment.process`

**Bağlandığı yerler:**
- Supabase storage veya ayrı object storage
- PostgreSQL attachment tablosu

---

### 6. Document Generation Worker

**Görevleri:**
- document request sonrası belge üretmek
- PDF oluşturmak
- approval summary export üretmek
- signed / stamped document pipeline’a bağlanmak
- transcript / certificate benzeri belgeler için hazır dosya hazırlamak

**Dinlediği eventler:**
- `document.generate`
- `workflow.approved` (belirli request tiplerinde)

---

### 7. Report Worker

**Görevleri:**
- ağır raporları üretmek
- haftalık / aylık özetler
- birim bazlı request istatistikleri
- export dosyaları
- admin dashboard materialized data generation

**Dinlediği eventler:**
- `report.generate`

---

### 8. Search / Read Model Worker

İleri seviye ama çok yararlı olabilir.

**Görevleri:**
- request ve workflow eventlerinden okunması hızlı listeler üretmek
- search index güncellemek
- dashboard read model güncellemek

**Dinlediği eventler:**
- `request.created`
- `request.updated`
- `workflow.assigned`
- `workflow.approved`
- `workflow.rejected`

---

### 9. Audit Worker

**Görevleri:**
- activity feed üretmek
- audit trail’i zenginleştirmek
- kim ne yaptı bilgisini normalized şekilde yazmak

**Dinlediği eventler:**
- `audit.append`
- ayrıca diğer ana eventler

---

## Request Tiplerine Göre RabbitMQ Akışları

---

## 1. Internship Request Akışı

### Senaryo
Öğrenci staj başvurusu açar.

### Sync taraf
NestJS:
- request kaydı oluşturur
- internship detail tablosuna yazar
- workflow instance başlatır
- ilk step’i advisor’a atar

### Async taraf
RabbitMQ eventleri:
- `workflow.assigned`
- `notification.create`
- `email.send`
- `audit.append`

### Worker işlemleri
- Notification worker: advisor’a bildirim
- Email worker: advisor’a assignment mail
- Audit worker: “internship request assigned”
- Reminder worker: 48 saat sonra cevap yoksa reminder planı

### Neden async?
Çünkü kullanıcı başvuruyu kaydederken email / reminder / audit yüzünden beklememeli.

---

## 2. IT Ticket Akışı

### Senaryo
Öğrenci veya staff bir IT ticket açar.

### Sync taraf
NestJS:
- ticket request oluşturur
- kategoriye göre queue/assignee belirler
- status `pending_review` veya `assigned` olur

### Async taraf
RabbitMQ eventleri:
- `workflow.assigned`
- `notification.create`
- `email.send`
- `sla.check`
- `audit.append`

### Worker işlemleri
- IT agent notification
- IT manager email opsiyonu
- SLA worker: first response süresi takibi
- Audit worker: olay kaydı

---

## 3. Reservation Request Akışı

### Senaryo
Faculty bir oda veya kaynak rezervasyonu talep eder.

### Sync taraf
- availability check
- conflict check
- request oluşturma
- workflow başlatma

### Async taraf
- `workflow.assigned`
- `notification.create`
- `email.send`
- `audit.append`

### Opsiyonel async
- takvim entegrasyonu varsa approval sonrası
- `reservation.calendar_sync`

Not:
Anlık conflict check genelde sync kalmalı. Çünkü kullanıcıya hemen cevap dönmeli.

---

## 4. Procurement Request Akışı

### Senaryo
Staff satın alma talebi açar.

### Sync taraf
- request kaydı
- procurement detail kaydı
- workflow başlatma

### Async taraf
- `workflow.assigned`
- `notification.create`
- `email.send`
- `attachment.process`
- `audit.append`

### Worker işlemleri
- teklif dosyaları doğrulanır
- eksik evrak kontrolü için reminder hazırlanır
- procurement officer bildirilir

---

## 5. Document Request Akışı

### Senaryo
Öğrenci bir resmi belge talep eder.

### Sync taraf
- request oluşturulur
- document officer veya ilgili ofise atanır

### Async taraf
- `workflow.assigned`
- `notification.create`
- `email.send`
- approval sonrası `document.generate`

### Worker işlemleri
- belgeyi PDF olarak hazırlar
- indirilebilir link üretir
- hazır olunca kullanıcıya bildirim yollar

---

## 6. Event Request Akışı

### Senaryo
Bir etkinlik talebi açılır.

### Sync taraf
- event request kaydedilir
- approval chain başlatılır

### Async taraf
- `workflow.assigned`
- `notification.create`
- `email.send`
- `attachment.process`
- `audit.append`

### Genişletilebilir taraf
- security review
- facility setup reminder
- event summary generation

---

## 7. Access Request Akışı

### Senaryo
Bir kullanıcı belirli alana / sisteme erişim talep eder.

### Sync taraf
- request create
- gerekli role / unit’e atama
- approval state update

### Async taraf
- `workflow.assigned`
- `notification.create`
- `email.send`
- approval sonrası external integration varsa provisioning event

---

## Redis Bu Yapıda Nerede Kullanılmalı?

Redis, RabbitMQ’nun alternatifi değil; tamamlayıcısıdır.

### Redis kullanım alanları
- unread notification count cache
- distributed lock
- worker dedup / idempotency key
- rate limiting
- short-lived OTP / token / temporary workflow state
- dashboard counters için hızlı cache
- reminder scheduler yardımcı state

### Redis kullanılmaması gereken yerler
- kalıcı request state
- workflow ana kaydı
- approval history
- audit trail
- legal / resmi kayıtlar

Bunlar PostgreSQL’de tutulmalı.

---

## PostgreSQL (Supabase) Bu Yapıda Nerede?

PostgreSQL ana source of truth’tur.

### Kalıcı tutulacak yapılar
- users
- roles
- departments
- requests
- request detail tabloları
- workflow instances
- workflow steps
- comments
- attachments metadata
- notifications
- email logs
- audit logs
- reminder logs
- report jobs
- document jobs

---

## Örnek Event Payload Prensibi

Payload’larda gereksiz veri taşınmamalı. Mümkün olduğunca id bazlı gidilmeli.

### `workflow.assigned`
```json
{
  "event": "workflow.assigned",
  "requestId": "req_123",
  "requestType": "internship",
  "workflowInstanceId": "wf_789",
  "stepCode": "advisor_review",
  "assigneeUserId": "usr_45",
  "assigneeRole": "advisor",
  "triggeredByUserId": "usr_12",
  "occurredAt": "2026-04-15T10:00:00Z"
}
```

### `email.send`
```json
{
  "event": "email.send",
  "template": "workflow_assigned",
  "recipientUserId": "usr_45",
  "requestId": "req_123",
  "context": {
    "requestType": "internship",
    "stepCode": "advisor_review"
  }
}
```

### `attachment.process`
```json
{
  "event": "attachment.process",
  "attachmentId": "att_77",
  "requestId": "req_555",
  "storageKey": "requests/req_555/file1.pdf",
  "mimeType": "application/pdf"
}
```

---

## NestJS Tarafında Nerede Publish Edilecek?

Publish işlemi genelde şu application service katmanlarında yapılmalı:

- request create service
- request decision service
- workflow transition service
- attachment upload completion hook
- report generation trigger service
- document generation trigger service

### Öneri
Publish işlemini controller içinde dağınık yapma.  
Bunu service layer içinde, domain action tamamlandıktan sonra yap.

---

## Transaction Stratejisi

### Önerilen akış
1. DB transaction içinde request/state değişikliği yap
2. transaction commit et
3. sonra RabbitMQ event publish et

### Daha sağlam yapı
İleride gerekirse **Outbox Pattern** kullan:
- event önce DB’de outbox tablosuna yazılır
- ayrı publisher process bunu RabbitMQ’ya yollar

Bu, event kaybolması riskini azaltır.

---

## Retry / Error / DLQ Stratejisi

Her worker için aşağıdakiler olmalı:

- retry count
- exponential backoff
- dead-letter queue
- structured log
- correlation id
- idempotency check

### Örnek
Email provider fail etti:
- mesaj hemen kaybolmaz
- tekrar denenir
- yine olmazsa DLQ’ya gider
- admin panelde veya log sisteminde görünür

---

## Idempotency Gereksinimi

Worker aynı mesajı iki kez alabilir. Bu yüzden:

- aynı notification iki kez oluşturulmamalı
- aynı mail iki kez gönderilmemeli
- aynı PDF iki kez generate edilmemeli
- aynı reminder tekrar tekrar patlamamalı

### Çözüm
- Redis idempotency key
- DB unique constraint
- processed_messages tablosu
- job status kontrolü

---

## Önerilen Python Worker Repo Yapısı

```text
python-workers/
├── app/
│   ├── consumers/
│   │   ├── notification_consumer.py
│   │   ├── email_consumer.py
│   │   ├── workflow_consumer.py
│   │   ├── reminder_consumer.py
│   │   ├── attachment_consumer.py
│   │   ├── document_consumer.py
│   │   ├── report_consumer.py
│   │   └── audit_consumer.py
│   │
│   ├── handlers/
│   │   ├── notification_handler.py
│   │   ├── email_handler.py
│   │   ├── workflow_handler.py
│   │   ├── reminder_handler.py
│   │   ├── attachment_handler.py
│   │   ├── document_handler.py
│   │   ├── report_handler.py
│   │   └── audit_handler.py
│   │
│   ├── services/
│   │   ├── db_service.py
│   │   ├── redis_service.py
│   │   ├── mail_service.py
│   │   ├── storage_service.py
│   │   └── rabbitmq_service.py
│   │
│   ├── models/
│   ├── schemas/
│   ├── config/
│   └── main.py
│
├── requirements.txt
└── docker-compose.yml
```

---

## Önerilen NestJS Entegrasyon Noktaları

```text
apps/api/src/
├── modules/
│   ├── requests/
│   ├── workflow/
│   ├── notifications/
│   ├── attachments/
│   ├── reports/
│   └── documents/
│
├── infrastructure/
│   ├── rabbitmq/
│   │   ├── rabbitmq.module.ts
│   │   ├── rabbitmq.publisher.ts
│   │   └── routing-keys.ts
│   │
│   ├── redis/
│   └── database/
```

---

## Hangi Modülde Hangi Event Çıkmalı?

### Requests module
- `request.created`
- `request.updated`
- `request.cancelled`

### Workflow module
- `workflow.assigned`
- `workflow.approved`
- `workflow.rejected`
- `workflow.revision_requested`

### Attachments module
- `attachment.process`

### Documents module
- `document.generate`

### Reports module
- `report.generate`

### Notifications module
Genelde consumer tarafı ama bazı durumlarda doğrudan `notification.create` publish edilebilir.

---

## Uygulama Sırası Önerisi

Bu yapıyı tek seferde değil aşamalı kurmak en doğrusu.

### Faz 1
- RabbitMQ kurulumu
- NestJS publisher
- Python notification worker
- Python email worker
- temel DLQ yapısı

### Faz 2
- workflow support worker
- reminder / SLA worker
- audit worker

### Faz 3
- attachment processing
- document generation
- report generation

### Faz 4
- outbox pattern
- advanced idempotency
- monitoring / tracing / metrics

---

## En Değerli İlk Kullanım Alanları

Bu projede ilk kurulması en mantıklı RabbitMQ kullanım alanları:

1. **workflow assignment notification**
2. **email sending**
3. **approval / rejection sonrası bildirim**
4. **reminder / escalation**
5. **document generation**
6. **attachment processing**

Bunlar en hızlı fayda sağlar.

---

## Son Mimari Karar Özeti

### NestJS
- source of command handling
- validation
- auth
- RBAC
- workflow state change
- DB write

### RabbitMQ
- async event distribution
- background task taşıma
- retry / decoupling

### Python Worker Service
- notification
- email
- reminder
- SLA
- file/document/report processing
- audit support

### Redis
- cache
- lock
- dedup
- idempotency
- temp counters

### PostgreSQL (Supabase)
- source of truth
- all permanent business data

---

## Kısa Sonuç

Campus Ops içinde RabbitMQ, request’in kendisini değil; request sonrası çalışan asenkron iş akışlarını taşımalıdır.  
Ana karar ve state değişiklikleri NestJS + PostgreSQL’de yapılmalı, ardından RabbitMQ ile Python worker servislerine event gönderilmelidir.  
Bu worker’lar notification, email, reminder, SLA, attachment processing, document generation, report generation ve audit destek işlerini üstlenmelidir.

Bu yaklaşım:
- sistemi daha ölçeklenebilir yapar
- API’yi hızlandırır
- worker bazlı sorumluluk ayrımı sağlar
- retry ve hata yönetimini güçlendirir
- Campus Ops gibi çok akışlı bir projeye uygun temiz bir mimari sunar
