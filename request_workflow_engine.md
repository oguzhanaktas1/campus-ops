# Campus Ops — Request & Workflow Engine Tasarımı

## 1. Amaç

Bu katman sistemin kalbidir. Çünkü uygulamadaki neredeyse tüm iş süreçleri önce bir **talep (Request)** olarak başlar, sonra bu talep bir **iş akışına (workflow)** girer, ilgili kişilere atanır, yorumlanır, onay/red alır, durum değiştirir ve en sonunda kapanır.

Bu yapı sayesinde:

- tüm request tipleri ortak bir omurgada çalışır
- modüller arasında tutarlılık sağlanır
- approval ve assignment süreçleri standart hale gelir
- geçmiş kayıtlar izlenebilir olur
- dashboard, audit, SLA ve notification sistemleri kolay bağlanır

Bu motorun ana tabloları:

- `RequestType`
- `Request`
- `RequestStatusHistory`
- `RequestAssignment`
- `RequestComment`
- `RequestWatcher`
- `WorkflowDefinition`
- `WorkflowStep`
- `WorkflowTransition`
- `WorkflowInstance`
- `WorkflowInstanceStep`
- `ApprovalAction`

---

## 2. Genel çalışma mantığı

Sistemin temel mantığı şu olmalı:

1. Kullanıcı bir form doldurur.
2. Sistem ilgili request tipini belirler.
3. `Request` kaydı açılır.
4. O request tipine ait özel tablo kaydı açılır.  
   Örnek: `InternshipRequest`, `ItTicket`, `RoomReservationRequest`
5. `RequestType` üzerinden uygun workflow bulunur.
6. `WorkflowInstance` oluşturulur.
7. İlk `WorkflowStep` aktif olur.
8. Gerekirse bir kullanıcıya veya role assignment yapılır.
9. Süreç boyunca:
   - yorumlar eklenir
   - status değişir
   - onay/red işlemleri yapılır
   - step geçmişi tutulur
10. Son step tamamlanınca request kapanır.

Kısacası:

**Request = işin business kaydı**  
**Workflow = işin nasıl ilerleyeceği**  
**Assignment = o an kim ilgileniyor**  
**ApprovalAction = kim hangi kararı verdi**  
**StatusHistory = süreç geçmişi**  
**Comment = iletişim/iz bırakma alanı**

---

## 3. Tabloların görevleri

## 3.1 `RequestType`

Her talep tipinin sistemdeki tanımıdır.

Örnek request type değerleri:

- internship_request
- equipment_request
- it_ticket
- room_reservation
- event_request
- access_request
- procurement_request
- document_request
- appointment_request

### Ne tutar?
- teknik anahtar (`key`)
- kullanıcıya görünen ad (`name`)
- kategori
- form schema bilgisi
- bağlı workflow tanımı
- aktif/pasif bilgisi

### Neden önemli?
Çünkü frontend formu, backend validation’ı ve workflow başlangıcı buradan belirlenir.

### Kullanım önerisi
Bir kullanıcı form açtığında önce request type bulunmalı. Request type yoksa request oluşturulmamalı.

---

## 3.2 `Request`

Tüm taleplerin ortak üst kaydıdır. Sistemin merkez tablosudur.

### Ne tutar?
- request numarası
- başlık
- açıklama
- genel status
- öncelik
- request’i açan kullanıcı
- şu an atanmış kullanıcı
- faculty / department / unit scope bilgisi
- bağlı workflow instance
- submit / due / close / complete tarihleri
- dinamik veri alanı

### Neden önemli?
Çünkü tüm modüller ortak olarak buraya bağlanır.

Örnek:
- `ItTicket` teknik detayları tutar
- ama üst business süreç `Request` üzerinde yürür

### Temel kural
Her domain request mutlaka bir `Request` kaydı ile başlamalıdır.  
Özel tablo tek başına açılmamalıdır.

---

## 3.3 `RequestStatusHistory`

Bir request’in status geçmişini tutar.

### Ne tutar?
- eski status
- yeni status
- değiştiren kullanıcı
- değişim sebebi
- değişim zamanı
- ek metadata

### Neden önemli?
Kullanıcılar ve yöneticiler şunu görebilmeli:

- request ne zaman submit edildi?
- kim review’e aldı?
- ne zaman approval beklemeye geçti?
- kim reject etti?
- ne zaman completed oldu?

### Kural
`Request.status` değiştiği her anda `RequestStatusHistory` kaydı oluşturulmalı.

---

## 3.4 `RequestAssignment`

Bir request’in kime, ne zaman atandığını tutar.

### Ne tutar?
- request
- atanan kullanıcı
- atayan kullanıcı
- not
- atanma zamanı
- unassign zamanı
- aktif mi?

### Neden önemli?
Çünkü `Request.currentAssigneeUserId` sadece şu anki sorumluyu gösterir.  
Ama geçmişte kimlere atandığı bilgisi ayrıca tutulmalıdır.

### Kullanım mantığı
Bir request el değiştirdiğinde:
- eski aktif assignment pasif yapılır
- yeni `RequestAssignment` açılır
- `Request.currentAssigneeUserId` güncellenir

---

## 3.5 `RequestComment`

Request üzerindeki yorumları tutar.

### Ne tutar?
- yorumu yazan kullanıcı
- yorum metni
- internal mi external mı?
- parent comment varsa reply ilişkisi
- tarih bilgileri

### Neden önemli?
Bu tablo request üzerindeki iletişim alanıdır.

### Kullanım mantığı
- requester ile staff arasındaki normal yazışmalar burada tutulur
- `isInternal = true` ise requester görmez
- staff kendi iç notlarını burada tutabilir
- reply sistemi sayesinde thread benzeri yapı olabilir

### Öneri
UI tarafında iki ayrı görünüm sun:
- public comments
- internal staff notes

---

## 3.6 `RequestWatcher`

Bir request’i takip eden kullanıcıları tutar.

### Kullanım amaçları
- request owner
- ilgili staff
- yönetici
- izlemek isteyen yetkili kullanıcı

### Neden önemli?
Watcher’lar otomatik notification için çok kullanışlıdır.

Örnek:
- status değişince watcher’lara bildirim
- assignment değişince watcher’lara bildirim
- comment gelince watcher’lara bildirim

---

## 3.7 `WorkflowDefinition`

Her request tipinin iş akışı şablonudur.

### Ne tutar?
- workflow anahtarı
- ad
- açıklama
- versiyon
- aktif/default bilgisi
- oluşturan kullanıcı

### Neden önemli?
Çünkü aynı request tipi farklı dönemlerde farklı workflow kullanabilir.

Örnek:
- internship approval v1
- internship approval v2

### Öneri
Workflow’ları kod içine gömmek yerine veri tabanı destekli tutman çok daha doğru.

---

## 3.8 `WorkflowStep`

Workflow içindeki adımları tanımlar.

### Ne tutar?
- step key
- step adı
- sıra numarası
- step türü
- atanacak rol
- atanacak unit
- atanacak kullanıcı
- zorunlu mu
- skip edilebilir mi
- SLA saat bilgisi
- config

### Step türü örnekleri
- START
- REVIEW
- APPROVAL
- REVISION
- ASSIGNMENT
- AUTO_ACTION
- END

### Kullanım mantığı
Bir workflow tanımında birden çok step bulunur.

Örnek internship workflow:
1. submit
2. advisor review
3. coordinator review
4. faculty approval
5. completed

---

## 3.9 `WorkflowTransition`

Bir adımdan diğer adıma hangi aksiyonla geçileceğini tanımlar.

### Ne tutar?
- from step
- to step
- action type
- koşul bilgisi

### Action örnekleri
- SUBMIT
- APPROVE
- REJECT
- REQUEST_REVISION
- ASSIGN
- ESCALATE
- CANCEL
- COMPLETE
- AUTO_TRANSITION

### Neden önemli?
Bu tablo olmadan workflow lineer kalır.  
Transition ile karar bazlı dallanma yapılır.

Örnek:
- advisor approve -> coordinator review
- advisor reject -> end/rejected
- advisor request revision -> revision step

---

## 3.10 `WorkflowInstance`

Belirli bir request için çalışan gerçek workflow örneğidir.

### Tanım
`WorkflowDefinition` şablondur.  
`WorkflowInstance` ise canlı çalışan süreçtir.

### Ne tutar?
- hangi workflow definition kullanıldı
- hangi request için açıldı
- current step
- status
- başladı mı bitti mi?

### Neden önemli?
Aynı workflow tanımı yüzlerce request için ayrı instance üretebilir.

---

## 3.11 `WorkflowInstanceStep`

Workflow’daki her adımın gerçek çalışma kaydıdır.

### Ne tutar?
- hangi workflow instance
- hangi workflow step
- kime atandı
- ne zaman başladı
- ne zaman tamamlandı
- status
- hangi action alındı
- action’ı kim yaptı
- not
- due date
- overdue bilgisi
- metadata

### Neden önemli?
Asıl operasyon takibi burada yapılır.

Örnek sorular:
- bu step kaç saat sürdü?
- kim tamamladı?
- SLA aşıldı mı?
- hangi adımda tıkandı?

Bu soruların cevabı `WorkflowInstanceStep` üzerinden çıkar.

---

## 3.12 `ApprovalAction`

Onay ve karar kayıtları için ayrı audit tablosudur.

### Ne tutar?
- request
- opsiyonel workflow instance step
- action type
- kararı veren kullanıcı
- decision note
- tarih

### Neden ayrı?
Çünkü her onay aksiyonu kritik bir iş kaydıdır.  
Bunu sadece status change ile bırakmak doğru olmaz.

### Kullanım mantığı
Şu durumlarda yazılmalı:
- approve
- reject
- revision request
- escalate
- cancel
- complete

---

## 4. İlişkilerin doğru mantığı

Aşağıdaki ilişki yapısını merkez al:

### RequestType -> Request
Bir request type’ın birçok request’i olabilir.

### Request -> Domain Table
Her request tipi kendi özel detay tablosuna bağlanır.  
Örnek:
- bir `Request` -> bir `InternshipRequest`
- bir `Request` -> bir `ItTicket`

### RequestType -> WorkflowDefinition
Bir request type genelde bir aktif workflow tanımına bağlı olur.

### WorkflowDefinition -> WorkflowStep
Bir workflow’un birden fazla step’i olur.

### WorkflowStep -> WorkflowTransition
Her step’ten bir veya daha fazla geçiş olabilir.

### Request -> WorkflowInstance
Her request için en fazla bir aktif workflow instance mantığı uygundur.

### WorkflowInstance -> WorkflowInstanceStep
Her aktif süreç, geçtiği tüm step’leri instance step olarak üretir.

### Request -> StatusHistory / Assignment / Comment / Approval / Watcher
Bunlar request çevresindeki operasyonel kayıtlar olur.

---

## 5. Request yaşam döngüsü nasıl olmalı?

Aşağıdaki akış çok sağlıklı bir temel olur.

## 5.1 Draft
Kullanıcı formu kaydeder ama submit etmez.

- `Request.status = DRAFT`
- henüz workflow başlamayabilir
- taslak güncellenebilir

## 5.2 Submit
Kullanıcı gönderir.

Bu anda:
- `Request.status = SUBMITTED`
- `submittedAt` set edilir
- `RequestStatusHistory` yazılır
- workflow instance açılır
- ilk step instance’ı oluşur
- ilk assignee belirlenir
- notification gönderilir

## 5.3 Review / Approval
İlgili kişi talebi inceler.

Olası aksiyonlar:
- approve
- reject
- request revision
- assign
- escalate

Bu aksiyonlarda:
- transition bulunur
- current step ilerler
- status güncellenir
- instance step tamamlanır
- gerekiyorsa yeni instance step başlatılır
- `ApprovalAction` ve history yazılır

## 5.4 Revision
Eksik belge veya düzenleme istenir.

Bu anda:
- request owner’a bildirim gider
- request tekrar kullanıcı aksiyonu bekler
- kullanıcı düzenleyip yeniden submit eder

## 5.5 Complete / Close
İş bittiyse:
- `Request.status = COMPLETED` veya `CLOSED`
- `completedAt` ya da `closedAt` yazılır
- workflow biter
- kapanış bildirimi gönderilir

---

## 6. Status ile workflow step aynı şey değildir

Bu çok kritik bir nokta.

### Request.status
Dış dünyaya gösterilen genel iş durumudur.

Örnek:
- DRAFT
- SUBMITTED
- IN_REVIEW
- WAITING_APPROVAL
- APPROVED
- REJECTED
- COMPLETED

### Workflow current step
O an iş akışında hangi iç adımda olduğunu gösterir.

Örnek:
- advisor_review
- faculty_secretary_check
- security_approval
- procurement_validation

Yani iki request aynı `IN_REVIEW` statüsünde olabilir ama biri advisor review’da, diğeri procurement review’da olabilir.

Bu yüzden:
- kullanıcı ekranında genel status göster
- staff detay ekranında current workflow step de göster

---

## 7. Assignment nasıl yönetilmeli?

## 7.1 Tek aktif assignee mantığı
Çoğu modülde bir request’in tek aktif sorumlusu olması daha sade olur.

Bu yüzden:
- `Request.currentAssigneeUserId` güncel kişiyi tutar
- `RequestAssignment` geçmişi tutar

## 7.2 Rol bazlı başlangıç
İlk adım kullanıcı yerine role atanabilir.

Örnek:
- `it_agent`
- `resource_manager`
- `document_officer`

Daha sonra o roldeki biri işi üstlenebilir.

## 7.3 Reassignment
İş farklı kullanıcıya geçerse:
- aktif assignment kapat
- yenisini aç
- request assignee güncelle
- history/comment/log üret

---

## 8. Comment yapısı nasıl yönetilmeli?

Her request detay sayfasında yorum sekmesi olmalı.

### Comment tipleri
1. requester-visible comment
2. internal staff comment

### Önerilen kurallar
- requester sadece public yorumları görsün
- staff hem public hem internal görsün
- internal yorumlar audit açısından silinmemeli, soft delete yapılmalı
- önemli aksiyonlar sırasında otomatik sistem yorumu da eklenebilir

Örnek sistem yorumları:
- "Request assigned to IT Agent"
- "Revision requested by Advisor"
- "Reservation approved and reservation created"

---

## 9. ApprovalAction neden ayrı tutulmalı?

Çünkü approval kritik karardır. Yorum tablosuna gömülmemeli.

Örnek:
- bölüm başkanı onay verdi
- advisor revizyon istedi
- IT manager reject etti

Bunlar karar kayıtlarıdır ve ayrı tutulmalıdır.

### Avantajları
- raporlaması kolay olur
- kim ne karar vermiş net görünür
- audit kolaylaşır
- approval history UI’da gösterilebilir

---

## 10. Backend servis katmanı nasıl olmalı?

Bu katmanı modüler kur:

## 10.1 Request Service
Sorumlulukları:
- request oluşturma
- request detay getirme
- request listeleme
- request scope filtreleme
- request status güncelleme

## 10.2 Workflow Service
Sorumlulukları:
- workflow başlatma
- current step bulma
- transition uygulama
- sonraki step üretme
- instance step kapatma/açma

## 10.3 Assignment Service
Sorumlulukları:
- assign
- reassign
- unassign
- active assignee yönetimi

## 10.4 Comment Service
Sorumlulukları:
- yorum ekleme
- internal/public ayrımı
- yorum listeleme

## 10.5 Approval Service
Sorumlulukları:
- approve
- reject
- revision request
- approval action kaydı

## 10.6 Notification Hook
Sorumlulukları:
- status değişince bildirim
- assignment değişince bildirim
- comment gelince bildirim
- approval sonucu bildirimi

---

## 11. API tasarımı nasıl olmalı?

Örnek endpoint yapısı:

### Request genel
- `POST /requests`
- `GET /requests`
- `GET /requests/:id`
- `PATCH /requests/:id`
- `POST /requests/:id/submit`
- `POST /requests/:id/cancel`

### Assignment
- `POST /requests/:id/assign`
- `POST /requests/:id/reassign`

### Comment
- `GET /requests/:id/comments`
- `POST /requests/:id/comments`

### Approval / workflow actions
- `POST /requests/:id/approve`
- `POST /requests/:id/reject`
- `POST /requests/:id/request-revision`
- `POST /requests/:id/complete`

### Workflow görünümü
- `GET /requests/:id/workflow`
- `GET /requests/:id/history`

Bu API’lerde aksiyon endpoint yaklaşımı çok uygundur.  
Çünkü workflow tabanlı sistemde her şey düz CRUD değildir.

---

## 12. Frontend ekran mantığı nasıl olmalı?

## 12.1 Request listesi
Kolonlar:
- request no
- title
- type
- requester
- current assignee
- status
- priority
- created at
- current step

## 12.2 Request detail
Sekmeli yapı önerilir:

- Overview
- Workflow
- Comments
- Assignments
- Approval History
- Files
- Activity Log

## 12.3 Workflow sekmesi
Gösterilecekler:
- current step
- tamamlanan step’ler
- pending step
- due date
- overdue bilgisi
- step action history

## 12.4 Staff action panel
Yetkiye göre butonlar:
- approve
- reject
- request revision
- assign
- escalate
- complete

---

## 13. Yetki mantığı nasıl kurulmalı?

Bu motor permission bazlı çalışmalı.

Örnek permission’lar:
- request.read.own
- request.read.scope
- request.read.all
- request.assign
- request.comment
- request.comment.internal
- request.approve
- request.reject
- request.request_revision
- workflow.manage
- workflow.read
- request.watch

### Rol mantığı
- student -> kendi requestlerini görür
- faculty/staff -> scope içindeki requestleri görür
- admin -> hepsini görür
- domain roller -> ilgili aksiyonları yapar

---

## 14. Audit ve raporlama mantığı

Bu motor güçlü raporlama sağlar.

Örnek metrikler:
- request tipi bazlı ortalama çözüm süresi
- step bazlı ortalama bekleme süresi
- en çok revizyona düşen süreçler
- en çok reject alan request tipleri
- SLA aşımı olan step’ler
- kişi bazlı işlem yoğunluğu

Bu yüzden:
- status history
- workflow instance step
- approval action
- assignment history

mutlaka doğru doldurulmalıdır.

---

## 15. En kritik iş kuralları

1. Her özel request önce `Request` üzerinden açılmalı.
2. `Request.status` değişince history yazılmalı.
3. Workflow aksiyonu ile status değişimi birlikte yönetilmeli.
4. Approval kararları ayrı tabloda tutulmalı.
5. Assignment geçmişi silinmemeli.
6. Internal comment requester’a gösterilmemeli.
7. Workflow definition ile workflow instance karıştırılmamalı.
8. Step seviyesi takip ile request seviyesi takip ayrı ele alınmalı.
9. Role bazlı başlangıç ataması desteklenmeli.
10. Tüm önemli aksiyonlar notification ve audit ile bağlanmalı.

---

## 16. Sana önerilen uygulama sırası

Bu motoru tek seferde değil, aşamalı kur:

### Faz 1
- `RequestType`
- `Request`
- `RequestStatusHistory`

### Faz 2
- `WorkflowDefinition`
- `WorkflowStep`
- `WorkflowTransition`
- `WorkflowInstance`
- `WorkflowInstanceStep`

### Faz 3
- `RequestAssignment`
- `RequestComment`
- `ApprovalAction`

### Faz 4
- `RequestWatcher`
- notification bağlantıları
- dashboard / activity görünümü

---

## 17. Sonuç

Bu yapı basit bir request tablosu değildir.  
Bu, sistemin merkezi iş akışı motorudur.

Doğru kurulduğunda sana şunları kazandırır:

- tüm domain modülleri için ortak omurga
- esnek approval ve review süreçleri
- temiz assignment yönetimi
- detaylı history ve audit
- güçlü dashboard ve raporlama
- büyümeye uygun mimari

Kısacası sistem şu mantıkla yaşamalı:

**Request açılır -> workflow başlar -> step’ler ilerler -> assignment ve approval çalışır -> history tutulur -> request kapanır**

