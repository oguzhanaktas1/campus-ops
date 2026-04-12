# IT Service Management Module Spec

module: itticket

## 1. Amaç
Campus Ops içinde IT support süreçlerini standart, izlenebilir ve SLA bazlı yönetmek.

Kapsam:
- help desk
- ticket yönetimi
- triage
- atama
- çözüm akışı
- SLA takibi
- overdue / escalation
- benzer ticket eşleştirme
- asset / lokasyon bazlı tekrar eden sorun analizi

---

## 2. Kullanılan Tablolar

- Request
- ItTicket
- SlaPolicy
- SlaEvent
- TicketSimilarityMatch
- RequestAssignment
- RequestComment
- Notification
- WorkflowInstance
- WorkflowInstanceStep
- RequestStatusHistory
- ApprovalAction

---

## 3. Roller ve Görünürlük Kuralları

### 3.1 Ticket açabilen kullanıcılar
Aşağıdaki kullanıcılar IT ticket açabilir:
- FACULTY
- STAFF

Not:
staff it agent ve it manager yani it birimi olan stafflar dışında ki staff rolune sahipler it ticket açabilir it birimleri sadece onlara gelen it ticketleri görür işlemleri it birimi yapar. açılan gönderilen it ticketlar it manager ve it agent rolune sahip kulanıcılara gitmeli ve ticketi onlar çözmeli.

### 3.2 IT birimi kimdir?
IT birimi:
- STAFF + IT_AGENT
- STAFF + IT_MANAGER

Bu kullanıcılar ticket işleme yetkisine sahiptir.

### 3.3 Görünürlük kuralları

#### Faculty
- yeni IT ticket açabilir
- kendi açtığı ticketleri görebilir
- kendi ticketlerine yorum ekleyebilir
- WAITING_USER durumunda ek bilgi verebilir
- RESOLVED durumunda kapatmayı onaylayabilir veya reopen isteyebilir

#### Staff (IT birimi olmayan staff)
- yeni IT ticket açabilir
- sadece kendi açtığı ticketleri görebilir
- başkalarının IT ticketlerini göremez
- ticket çözüm işlemi yapamaz

#### Staff + IT_AGENT
- kendine atanmış ticketleri görür
- kendi kuyruğundaki ticketlerde işlem yapar
- public/internal comment ekler
- kullanıcıdan bilgi ister
- çözüm özeti girerek resolve eder
- gerekirse escalate ister

#### Staff + IT_MANAGER
- triage kuyruğunu görür
- yeni gelen ticketleri sınıflandırır
- priority doğrular/değiştirir
- kategori doğrular/değiştirir
- agent atar / yeniden atar
- overdue ve SLA riskli işleri görür
- reject / escalate / close / reopen gibi yönetim aksiyonlarını yapabilir

#### Admin
- tüm ticketleri görür
- tüm aksiyonları yapabilir

### 3.4 Temel görünürlük özeti
- ticket owner -> sadece kendi ticketleri
- IT_AGENT -> kendine atanmış ticketler
- IT_MANAGER -> tüm IT ticketlar + triage + overdue
- ADMIN -> tüm kayıtlar

---

## 4. Ticket Akışı

### Ana akış
1. ticket açılır
2. submit edilir
3. triage yapılır
4. agent atanır
5. SLA timer çalışır
6. agent çalışır
7. gerekiyorsa kullanıcıdan bilgi istenir
8. çözüm özeti girilir
9. resolved olur
10. kullanıcı doğrular veya manager kapatır
11. closed olur

### Alternatif akışlar
- invalid / IT dışı ise reject
- çözüm sonrası sorun devam ederse reopen
- SLA aşılırsa escalation
- benzer geçmiş ticket varsa similarity önerisi

---

## 5. Ticket Status Mantığı

ItTicket.ticketStatus değerleri:
- OPEN
- TRIAGED
- IN_PROGRESS
- WAITING_USER
- RESOLVED
- CLOSED
- REOPENED

Önerilen kullanım:
- OPEN -> yeni açıldı
- TRIAGED -> manager ilk incelemeyi yaptı
- IN_PROGRESS -> agent aktif çalışıyor
- WAITING_USER -> kullanıcıdan bilgi bekleniyor
- RESOLVED -> teknik çözüm uygulandı
- CLOSED -> süreç tamamen kapandı
- REOPENED -> kapandıktan sonra yeniden açıldı

Not:
RESOLVED ile CLOSED aynı şey değildir.

---

## 6. Zaman Takibi / SLA Mantığı

### Takip edilmesi gereken zamanlar
- ticket açılış zamanı
- first response zamanı
- assignment zamanı
- in progress başlangıcı
- resolved zamanı
- closed zamanı
- toplam çözüm süresi
- bekleme süresi
- reopen sayısı

### Hesaplanacak metrikler
- ticket ne zaman açıldı
- kaç dakika/saat sonra ilk geri dönüş yapıldı
- kaç dakika/saat sonra çözüldü
- kaç dakika/saat sonra kapandı
- SLA breach oldu mu
- hangi step overdue oldu

### SLA ile ilgili tablolar
- SlaPolicy -> requestType + priority bazlı kurallar
- SlaEvent -> first response / resolution / escalation eventleri

### SLA temel kurallar
- submit olunca SLA başlar
- first meaningful IT action olunca first response kapanır
- resolved/closed olunca resolution SLA kapanır
- süre aşılırsa escalation oluşur

---

## 7. Ekranlar

### 7.1 Kullanıcının kendi ticket listesi
Kim görür:
- FACULTY
- STAFF
- ADMIN

Kolonlar:
- requestNo
- title
- category
- ticketStatus
- priority
- currentAssignee
- createdAt
- updatedAt

Filtreler:
- açıklar
- çözülenler
- kapananlar
- revizyon bekleyenler
- yüksek öncelikli olanlar

Butonlar:
- Detay
- Yorum ekle
- Dosya yükle
- Ek bilgi gönder

WAITING_USER ise:
- Revize et / bilgi gönder
- Yorum ekle
- Dosya yükle

RESOLVED ise:
- Sorun devam ediyor
- Kapatmayı onayla

CLOSED ise:
- sadece görüntüleme

---

### 7.2 Ticket detay ekranı
Kim görür:
- owner
- assigned IT agent
- IT manager
- admin

Sekmeler:
- Overview
- Comments
- Activity
- Workflow
- SLA
- Files
- Assignment History

Overview alanları:
- requestNo
- title
- description
- category
- subcategory
- affectedSystem
- assetId
- locationText
- incidentStartedAt
- priority
- requestStatus
- ticketStatus
- currentAssignee
- createdAt
- updatedAt
- resolutionSummary
- resolvedAt
- closedAt

Comments:
- public comments
- internal notes
- system comments

Activity:
- status history
- assignment history
- action/approval history

Workflow:
- current step
- completed steps
- step action history
- dueAt
- overdue state

SLA:
- first response deadline
- resolution deadline
- escalation deadline
- breach state

---

### 7.3 IT triage kuyruğu
Kim görür:
- STAFF + IT_MANAGER
- ADMIN

Amaç:
- yeni gelen ticketları sınıflandırmak
- öncelik doğrulamak
- agent atamak

Kolonlar:
- requestNo
- title
- reporter
- priority
- category
- affectedSystem
- createdAt
- SLA badge
- assignee

Butonlar:
- Detay aç
- Priority değiştir
- Kategori değiştir
- Agent ata
- Revizyon iste
- Reject
- Escalate
- Kendim üstlen

---

### 7.4 IT agent çalışma kuyruğu
Kim görür:
- STAFF + IT_AGENT
- STAFF + IT_MANAGER
- ADMIN

Amaç:
- kendine atanmış işleri görmek
- çözüm sürecini yürütmek

Sekmeler:
- Assigned to me
- In progress
- Waiting user
- Resolved today
- Overdue

Kolonlar:
- requestNo
- title
- reporter
- category
- priority
- assetId
- locationText
- SLA state
- startedAt

Butonlar:
- İşi üstlen
- In progress yap
- Kullanıcıdan bilgi iste
- İç not ekle
- Public yorum ekle
- Başka agente devret
- Çözüldü olarak işaretle
- Escalate et

---

### 7.5 SLA / overdue dashboard
Kim görür:
- staff + IT_MANAGER
- ADMIN

Amaç:
- geciken işleri görmek
- escalation gerekenleri izlemek

Gösterimler:
- overdue ticket count
- first response breach count
- resolution breach count
- escalation count
- agent bazlı workload
- priority bazlı dağılım
- category bazlı dağılım

---

### 7.6 Asset / lokasyon bazlı ticket görünümü
Kim görür:
- STAFFV + IT_MANAGER
- STAFFV + IT_AGENT
- ADMIN

Amaç:
- aynı cihaz veya aynı odada tekrarlayan sorunları görmek

Filtreler:
- assetId
- locationText
- category
- date range

Gösterimler:
- aynı cihazdaki açık ticketlar
- geçmişte aynı cihaz için açılan ticketlar
- aynı lokasyondaki tekrar eden problemler
- TicketSimilarityMatch önerileri

---

## 8. Endpoint Tasarımı

### 8.1 Genel oluşturma
POST /it-tickets
- yeni ticket açar
- Request create
- ItTicket create
- draft veya submit mantığı

POST /it-tickets/:id/submit
- ticket submit eder
- request status update
- workflow instance create
- first step create
- SLA start

---

### 8.2 Listeleme
GET /it-tickets/my
- kullanıcının kendi ticketları

GET /it-tickets/triage
- IT manager triage kuyruğu

GET /it-tickets/assigned
- agent’ın kendine atanmış ticketları

GET /it-tickets/overdue
- overdue / SLA riskli ticketlar

GET /it-tickets/:id
- detay ekranı

---

### 8.3 Operasyonel action endpointleri
POST /it-tickets/:id/assign
- IT manager ticket’ı agente atar

POST /it-tickets/:id/reassign
- atamayı değiştirir

POST /it-tickets/:id/start-progress
- ticket’ı IN_PROGRESS yapar

POST /it-tickets/:id/request-user-info
- kullanıcıdan bilgi ister
- WAITING_USER yapar

POST /it-tickets/:id/resolve
- resolutionSummary ile RESOLVED yapar

POST /it-tickets/:id/close
- ticket’ı CLOSED yapar

POST /it-tickets/:id/reopen
- ticket’ı yeniden açar

POST /it-tickets/:id/reject
- geçersiz / IT dışı ticketı reddeder

POST /it-tickets/:id/escalate
- üst seviyeye taşır

POST /it-tickets/:id/change-priority
- priority değiştirir

POST /it-tickets/:id/change-category
- kategori düzeltir

---

### 8.4 Yorum endpointleri
GET /it-tickets/:id/comments
- yorumları getirir

POST /it-tickets/:id/comments
- public comment ekler

POST /it-tickets/:id/internal-comments
- internal comment ekler

---

### 8.5 Workflow / SLA endpointleri
GET /it-tickets/:id/workflow
- workflow geçmişi

GET /it-tickets/:id/sla
- SLA durumu

GET /it-tickets/:id/activity
- status + assignment + approval + audit birleşik akış

---

## 9. Endpoint -> Tablo Yazım Haritası

### POST /it-tickets
Yazar:
- Request
- ItTicket

### POST /it-tickets/:id/submit
Yazar:
- Request.status
- RequestStatusHistory
- WorkflowInstance
- WorkflowInstanceStep
- SlaEvent

### POST /it-tickets/:id/assign
Yazar:
- Request.currentAssigneeUserId
- RequestAssignment
- ItTicket.assignedItUserId
- aktif WorkflowInstanceStep.assignedToUserId

### POST /it-tickets/:id/reassign
Yazar:
- Request.currentAssigneeUserId
- RequestAssignment
- ItTicket.assignedItUserId
- aktif WorkflowInstanceStep.assignedToUserId

### POST /it-tickets/:id/start-progress
Yazar:
- ItTicket.ticketStatus = IN_PROGRESS
- Request.status update
- RequestStatusHistory
- workflow action log

### POST /it-tickets/:id/request-user-info
Yazar:
- ItTicket.ticketStatus = WAITING_USER
- Request.status update
- RequestComment
- WorkflowInstanceStep complete
- yeni WorkflowInstanceStep
- ApprovalAction veya action log
- Notification

### POST /it-tickets/:id/resolve
Yazar:
- ItTicket.ticketStatus = RESOLVED
- ItTicket.resolutionSummary
- ItTicket.resolvedAt
- Request.status
- RequestStatusHistory
- WorkflowInstanceStep
- ApprovalAction
- SlaEvent resolution kontrolü
- Notification

### POST /it-tickets/:id/close
Yazar:
- ItTicket.ticketStatus = CLOSED
- ItTicket.closedAt
- Request.status = CLOSED/COMPLETED
- RequestStatusHistory
- workflow finalizasyonu
- SlaEvent resolution kapanışı
- Notification

### POST /it-tickets/:id/reopen
Yazar:
- ItTicket.ticketStatus = REOPENED
- ItTicket.reopenedCount + 1
- Request.status tekrar açık duruma alınır
- RequestStatusHistory
- yeni workflow step gerekirse açılır
- yeni assignment gerekirse yapılır
- Notification

### POST /it-tickets/:id/reject
Yazar:
- ItTicket.ticketStatus update
- Request.status = REJECTED
- RequestStatusHistory
- WorkflowInstanceStep complete
- ApprovalAction
- Notification

### POST /it-tickets/:id/change-priority
Yazar:
- Request.priority
- RequestStatusHistory veya audit log
- SLA recalculation gerekiyorsa SlaEvent

### POST /it-tickets/:id/change-category
Yazar:
- ItTicket.category
- ItTicket.subcategory
- audit/action log

---

## 10. Similarity / Çözüm Havuzu

### TicketSimilarityMatch kullanım amacı
Yeni ticket açıldığında veya triage sırasında:
- benzer geçmiş ticketları bul
- geçmiş çözüm özetlerini öner
- duplicate kontrolü yap

### Kullanım önerileri
- aynı assetId
- aynı affectedSystem
- benzer title/description
- aynı locationText
- son 30/60/90 gün ticketları

### Çözüm havuzu mantığı
Çözülen ticketlardan:
- category
- subcategory
- affectedSystem
- resolutionSummary
- benzerlik skoru

üzerinden öneri listesi üret.

Örnek:
- "Benzer 3 ticket bulundu"
- "Bu cihaz için geçen hafta aynı problem çözülmüş"
- "Önerilen çözüm: printer spooler reset"

---

## 11. Bildirim Kuralları

Notification üretilmeli:
- ticket submit edildi
- ticket atandı
- kullanıcıdan bilgi istendi
- ticket resolved oldu
- ticket closed oldu
- ticket reopened oldu
- SLA breach oldu
- escalation tetiklendi

---

## 12. Dikkat Edilecek Kritik Kurallar

1. Faculty ticket açabilir ve sadece kendi ticketlerini görür.
2. IT birimi olmayan staff da ticket açabilir ama sadece kendi ticketlerini görür.
3. IT işlemlerini sadece:
   - STAFF + IT_AGENT
   - STAFF + IT_MANAGER
   yapar.
4. Yeni gönderilen ticketlar IT manager ve/veya IT agent havuzuna düşer.
5. Triage öncelikle IT manager tarafından yapılır.
6. ResolutionSummary boşken resolve yapılamaz.
7. RESOLVED ile CLOSED ayrı tutulur.
8. WAITING_USER durumunda kullanıcıya revize / bilgi gönderme imkanı olmalı.
9. Reopen kontrollü olmalı.
10. Zaman takibi zorunlu olmalı.

---

## 13. Başlangıç İçin Minimum Uygulanabilir Versiyon

İlk versiyonda mutlaka olsun:
- ticket create
- my tickets
- ticket detail
- triage queue
- assigned queue
- resolve / close / reopen
- public/internal comments
- SLA basic tracking
- assignment history

Sonraki aşamada eklenebilir:
- similarity suggestions
- auto assignment
- analytics
- asset heatmap
- bulk actions
