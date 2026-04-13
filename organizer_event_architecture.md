# Organizer Event Architecture — DB Schema + Portal Structure

## Amaç
Bu doküman, mevcut Campus Ops yapısını bozmadan aşağıdaki yeni event mimarisini tanımlar:

- Student mevcut `EventRequest` ile “şöyle bir etkinlik olsun” talebi açar
- Bu talepler `EVENT_COORDINATOR` rolüne düşer
- Organizer, uygun gördüğü fikir için bir `EventPlan` oluşturur
- Organizer önce:
  - reservation
  - access
  - procurement
  - equipment
  taleplerini açar
- Bu ön koşullar onaylandıktan sonra organizer resmi etkinlik oluşturma talebi açar
- Bu talep ayrı bir tablo ile yönetilir: `EventCreationRequest`
- Onay sonrası gerçek `Event` oluşur
- Öğrenciler `events/[id]` sayfasından etkinliğe kayıt olur
- Katılım süresi sonunda yeterli katılım varsa etkinlik kesinleşir, yoksa uzatma / erteleme / iptal yapılır

---

# 1. Mevcut Yapıda Korunacak Kısımlar

## Korunacaklar
- Student tarafındaki fikir talebi mevcut `EventRequest` tablosunda kalacak
- Bu talep `requests/[id]` detail sayfasında görünmeye devam edecek
- Organizer’ın gerçek yayınladığı etkinlik ise ayrı `Event` detail sayfasında duracak:
  - `events/[id]`

## Yeni yaklaşım
- Student `EventRequest` = idea / suggestion request
- Organizer request = ayrı tablo
- Organizer hazırlık akışı = `EventPlan`
- Gerçek etkinlik = `Event`

---

# 2. Yeni Eklenecek Tablolar

## 2.1 EventPlan
Organizer’ın bir öğrenci fikri veya iç ihtiyaç üzerinden oluşturduğu planlama üst objesi.

Amaç:
- reservation / access / procurement / equipment ön koşullarını tek yerde toplamak
- ön kayıt toplamak
- readiness kontrolü yapmak
- final event creation request’i başlatmak

### Önerilen Prisma modeli
```prisma
model EventPlan {
  id                     String      @id @default(cuid())
  sourceEventRequestId   String?
  organizerUserId        String
  title                  String
  description            String?
  eventType              String
  tentativeStartAt       DateTime?
  tentativeEndAt         DateTime?
  locationPreference     String?
  targetAttendance       Int?
  minimumAttendance      Int
  registrationStartAt    DateTime?
  registrationEndAt      DateTime?
  status                 String
  notes                  String?
  createdAt              DateTime    @default(now())
  updatedAt              DateTime    @updatedAt

  organizer              User        @relation(fields: [organizerUserId], references: [id], onDelete: Restrict)

  @@index([sourceEventRequestId])
  @@index([organizerUserId])
}
```

### Açıklamalar
- `sourceEventRequestId`: bu plan hangi student `EventRequest`’ten doğdu
- `minimumAttendance`: etkinliğin gerçekleşmesi için gereken minimum sayı
- `targetAttendance`: hedef katılım
- `registrationStartAt / registrationEndAt`: ön kayıt toplama penceresi
- `status`: örn. `DRAFT`, `IN_PREPARATION`, `WAITING_DEPENDENCIES`, `READY_FOR_EVENT_CREATION`, `REGISTRATION_OPEN`, `REGISTRATION_CLOSED`, `CANCELLED`

---

## 2.2 EventCreationRequest
Organizer’ın gerçek etkinliği oluşturmak için açtığı resmi talep.

Bu tablo request motoruna bağlı çalışmalı:
- üstte `Request`
- altta `EventCreationRequest`

### RequestType önerisi
`EVENT_CREATION_REQUEST`

### Önerilen Prisma modeli
```prisma
model EventCreationRequest {
  id                    String      @id @default(cuid())
  requestId             String      @unique
  eventPlanId           String      @unique
  organizerUserId       String
  title                 String
  description           String?
  eventType             String
  proposedStartAt       DateTime
  proposedEndAt         DateTime
  locationText          String?
  minimumAttendance     Int
  targetAttendance      Int?
  registrationStartAt   DateTime
  registrationEndAt     DateTime
  expectedBudget        Decimal?    @db.Decimal(12, 2)
  status                String
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  request               Request     @relation(fields: [requestId], references: [id], onDelete: Cascade)
  organizer             User        @relation(fields: [organizerUserId], references: [id], onDelete: Restrict)

  @@index([eventPlanId])
  @@index([organizerUserId])
}
```

### Açıklamalar
- `requestId`: request motoru ile tam entegrasyon
- `eventPlanId`: hangi hazırlık planından geldi
- `status`: creation request iç durumu
- bu request ayrı workflow ile onaylardan geçer

### Önerilen approval sırası
- `FACULTY_SECRETARY`
- `DEPARTMENT_CHAIR`
- `FINANCE_OFFICER`
- `BUDGET_APPROVER`
- `EVENT_COORDINATOR`

---

## 2.3 Event
Gerçek yayınlanmış etkinlik kaydı.

### Önerilen Prisma modeli
```prisma
model Event {
  id                      String      @id @default(cuid())
  eventPlanId             String?
  eventCreationRequestId  String?
  organizerUserId         String
  title                   String
  description             String?
  eventType               String
  locationText            String?
  startAt                 DateTime
  endAt                   DateTime
  status                  String
  minimumAttendance       Int
  targetAttendance        Int?
  registrationStartAt     DateTime?
  registrationEndAt       DateTime?
  registrationCount       Int         @default(0)
  publishedAt             DateTime?
  confirmedAt             DateTime?
  cancelledAt             DateTime?
  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt

  organizer               User        @relation(fields: [organizerUserId], references: [id], onDelete: Restrict)

  @@index([eventPlanId])
  @@index([eventCreationRequestId])
  @@index([organizerUserId])
  @@index([status])
}
```

### Açıklamalar
- `Event` öğrencilere görünen gerçek etkinliktir
- `events/[id]` sayfası bu tablodan beslenir

### Event status örnekleri
- `DRAFT`
- `PUBLISHED`
- `REGISTRATION_OPEN`
- `REGISTRATION_CLOSED`
- `CONFIRMED`
- `RESCHEDULED`
- `CANCELLED`
- `COMPLETED`

---

## 2.4 EventPlanRegistration
Gerçek event oluşmadan önce organizer planı için ilgi / ön kayıt toplamak amacıyla.

### Önerilen Prisma modeli
```prisma
model EventPlanRegistration {
  id            String      @id @default(cuid())
  eventPlanId   String
  userId        String
  status        String
  registeredAt  DateTime    @default(now())

  @@unique([eventPlanId, userId])
  @@index([eventPlanId])
  @@index([userId])
}
```

### Açıklamalar
- Bu kayıtlar gerçek event registration değildir
- “Yeterli talep var mı?” bunu ölçer
- `minimumAttendance` kontrolü burada yapılır

### Status örnekleri
- `REGISTERED`
- `CANCELLED`

---

## 2.5 EventRegistration
Gerçek etkinlik yayınlandıktan sonraki resmi kayıt.

### Önerilen Prisma modeli
```prisma
model EventRegistration {
  id              String      @id @default(cuid())
  eventId         String
  userId          String
  status          String
  registeredAt    DateTime    @default(now())
  cancelledAt     DateTime?
  attendanceAt    DateTime?

  @@unique([eventId, userId])
  @@index([eventId])
  @@index([userId])
}
```

### Status örnekleri
- `REGISTERED`
- `CANCELLED`
- `ATTENDED`
- `NO_SHOW`

---

## 2.6 EventDecisionLog
Katılım süresi sonrası verilen kararları saklamak için.

### Önerilen Prisma modeli
```prisma
model EventDecisionLog {
  id                    String      @id @default(cuid())
  eventPlanId           String?
  eventId               String?
  decidedByUserId       String
  decisionType          String
  reason                String?
  oldStartAt            DateTime?
  newStartAt            DateTime?
  oldRegistrationEndAt  DateTime?
  newRegistrationEndAt  DateTime?
  createdAt             DateTime    @default(now())

  @@index([eventPlanId])
  @@index([eventId])
  @@index([decidedByUserId])
}
```

### Decision type örnekleri
- `CONFIRMED`
- `EXTENDED_REGISTRATION`
- `RESCHEDULED`
- `CANCELLED`

---

# 3. Mevcut Tablolara Eklenecek Alanlar

Organizer’ın açtığı ön koşul taleplerini `EventPlan` ile bağlamak için şu tablolara `eventPlanId` eklenmeli:

## 3.1 RoomReservationRequest
```prisma
eventPlanId String?
```

## 3.2 AccessRequest
```prisma
eventPlanId String?
```

## 3.3 ProcurementRequest
```prisma
eventPlanId String?
```

## 3.4 EquipmentRequest
```prisma
eventPlanId String?
```

### Neden gerekli?
Çünkü organizer’ın açtığı:
- reservation
- access
- procurement
- equipment

requestleri aynı organizasyon planına bağlanmalı.

---

# 4. Yeni Role / RequestType İhtiyaçları

## 4.1 Yeni roller
Sistemde şu roller eklenmeli:

- `ORGANIZER`

### Kullanım biçimi
- `ORGANIZER`

## 4.2 Yeni RequestType
Organizer’ın resmi talebi için yeni request type eklenmeli:

- `EVENT_CREATION_REQUEST`

### Mevcut event idea request type
Student tarafında mevcut olan:
- `EVENT_REQUEST`

şeklinde kalır.

---

# 5. Akış Mimarisi

## 5.1 Student Idea Flow
1. Student mevcut `EventRequest` açar
2. Bu request `EVENT_COORDINATOR` queue’suna düşer
3. Coordinator talebi inceler
4. Uygun görürse organizer’a yönlendirir
5. Organizer bu request’ten `EventPlan` oluşturur

## 5.2 Organizer Planning Flow
1. Organizer `EventPlan` oluşturur
2. Plan için aşağıdaki talepleri açar:
   - `RoomReservationRequest`
   - `AccessRequest`
   - `ProcurementRequest`
   - `EquipmentRequest`
3. Tüm bu talepler `eventPlanId` ile bağlanır
4. Hepsi approved olunca plan “ready” hale gelir

## 5.3 Pre-registration Flow
1. Organizer plan için ön kayıt penceresi açar
2. Öğrenciler plan bazında ilgi / ön kayıt bırakır
3. Süre sonunda sayı kontrol edilir

## 5.4 Event Creation Request Flow
1. Minimum katılım sağlandıysa organizer `EventCreationRequest` açar
2. Bu request şu onaylardan geçer:
   - `FACULTY_SECRETARY`
   - `DEPARTMENT_CHAIR`
   - `FINANCE_OFFICER`
   - `BUDGET_APPROVER`
   - `EVENT_COORDINATOR`
3. Onay sonrası gerçek `Event` oluşturulur

## 5.5 Published Event Flow
1. Event `events/[id]` sayfasında yayınlanır
2. Öğrenciler event detail sayfasından kayıt olur
3. `EventRegistration` oluşur
4. Gerekirse event status ilerler:
   - `REGISTRATION_OPEN`
   - `REGISTRATION_CLOSED`
   - `CONFIRMED`
   - `COMPLETED`

---

# 6. Registration Süresi ve Katılım Kuralları

## EventPlan seviyesinde
Katılım yeterliliği gerçek event oluşmadan önce ölçülmelidir.

### Gerekli alanlar
- `minimumAttendance`
- `registrationStartAt`
- `registrationEndAt`

## Karar mantığı
Süre dolunca:

### Eğer
`EventPlanRegistration.count >= minimumAttendance`
ise:
- organizer `EventCreationRequest` açabilir

### Eğer yetersizse
şu kararlardan biri alınır:
- kayıt süresi uzatılır
- event ileri tarihe alınır
- plan iptal edilir

Bu kararlar `EventDecisionLog` ile saklanmalıdır.

---

# 7. Portal Yapısı

# 7.1 Student Portal

## Sayfa: `/student/events`
İki tab olmalı:

### Tab 1: Events
Gerçek yayınlanmış etkinlikler listelenir.

#### Liste kolonları
- title
- eventType
- startAt
- location
- registration status
- registration count
- minimum attendance

### Tab 2: Event Requests

mevcut liste yapısı

---

## Sayfa: `/student/events/[id]`
Gerçek event detail sayfası.

### Gösterilecekler
- event title
- description
- event type
- date / time
- location
- organizer
- registration period
- current registration count
- minimum attendance
- status

### Butonlar
- `Kayıt Ol`
- `Kaydımı İptal Et`

### Input gerekmez
Kullanıcı bilgileri sistemden çekilir.

---

## Sayfa: `/requests/[id]`
Student’ın açtığı `EventRequest` detay sayfası burada kalır.

### Gösterilecekler
- request no
- event name
- description
- event type
- created at
- request status
- comments
- workflow / approval history

---

# 7.2 Staff Queue (EVENT_COORDINATOR actor olarak)

Ayrı coordinator portal yoktur.  
Coordinator sadece staff panelinde ilgili queue’yu görür.

## Sayfa: `/staff/event-request-queue`
Student’ın açtığı event requestler burada görünür.

### Kim görür
- `STAFF + EVENT_COORDINATOR`
- `ADMIN`

### Liste kolonları
- requestNo
- eventName
- requester
- eventType
- createdAt
- faculty/department
- current status

### Butonlar
- `İncele`
- `Organizer’a yönlendir`
- `Reject`
- `Beklet`

---

# 7.3 Organizer Portal

## Sayfa: `/organizer/plans`
Organizer’ın tüm event planları.

### Liste kolonları
- title
- source event request
- tentativeStartAt
- reservation status
- access status
- procurement status
- equipment status
- preregistration count
- minimum attendance
- readiness status

### Filtreler
- draft
- waiting dependencies
- registration open
- ready for event creation
- cancelled

---

## Sayfa: `/organizer/plans/new`
Yeni plan oluşturma sayfası.

### Input alanları
- sourceEventRequestId (opsiyonel seçilir)
- title
- description
- eventType
- tentativeStartAt
- tentativeEndAt
- locationPreference
- minimumAttendance
- targetAttendance
- registrationStartAt
- registrationEndAt
- notes

---

## Sayfa: `/organizer/plans/[id]`
Plan detail sayfası.

### Sekmeler
- Overview
- Prerequisites
- Pre-Registrations
- Readiness Check
- Event Creation Request

---

### Sekme: Overview
Gösterilecekler:
- title
- description
- source event request link
- tentative dates
- location preference
- target / minimum attendance
- registration window
- status
- notes

### Butonlar
- `Düzenle`
- `Ön Kayıt Aç`
- `İptal Et`

---

### Sekme: Prerequisites
Buradan organizer 4 talebi açar.

#### Kartlar
- Reservation
- Access
- Procurement
- Equipment

Her kartta:
- mevcut request linki
- current status
- approved / rejected / pending badge

#### Butonlar
- `Reservation Talebi Aç`
- `Access Talebi Aç`
- `Procurement Talebi Aç`
- `Equipment Talebi Aç`

---

### Sekme: Pre-Registrations
EventPlan için ön kayıt sayfası.

#### Gösterilecekler
- current preregistration count
- minimumAttendance
- targetAttendance
- registrationStartAt
- registrationEndAt
- kayıt listesi

#### Butonlar
- `Süreyi Uzat`
- `Tarihi Ertele`
- `İptal Et`

---

### Sekme: Readiness Check
Sistem burada şunları göstermeli:

- Reservation: Approved / Pending / Rejected
- Access: Approved / Pending / Rejected
- Procurement: Approved / Pending / Rejected
- Equipment: Approved / Pending / Rejected
- Pre-registration count: X / minimumAttendance
- Event creation eligibility: Yes / No

#### Buton
- `Event Creation Request Aç`

Buton sadece eligibility sağlandıysa aktif olur.

---

### Sekme: Event Creation Request
Organizer’ın resmi event oluşturma requesti açtığı ekran.

### Input alanları
- title
- description
- eventType
- proposedStartAt
- proposedEndAt
- locationText
- minimumAttendance
- targetAttendance
- registrationStartAt
- registrationEndAt
- expectedBudget

### Gösterilecek snapshot alanları
- reservation approved status
- access approved status
- procurement approved status
- equipment approved status
- preregistration count

---

# 7.4 Approval Queue Sayfaları

Ayrı portal gerekmiyor; mevcut staff/admin queue yapısında çalışır.

## Sayfa örnekleri
- `/staff/event-creation-requests/faculty-secretary`
- `/staff/event-creation-requests/department-chair`
- `/staff/event-creation-requests/finance`
- `/staff/event-creation-requests/budget-approver`
- `/staff/event-creation-requests/event-coordinator`

### Kim görür
İlgili rol + admin

### Liste kolonları
- requestNo
- title
- organizer
- eventPlan
- expectedBudget
- start/end
- location
- createdAt
- current step

### Butonlar
- `Approve`
- `Reject`
- `Request Revision`

---

# 8. Sayfalardaki Input/Görünüm Özeti

## Student EventRequest açarken
### Inputlar
- eventName
- eventType
- description
- optional preferred date note
- optional location preference
- optional expectedAttendance

### Görünenler
- request status
- comments
- workflow history

---

## Organizer EventPlan oluştururken
### Inputlar
- sourceEventRequest
- title
- description
- eventType
- tentativeStartAt
- tentativeEndAt
- locationPreference
- minimumAttendance
- targetAttendance
- registrationStartAt
- registrationEndAt
- notes

### Görünenler
- linked student event request
- prerequisite cards
- readiness state

---

## Organizer EventCreationRequest açarken
### Inputlar
- title
- description
- eventType
- proposedStartAt
- proposedEndAt
- locationText
- minimumAttendance
- targetAttendance
- registrationStartAt
- registrationEndAt
- expectedBudget

### Görünenler
- prerequisite approval snapshot
- preregistration count
- event plan summary

---

## Event detail sayfasında
### Görünenler
- title
- description
- eventType
- location
- start/end
- organizer
- registration window
- current registration count
- status

### Butonlar
- `Kayıt Ol`
- `Kaydı İptal Et`

---

# 9. Temel İş Kuralları

1. Student’ın mevcut `EventRequest` yapısı korunur.
2. Organizer’ın resmi talebi ayrı tablo olur: `EventCreationRequest`.
3. Organizer’ın ön hazırlık süreci için `EventPlan` zorunludur.
4. Reservation, Access, Procurement, Equipment requestleri `eventPlanId` ile bağlanır.
5. Bu 4 ön koşul approved olmadan organizer event creation request açamaz.
6. Ön kayıt süresi `EventPlan` üzerinde yönetilir.
7. Ön kayıt sayısı `minimumAttendance` altında kalırsa:
   - süre uzatılır
   - tarih ertelenir
   - veya plan iptal edilir
8. Onaylı `EventCreationRequest` sonrası gerçek `Event` oluşur.
9. Student tarafında `/student/events` sayfasında iki tab bulunur:
   - Events
   - Event Requests
10. `EVENT_COORDINATOR` için ayrı portal yoktur; staff queue actor’ıdır.

---

# 10. Önerilen Sonraki Adım

Bu dokümandan sonra yapılacak teknik işler:
1. Prisma schema’ya yeni modelleri eklemek
2. Yeni request type eklemek: `EVENT_CREATION_REQUEST`
3. Organizer role seed’i eklemek
4. Event creation workflow seed’i yazmak
5. Organizer portal sayfalarını oluşturmak
6. Readiness evaluator servisi yazmak
7. Preregistration cron / deadline karar mekanizması eklemek
