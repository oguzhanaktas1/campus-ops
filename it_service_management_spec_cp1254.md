# IT Service Management Module Spec

module: IT_SERVICE_MANAGEMENT

## 1. Amaç
Campus Ops içinde IT support süreçlerini standart, izlenebilir ve SLA bazlý yönetmek.

Kapsam:
- help desk
- ticket yönetimi
- triage
- atama
- çözüm akýþý
- SLA takibi
- overdue / escalation
- benzer ticket eþleþtirme
- asset / lokasyon bazlý tekrar eden sorun analizi

---

## 2. Kullanýlan Tablolar

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

## 3. Roller ve Görünürlük Kurallarý

### 3.1 Ticket açabilen kullanýcýlar
Aþaðýdaki kullanýcýlar IT ticket açabilir:
- FACULTY
- STAFF
- STUDENT
- ADMIN

Not:
STAFF rolüne sahip herkes ticket açabilir.
Ancak IT iþlemlerini sadece IT birimi yapar.

### 3.2 IT birimi kimdir?
IT birimi:
- STAFF + IT_AGENT
- STAFF + IT_MANAGER

Bu kullanýcýlar ticket iþleme yetkisine sahiptir.

### 3.3 Görünürlük kurallarý

#### Faculty
- yeni IT ticket açabilir
- kendi açtýðý ticketleri görebilir
- kendi ticketlerine yorum ekleyebilir
- WAITING_USER durumunda ek bilgi verebilir
- RESOLVED durumunda kapatmayý onaylayabilir veya reopen isteyebilir

#### Staff (IT birimi olmayan staff)
- yeni IT ticket açabilir
- sadece kendi açtýðý ticketleri görebilir
- baþkalarýnýn IT ticketlerini göremez
- ticket çözüm iþlemi yapamaz

#### Staff + IT_AGENT
- kendine atanmýþ ticketleri görür
- kendi kuyruðundaki ticketlerde iþlem yapar
- public/internal comment ekler
- kullanýcýdan bilgi ister
- çözüm özeti girerek resolve eder
- gerekirse escalate ister

#### Staff + IT_MANAGER
- triage kuyruðunu görür
- yeni gelen ticketleri sýnýflandýrýr
- priority doðrular/deðiþtirir
- kategori doðrular/deðiþtirir
- agent atar / yeniden atar
- overdue ve SLA riskli iþleri görür
- reject / escalate / close / reopen gibi yönetim aksiyonlarýný yapabilir

#### Admin
- tüm ticketleri görür
- tüm aksiyonlarý yapabilir

### 3.4 Temel görünürlük özeti
- ticket owner -> sadece kendi ticketleri
- IT_AGENT -> kendine atanmýþ ticketler
- IT_MANAGER -> tüm IT ticketlar + triage + overdue
- ADMIN -> tüm kayýtlar

---

## 4. Ticket Akýþý

### Ana akýþ
1. ticket açýlýr
2. submit edilir
3. triage yapýlýr
4. agent atanýr
5. SLA timer çalýþýr
6. agent çalýþýr
7. gerekiyorsa kullanýcýdan bilgi istenir
8. çözüm özeti girilir
9. resolved olur
10. kullanýcý doðrular veya manager kapatýr
11. closed olur

### Alternatif akýþlar
- invalid / IT dýþý ise reject
- çözüm sonrasý sorun devam ederse reopen
- SLA aþýlýrsa escalation
- benzer geçmiþ ticket varsa similarity önerisi

---

## 5. Ticket Status Mantýðý

ItTicket.ticketStatus deðerleri:
- OPEN
- TRIAGED
- IN_PROGRESS
- WAITING_USER
- RESOLVED
- CLOSED
- REOPENED

Önerilen kullaným:
- OPEN -> yeni açýldý
- TRIAGED -> manager ilk incelemeyi yaptý
- IN_PROGRESS -> agent aktif çalýþýyor
- WAITING_USER -> kullanýcýdan bilgi bekleniyor
- RESOLVED -> teknik çözüm uygulandý
- CLOSED -> süreç tamamen kapandý
- REOPENED -> kapandýktan sonra yeniden açýldý

Not:
RESOLVED ile CLOSED ayný þey deðildir.

---

## 6. Zaman Takibi / SLA Mantýðý

### Takip edilmesi gereken zamanlar
- ticket açýlýþ zamaný
- first response zamaný
- assignment zamaný
- in progress baþlangýcý
- resolved zamaný
- closed zamaný
- toplam çözüm süresi
- bekleme süresi
- reopen sayýsý

### Hesaplanacak metrikler
- ticket ne zaman açýldý
- kaç dakika/saat sonra ilk geri dönüþ yapýldý
- kaç dakika/saat sonra çözüldü
- kaç dakika/saat sonra kapandý
- SLA breach oldu mu
- hangi step overdue oldu

### SLA ile ilgili tablolar
- SlaPolicy -> requestType + priority bazlý kurallar
- SlaEvent -> first response / resolution / escalation eventleri

### SLA temel kurallar
- submit olunca SLA baþlar
- first meaningful IT action olunca first response kapanýr
- resolved/closed olunca resolution SLA kapanýr
- süre aþýlýrsa escalation oluþur

---

## 7. Ekranlar

### 7.1 Kullanýcýnýn kendi ticket listesi
Kim görür:
- FACULTY
- STAFF
- STUDENT
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
- açýklar
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
- Kapatmayý onayla

CLOSED ise:
- sadece görüntüleme

---

### 7.2 Ticket detay ekraný
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

Overview alanlarý:
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

### 7.3 IT triage kuyruðu
Kim görür:
- IT_MANAGER
- ADMIN

Amaç:
- yeni gelen ticketlarý sýnýflandýrmak
- öncelik doðrulamak
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
- Priority deðiþtir
- Kategori deðiþtir
- Agent ata
- Revizyon iste
- Reject
- Escalate
- Kendim üstlen

---

### 7.4 IT agent çalýþma kuyruðu
Kim görür:
- IT_AGENT
- IT_MANAGER
- ADMIN

Amaç:
- kendine atanmýþ iþleri görmek
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
- Ýþi üstlen
- In progress yap
- Kullanýcýdan bilgi iste
- Ýç not ekle
- Public yorum ekle
- Baþka agente devret
- Çözüldü olarak iþaretle
- Escalate et

---

### 7.5 SLA / overdue dashboard
Kim görür:
- IT_MANAGER
- ADMIN

Amaç:
- geciken iþleri görmek
- escalation gerekenleri izlemek

Gösterimler:
- overdue ticket count
- first response breach count
- resolution breach count
- escalation count
- agent bazlý workload
- priority bazlý daðýlým
- category bazlý daðýlým

---

### 7.6 Asset / lokasyon bazlý ticket görünümü
Kim görür:
- IT_MANAGER
- IT_AGENT
- ADMIN

Amaç:
- ayný cihaz veya ayný odada tekrarlayan sorunlarý görmek

Filtreler:
- assetId
- locationText
- category
- date range

Gösterimler:
- ayný cihazdaki açýk ticketlar
- geçmiþte ayný cihaz için açýlan ticketlar
- ayný lokasyondaki tekrar eden problemler
- TicketSimilarityMatch önerileri

---

## 8. Endpoint Tasarýmý

### 8.1 Genel oluþturma
POST /it-tickets
- yeni ticket açar
- Request create
- ItTicket create
- draft veya submit mantýðý

POST /it-tickets/:id/submit
- ticket submit eder
- request status update
- workflow instance create
- first step create
- SLA start

---

### 8.2 Listeleme
GET /it-tickets/my
- kullanýcýnýn kendi ticketlarý

GET /it-tickets/triage
- IT manager triage kuyruðu

GET /it-tickets/assigned
- agent’ýn kendine atanmýþ ticketlarý

GET /it-tickets/overdue
- overdue / SLA riskli ticketlar

GET /it-tickets/:id
- detay ekraný

---

### 8.3 Operasyonel action endpointleri
POST /it-tickets/:id/assign
- IT manager ticket’ý agente atar

POST /it-tickets/:id/reassign
- atamayý deðiþtirir

POST /it-tickets/:id/start-progress
- ticket’ý IN_PROGRESS yapar

POST /it-tickets/:id/request-user-info
- kullanýcýdan bilgi ister
- WAITING_USER yapar

POST /it-tickets/:id/resolve
- resolutionSummary ile RESOLVED yapar

POST /it-tickets/:id/close
- ticket’ý CLOSED yapar

POST /it-tickets/:id/reopen
- ticket’ý yeniden açar

POST /it-tickets/:id/reject
- geçersiz / IT dýþý ticketý reddeder

POST /it-tickets/:id/escalate
- üst seviyeye taþýr

POST /it-tickets/:id/change-priority
- priority deðiþtirir

POST /it-tickets/:id/change-category
- kategori düzeltir

---

### 8.4 Yorum endpointleri
GET /it-tickets/:id/comments
- yorumlarý getirir

POST /it-tickets/:id/comments
- public comment ekler

POST /it-tickets/:id/internal-comments
- internal comment ekler

---

### 8.5 Workflow / SLA endpointleri
GET /it-tickets/:id/workflow
- workflow geçmiþi

GET /it-tickets/:id/sla
- SLA durumu

GET /it-tickets/:id/activity
- status + assignment + approval + audit birleþik akýþ

---

## 9. Endpoint -> Tablo Yazým Haritasý

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
- SlaEvent resolution kapanýþý
- Notification

### POST /it-tickets/:id/reopen
Yazar:
- ItTicket.ticketStatus = REOPENED
- ItTicket.reopenedCount + 1
- Request.status tekrar açýk duruma alýnýr
- RequestStatusHistory
- yeni workflow step gerekirse açýlýr
- yeni assignment gerekirse yapýlýr
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

### TicketSimilarityMatch kullaným amacý
Yeni ticket açýldýðýnda veya triage sýrasýnda:
- benzer geçmiþ ticketlarý bul
- geçmiþ çözüm özetlerini öner
- duplicate kontrolü yap

### Kullaným önerileri
- ayný assetId
- ayný affectedSystem
- benzer title/description
- ayný locationText
- son 30/60/90 gün ticketlarý

### Çözüm havuzu mantýðý
Çözülen ticketlardan:
- category
- subcategory
- affectedSystem
- resolutionSummary
- benzerlik skoru

üzerinden öneri listesi üret.

Örnek:
- "Benzer 3 ticket bulundu"
- "Bu cihaz için geçen hafta ayný problem çözülmüþ"
- "Önerilen çözüm: printer spooler reset"

---

## 11. Bildirim Kurallarý

Notification üretilmeli:
- ticket submit edildi
- ticket atandý
- kullanýcýdan bilgi istendi
- ticket resolved oldu
- ticket closed oldu
- ticket reopened oldu
- SLA breach oldu
- escalation tetiklendi

---

## 12. Dikkat Edilecek Kritik Kurallar

1. Faculty ticket açabilir ve sadece kendi ticketlerini görür.
2. IT birimi olmayan staff da ticket açabilir ama sadece kendi ticketlerini görür.
3. IT iþlemlerini sadece:
   - STAFF + IT_AGENT
   - STAFF + IT_MANAGER
   yapar.
4. Yeni gönderilen ticketlar IT manager ve/veya IT agent havuzuna düþer.
5. Triage öncelikle IT manager tarafýndan yapýlýr.
6. ResolutionSummary boþken resolve yapýlamaz.
7. RESOLVED ile CLOSED ayrý tutulur.
8. WAITING_USER durumunda kullanýcýya revize / bilgi gönderme imkaný olmalý.
9. Reopen kontrollü olmalý.
10. Zaman takibi zorunlu olmalý.

---

## 13. Baþlangýç Ýçin Minimum Uygulanabilir Versiyon

Ýlk versiyonda mutlaka olsun:
- ticket create
- my tickets
- ticket detail
- triage queue
- assigned queue
- resolve / close / reopen
- public/internal comments
- SLA basic tracking
- assignment history

Sonraki aþamada eklenebilir:
- similarity suggestions
- auto assignment
- analytics
- asset heatmap
- bulk actions
