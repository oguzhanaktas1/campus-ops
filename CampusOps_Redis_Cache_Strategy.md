# CampusOps Redis Cache Strategy

## Amaç

Bu belge, CampusOps projesinde Redis'in **cache**, **queue**, **rate limit** ve **ephemeral state** için nasıl kullanılacağını tanımlar.

Bu projede Redis'in rolü:

- PostgreSQL'in yerine geçmek değil
- sık okunan verileri hızlandırmak
- pahalı sorguları hafifletmek
- background işleri kuyruklamak
- kısa ömürlü state yönetmek

---

# 1. Temel Prensip

## Source of truth
- **PostgreSQL = gerçek veri kaynağı**
- **Redis = hız katmanı**
- **BullMQ = async iş katmanı**

Redis burada kalıcı iş verisinin ana kaynağı değildir.

---

# 2. Redis Nerelerde Kullanılmalı?

## 2.1 Cache
Aşağıdaki veri türlerinde:

- dashboard summary
- request list sonuçları
- request detail response
- approval listeleri
- ticket listeleri
- resource availability
- unread notification count
- analytics chart dataset'leri
- report preview sonuçları
- dropdown/reference data

## 2.2 Queue
Aşağıdaki background işler için:

- email gönderme
- notification dağıtımı
- report generation
- SLA kontrolü
- reminder job'ları
- webhook retry
- AI summary / triage job'ları

## 2.3 Ephemeral state
Aşağıdaki kısa ömürlü veriler için:

- rate limit sayaçları
- password reset / OTP token
- autosave draft
- lock mekanizmaları
- idempotency key

---

# 3. Sayfa Bazlı Redis Kullanımı

## 3.1 Admin Pages

### `/admin/dashboard`
#### Cache'lenecek
- summary cards
- widget data
- grouped counters
- open/overdue counts

#### Key
```txt
admin:dashboard:summary
admin:dashboard:cards
admin:dashboard:widgets
```

#### TTL
- 30–60 saniye

---

### `/admin/requests`
#### Cache'lenecek
- filtreli request listesi
- status counts
- first page result

#### Key
```txt
admin:requests:list:{filterHash}
admin:requests:summary
```

#### TTL
- 15–30 saniye

---

### `/admin/users`
#### Cache'lenecek
- users list
- user count summary
- role/faculty/department/unit filter data

#### Key
```txt
admin:users:list:{filterHash}
admin:users:summary
reference:roles
reference:faculties
reference:departments
reference:units
```

#### TTL
- list: 30–60 saniye
- reference data: 10–30 dakika

---

### `/admin/workflows`
#### Cache'lenecek
- workflow listesi
- workflow summary
- request type / role / unit reference data

#### Key
```txt
admin:workflows:list:{filterHash}
admin:workflows:summary
reference:request-types
reference:roles
reference:units
```

#### TTL
- list: 30–60 saniye
- reference data: 10–30 dakika

---

### `/admin/workflow-instances`
#### Cache'lenecek
- filtered workflow instance list
- active/completed/overdue counts

#### Key
```txt
admin:workflow-instances:list:{filterHash}
admin:workflow-instances:summary
```

#### TTL
- 15–30 saniye

---

### `/admin/sla`
#### Cache'lenecek
- SLA policy list
- violation summary
- grouped chart data

#### Key
```txt
admin:sla:policies
admin:sla:summary
admin:sla:charts:{rangeHash}
```

#### TTL
- policies: 5 dakika
- summary/charts: 1–5 dakika

---

### `/admin/analytics`
#### Cache'lenecek
- KPI cards
- chart datasets
- trend data
- grouped aggregates

#### Key
```txt
admin:analytics:kpis:{rangeHash}
admin:analytics:charts:{rangeHash}
admin:analytics:filters:{filterHash}
```

#### TTL
- 5–15 dakika

#### Not
Bu sayfa için sadece Redis değil, `DailyMetric` gibi pre-aggregated tablolar da kullanılmalı.

---

### `/admin/reports`
#### Cache'lenecek
- report preview
- generated snapshot list
- filtered aggregate data

#### Key
```txt
admin:reports:list:{filterHash}
admin:reports:preview:{reportHash}
```

#### TTL
- 5–15 dakika

#### Not
Gerçek report generation sync değil queue üzerinden çalışmalı.

---

### `/admin/audit-logs`
#### Cache'lenecek
- first page log results
- grouped action counts
- summary cards

#### Key
```txt
admin:audit-logs:list:{filterHash}
admin:audit-logs:summary
```

#### TTL
- list: 10–20 saniye
- summary: 30–60 saniye

---

### `/admin/system-events`
#### Cache'lenecek
- recent event list
- severity counts
- critical/warning summary

#### Key
```txt
admin:system-events:list:{filterHash}
admin:system-events:summary
```

#### TTL
- 10–20 saniye

---

### `/admin/webhook-logs`
#### Cache'lenecek
- recent webhook execution list
- status counts
- retryable failure count

#### Key
```txt
admin:webhook-logs:list:{filterHash}
admin:webhook-logs:summary
```

#### TTL
- 10–20 saniye

---

### `/admin/integrations`
#### Cache'lenecek
- integration list
- health summary
- run count
- recent failures

#### Key
```txt
admin:integrations:list
admin:integrations:summary
admin:integrations:health
```

#### TTL
- 30–60 saniye

---

## 3.2 Faculty Pages

### `/faculty/approvals`
#### Cache'lenecek
- pending approvals list
- overdue approval counts
- approval summary

#### Key
```txt
faculty:approvals:list:{userId}:{filterHash}
faculty:approvals:summary:{userId}
```

#### TTL
- list: 15–30 saniye
- summary: 30–60 saniye

---

### `/faculty/tickets`
#### Cache'lenecek
- ticket list
- status counts
- assigned-to-me counts

#### Key
```txt
faculty:tickets:list:{userId}:{filterHash}
faculty:tickets:summary:{userId}
```

#### TTL
- 15–30 saniye

---

## 3.3 Staff Pages

### `/staff/tickets`
#### Cache'lenecek
- queue list
- workload summary
- SLA breached counts

#### Key
```txt
staff:tickets:list:{userId}:{filterHash}
staff:tickets:summary:{scopeHash}
staff:tickets:workload:{scopeHash}
```

#### TTL
- list: 15 saniye
- summary: 30 saniye
- workload: 30–60 saniye

---

### `/staff/reports`
#### Cache'lenecek
- report result json
- chart data
- grouped metrics
- export preview summary

#### Key
```txt
staff:reports:{userId}:{filterHash}
staff:reports:charts:{scopeHash}:{rangeHash}
```

#### TTL
- 5–15 dakika

---

## 3.4 Student New Pages

### `/student/reservations/new`
#### Cache'lenecek
- resource list
- resource availability
- faculty/department/unit dropdown data

#### Key
```txt
reference:resources:{filterHash}
resource:availability:{resourceId}:{date}
reference:faculties
reference:departments:{facultyId}
```

#### TTL
- resource list: 5 dakika
- availability: 30–60 saniye
- reference data: 30 dakika

---

### `/student/appointments/new`
#### Cache'lenecek
- faculty/staff selectable user list
- target user availability
- appointment type reference data

#### Key
```txt
reference:appointment-targets:{scopeHash}
user:availability:{userId}
user:appointments:summary:{userId}:{dateRange}
```

#### TTL
- target list: 10 dakika
- availability: 30–60 saniye
- appointment summary: 30 saniye

---

### `/student/equipment/new`
#### Cache'lenecek
- equipment categories
- labs/resource list
- stock summary
- dropdown/reference data

#### Key
```txt
reference:equipment:categories
reference:labs:{scopeHash}
equipment:stock:summary:{labId}
```

#### TTL
- categories: 30 dakika
- labs: 10 dakika
- stock summary: 1–5 dakika

---

# 4. Shared Cache Endpoints

## Request detail
### Endpoint
```txt
GET /requests/:id/detail
```

### Key
```txt
request:detail:{portal}:{requestId}:{userId}
```

### TTL
- 20–60 saniye

### Invalidasyon
- comment create/update
- file upload
- status change
- assignment change
- approval action
- workflow step change

---

## Notification unread count
### Key
```txt
notifications:unread:{userId}
```

### Mantık
- create → `INCR`
- mark as read → `DECR`
- gerektiğinde DB'den tam recalc

---

## Resource availability
### Key
```txt
resource:availability:{resourceId}:{yyyy-mm-dd}
```

### TTL
- 30–120 saniye

### Invalidasyon
- reservation create
- reservation approve
- reservation cancel
- reservation update

---

# 5. Cache Key Naming Standard

Projede bütün key'ler standardize edilmeli.

## Önerilen format

```txt
dashboard:{portal}:{scope}
requests:list:{portal}:{scope}:{filterHash}
request:detail:{requestId}:v{version}
notifications:unread:{userId}
resource:availability:{resourceId}:{date}
ratelimit:{action}:{actor}
job:lock:{entity}:{id}
analytics:{portal}:{rangeHash}
reports:{portal}:{filterHash}
reference:{entity}:{scopeHash}
```

---

# 6. TTL Standard

## Kısa TTL
Canlıya yakın veriler:
- ticket list
- approvals
- workflow instance list
- system events
- webhook logs

### TTL
- 10–30 saniye

## Orta TTL
Dashboard ve summary veriler:
- dashboard cards
- request list
- detail cache
- unread counts

### TTL
- 30–60 saniye

## Uzun TTL
Nadiren değişen veriler:
- dropdown/reference data
- request types
- faculties/departments/units
- categories

### TTL
- 10–30 dakika

## Daha uzun TTL
Analytics/report preview:
- KPI dataset
- historical chart data

### TTL
- 5–15 dakika

---

# 7. Invalidasyon Stratejisi

## Yanlış yaklaşım
Her yerde `delByPattern('*')` tarzı agresif silme.

## Doğru yaklaşım
Version-based invalidation veya targeted key silme.

## Önerilen model

### Version key örneği
```txt
request:list:version = 12
dashboard:version = 3
workflow:version = 8
```

### Cache key örneği
```txt
admin:requests:list:v12:{filterHash}
admin:dashboard:v3
admin:workflows:list:v8:{filterHash}
```

### Avantajı
- pattern delete ihtiyacı azalır
- cache invalidation daha güvenli olur
- production'da daha temiz yönetilir

---

# 8. NestJS Cache Katmanı

## CacheService zorunlu
Projede raw Redis client doğrudan her serviste kullanılmamalı.

## Önerilen metodlar

```ts
get<T>(key: string): Promise<T | null>
set(key: string, value: unknown, ttlSeconds: number): Promise<void>
del(key: string): Promise<void>
getOrSet<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T>
incr(key: string): Promise<number>
decr(key: string): Promise<number>
```

## En önemli metod
`getOrSet`

Mantık:
1. Redis'ten kontrol et
2. varsa dön
3. yoksa DB'den hesapla
4. Redis'e yaz
5. dön

---

# 9. Query Service Katmanı

Her sayfanın cache mantığı query service katmanında tutulmalı.

## Önerilen servisler

```txt
AdminDashboardQueryService
AdminRequestsQueryService
AdminAnalyticsQueryService
FacultyApprovalsQueryService
FacultyTicketsQueryService
StaffTicketsQueryService
StaffReportsQueryService
StudentReservationFormQueryService
StudentAppointmentFormQueryService
RequestDetailService
```

Bu servisler:
- DB query yazar
- cache key builder kullanır
- `CacheService` ile cache uygular

---

# 10. BullMQ Kullanımı

Redis varsa BullMQ eklemek çok mantıklı.

## Queue'ya atılacak işler
- email gönderimi
- notification fan-out
- SLA checker
- daily metrics refresh
- dashboard warmup
- report generation
- AI summary generation
- n8n retry işleri

## Önerilen queue isimleri
```txt
emailQueue
notificationQueue
slaQueue
reportQueue
aiQueue
integrationQueue
```

---

# 11. Rate Limiting

Redis aşağıdaki endpointlerde rate limit için kullanılmalı:

- login
- forgot password
- AI endpoints
- comment create
- request create
- file upload

## Key örnekleri
```txt
ratelimit:login:{ip}
ratelimit:ai:{userId}
ratelimit:comment:{userId}
ratelimit:create-request:{userId}
```

---

# 12. Lock Kullanımı

Aynı işi iki worker'ın aynı anda yapmasını önlemek için Redis lock kullanılmalı.

## Kullanım alanları
- reservation conflict check
- duplicate escalation
- duplicate report generation
- same request için double processing
- integration retry dedup

## Key örnekleri
```txt
job:lock:reservation:{resourceId}:{date}
job:lock:request:{requestId}
job:lock:report:{reportHash}
```

---

# 13. Redis Kullanılmaması Gereken Yerler

Redis'i şu alanlarda ana kaynak olarak kullanma:

- request create transaction
- approval transaction
- access grant truth data
- procurement final state
- audit log source of truth
- workflow state source of truth

Bu alanlarda DB her zaman ana kaynak olmalı.

---

# 14. Docker Önerisi

## Basit docker service

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: campusops-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    restart: unless-stopped
```

## Production notları
- public internete açma
- password kullan
- internal network kullan
- memory policy belirle
- persistence ihtiyacını değerlendir

---

# 15. Implementation Öncelik Sırası

## Faz 1
Hemen yapılacaklar:
1. Redis ekle
2. CacheService yaz
3. `/admin/dashboard` cache
4. `/admin/requests` cache
5. `/faculty/approvals` cache
6. `/staff/tickets` cache
7. `GET /requests/:id/detail` cache
8. unread notification count cache

## Faz 2
9. `student/reservations/new` reference + availability cache
10. `student/appointments/new` cache
11. `admin/users` cache
12. `admin/workflows` cache
13. `admin/workflow-instances` cache

## Faz 3
14. `admin/analytics` cache
15. `admin/reports` cache
16. `staff/reports` cache
17. `admin/sla` cache

## Faz 4
18. audit/system/webhook/integration log ekranları
19. BullMQ queue
20. rate limit
21. distributed lock
22. version-based invalidation

---

# 16. Final Karar

Bu projede Redis:

- **dashboard**
- **filtered table results**
- **request detail**
- **reference data**
- **availability data**
- **notification counts**
- **analytics/report data**
- **queue/rate limit/lock**

için kullanılmalı.

## En net mimari cümlesi
**Redis bu projede tam sayfa cache için değil; veri bloklarını hızlandırmak, pahalı sorguları hafifletmek ve background işleri kuyruklamak için kullanılmalıdır.**

Yani:
- PostgreSQL = gerçek veri
- Redis = hız katmanı
- BullMQ = async iş katmanı
