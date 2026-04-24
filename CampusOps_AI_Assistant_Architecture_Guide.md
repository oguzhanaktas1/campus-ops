# CampusOps AI Assistant Architecture Guide

## Amaç

Bu belge, CampusOps projesi içinde çalışacak **role-aware AI assistant** mimarisini tanımlar.

Assistant’ın amacı:
- sistem içi sorulara doğal dilde cevap vermek
- role + subrole + scope aware olmak
- yetki dışı veri göstermemek
- CampusOps içindeki gerçek verilere dayanarak cevap vermek
- gerektiğinde tıklanabilir link, kart, özet ve yönlendirme döndürmek

Bu assistant sıradan bir chatbot değildir.
Bu yapı, **CampusOps operational copilot** mantığıyla kurulmalıdır.

---

# 1. Temel Mimari Yaklaşım

Assistant şu mantıkla çalışmalıdır:

```txt
Frontend Assistant Widget
    ↓
NestJS API
    ↓
Python AI Service
    ↓
Intent Router + Tool Layer + Permission Layer
    ↓
Gemma Local Model
    ↓
Structured JSON Response
```

## Kritik kural
Model doğrudan veriyi "uydurmamalı".
Model:
- soruyu anlamalı
- intent belirlemeli
- doğru tool’u seçmeli
- dönen veriyi doğal dile çevirmeli

Yani modelin görevi:
- **generate truth** değil
- **interpret trusted system data**

---

# 2. Assistant Ne Yapmalı?

Assistant şu tür görevleri yerine getirmeli:

## 2.1 Natural conversational
- merhaba
- nasılsın
- teşekkürler
- yardım eder misin

## 2.2 Navigation help
- staj başvurusu nasıl yapılır
- approvals sayfası nerede
- ticketları nereden görebilirim

## 2.3 My-data questions
- bugün kaç randevum var
- bugün event’im var mı
- bugün toplantım var mı
- kaç açık request’im var

## 2.4 Scoped operational questions
- bugün kaç open request var
- kaç ticket bekliyor
- overdue approval var mı
- benim birimimde kaç açık request var

## 2.5 Entity detail questions
- event kaçta
- bu request kimde bekliyor
- bu ticket’ın durumu ne
- bu approval neden bekliyor

## 2.6 Comparison / analysis
- bu 2 ticket arasındaki fark ne
- bu sorunun benzer çözümü var mı
- bu request neden gecikmiş olabilir

## 2.7 Analytics narration
- bu hafta en yoğun request tipi ne
- peak saatler ne
- departman bazlı yük nasıl
- IT tarafında hangi sorunlar arttı

---

# 3. Assistant’ın Temel Bileşenleri

## 3.1 Intent Router
Kullanıcı mesajını sınıflandırır.

Örnek intentler:
- greeting
- help_navigation
- my_open_requests_count
- my_today_appointments
- my_today_events
- my_today_summary
- compare_two_tickets
- similar_ticket_solution
- request_status_explanation
- analytics_summary
- event_details

## 3.2 Permission Layer
Assistant cevap vermeden önce kullanıcının neyi gerçekten görebileceğini belirler.

Bu katman şunlara bakar:
- main role
- sub roles
- portal
- user id
- faculty / department / unit
- allowed request types
- allowed routes
- visibility scope

## 3.3 Tool Layer
Assistant sistem verisini doğrudan bilmez.
Veri, kontrollü tool’lardan gelir.

## 3.4 Response Composer
Tool’lardan gelen veriyi:
- doğal dil cevaba
- link listesine
- kartlara
- kısa özetlere

çevirir.

## 3.5 Conversation Store
Konuşma geçmişini DB’de tutar.

## 3.6 Session Layer
UI tarafında ephemeral session mantığını yönetir.

---

# 4. Role-Aware Çalışma Mantığı

Assistant’ın en önemli özelliği:
**role + subrole + scope aware** olmasıdır.

## 4.1 Main role
- student
- faculty
- staff
- admin
- organizer

## 4.2 Sub roles
Örnek:
- advisor
- department chair
- faculty secretary
- internship coordinator
- it_agent
- it_manager
- resource_manager
- procurement_officer
- security_officer
- document_officer
- system_owner
- budget_approver
- finance_officer
- lab_technician
- event_coordinator

## 4.3 Scope
- facultyId
- departmentId
- unitId

## 4.4 Assistant context örneği

```json
{
  "userId": "u_123",
  "portal": "staff",
  "mainRole": "staff",
  "subRoles": ["it_agent"],
  "facultyId": "fac_01",
  "departmentId": null,
  "unitId": "unit_it_01",
  "allowedRequestTypes": ["IT_TICKET"],
  "allowedRoutes": ["/staff/tickets", "/staff/dashboard"],
  "visibilityScope": {
    "ownRequests": false,
    "ownAssignments": true,
    "unitQueue": true,
    "globalAnalytics": false
  }
}
```

Bu context olmadan assistant cevap üretmemelidir.

---

# 5. Portal Bazlı Assistant Davranışı

## 5.1 Student Assistant
Sadece öğrencinin kullanabildiği alanlar içinde çalışır.

### Yardımcı olacağı konular
- hangi formu açacağı
- hangi sayfaya gitmesi gerektiği
- request status yorumlama
- randevu / rezervasyon / belge süreçleri
- staj başvurusu süreçleri
- sık sorulan sorular
- kendi açık işlemleri
- kendi request geçmişi

### Örnek
Soru:
> staj başvurusu nasıl yapılır

Cevap:
> Staj başvurunuzu şu sayfadan yapabilirsiniz: `/student/internships/new`

### Kısıtlar
- başka öğrencilerin verisini görmez
- faculty/staff/admin alanlarını açmaz
- admin analytics veya staff queue bilgisi vermez

---

## 5.2 Faculty Assistant
Faculty kullanıcısının alt rolüne göre hareket eder.

### Yardımcı olacağı konular
- pending approvals
- internship approval süreçleri
- appointment süreçleri
- student request açıklamaları
- advisor veya department chair bazlı sorular
- onay ekranlarına yönlendirme

### Örnek
> Bekleyen onaylarımı nereden görebilirim?
> Bekleyen onaylarınıza şu sayfadan ulaşabilirsiniz: `/faculty/approvals`

### Kısıtlar
- kendi scope’u dışında bilgi vermez
- diğer faculty kullanıcılarının detaylarını açmaz
- staff queue verisi göstermez

---

## 5.3 Staff Assistant
Alt role göre çalışır.

### Örnek alt roller
- it_agent
- it_manager
- document_officer
- resource_manager
- procurement_officer
- security_officer
- faculty_secretary

### Yardımcı olacağı konular
- ilgili queue sayfası
- ticket yönetimi
- reservation işlemleri
- document işlemleri
- procurement/access request akışları
- current assigned işler
- rolüne uygun request açıklamaları

### Örnek
> Açık ticket’ları nereden görebilirim?
> Açık ticket’ları şu sayfadan görüntüleyebilirsiniz: `/staff/tickets`

### Kısıtlar
- staff portalı var diye tüm staff verisini açmaz
- document_officer’a IT queue detayını vermez
- resource_manager’a procurement içeriği vermez
- security_officer’a ilgisiz ticket detayını göstermez

---

## 5.4 Admin Assistant
En geniş yetkili assistant.

### Yardımcı olacağı konular
- analytics ekranları
- audit logs
- system events
- webhook logs
- integrations
- request types
- workflows
- dashboard özeti
- reports
- SLA ekranları
- sistem açıklamaları

### Örnek
> Webhook hatalarını nereden takip ederim?
> Webhook loglarını şu sayfadan takip edebilirsiniz: `/admin/webhook-logs`

### Ek yetenekler
- analytics narration
- sistem özeti
- yönetimsel açıklamalar
- modüller arası ilişkiyi anlatma

---

## 5.5 Organizer Assistant
Event / reservation / organizer akışları için.

### Yardımcı olacağı konular
- event request oluşturma
- reservation flow
- destek / güvenlik ihtiyacı
- ilgili sayfalara yönlendirme
- event süreç açıklamaları

### Not
Eğer organizer ayrı portal ise `/organizer/*` içinde çalışır.
Yoksa uygun portala entegre edilir.

---

# 6. Tool-Driven Assistant Modeli

Assistant tek başına cevap üretmez.
Aşağıdaki kontrollü tool’ları kullanır.

## 6.1 Navigation / help tools
- `get_help_route(intent, portal, roleContext)`
- `get_portal_help_topics(portal, roleContext)`

## 6.2 Request tools
- `get_my_open_requests_count(userContext)`
- `get_visible_open_requests_count(userContext, filters)`
- `get_request_status_explanation(requestId, userContext)`
- `get_request_detail_summary(requestId, userContext)`

## 6.3 Ticket tools
- `get_my_open_tickets(userContext)`
- `compare_two_tickets(ticketIdA, ticketIdB, userContext)`
- `find_similar_ticket_solutions(ticketId, userContext)`
- `get_ticket_queue_summary(userContext)`

## 6.4 Calendar / appointment tools
- `get_my_today_appointments(userContext)`
- `get_my_today_events(userContext)`
- `get_my_today_reservations(userContext)`
- `get_my_today_summary(userContext)`

## 6.5 Event tools
- `get_event_details(eventId, userContext)`
- `get_my_upcoming_events(userContext)`

## 6.6 Analytics tools
- `get_it_analytics_summary(userContext, range)`
- `get_admin_analytics_summary(userContext, range)`
- `get_peak_hours(userContext, range)`
- `get_department_load(userContext, range)`

---

# 7. Intent Listesi

Başlangıç için aşağıdaki intent seti yeterlidir:

```txt
greeting
help_navigation
my_open_requests_count
my_today_appointments
my_today_events
my_today_summary
request_status_explanation
request_summary
compare_two_tickets
similar_ticket_solution
ticket_queue_summary
event_details
analytics_summary
unknown
```

## Intent routing mantığı
- basit selamlaşma → direkt conversational cevap
- sistem sorusu → tool-required
- yetki dışı istek → safe denial
- belirsiz istek → clarification

---

# 8. Structured Response Contract

Assistant frontend’e serbest text değil, structured JSON dönmelidir.

## Temel cevap formatı

```json
{
  "answer": "Kısa ve açıklayıcı cevap",
  "links": [
    {
      "label": "Open Page",
      "href": "/student/internships/new"
    }
  ],
  "cards": [],
  "confidence": 0.91
}
```

## Count cevabı örneği

```json
{
  "answer": "Bugün 3 randevunuz var.",
  "links": [
    {
      "label": "Appointments",
      "href": "/student/appointments"
    }
  ],
  "cards": [
    {
      "type": "count",
      "label": "Today Appointments",
      "value": 3
    }
  ],
  "confidence": 0.94
}
```

## Comparison cevabı örneği

```json
{
  "answer": "İlk ticket network erişimiyle, ikinci ticket ise projeksiyon donanımıyla ilgilidir.",
  "links": [
    {
      "label": "Open Ticket A",
      "href": "/staff/requests/ticket_a_id"
    },
    {
      "label": "Open Ticket B",
      "href": "/staff/requests/ticket_b_id"
    }
  ],
  "cards": [],
  "confidence": 0.86
}
```

---

# 9. Conversation History Mimarisi

Assistant konuşmaları veritabanında tutulmalıdır.

## 9.1 Önerilen tablolar
- `AiConversation`
- `AiMessage`

## 9.2 AiConversation alanları
- id
- userId
- portal
- mainRoleSnapshot
- subRoleSnapshot
- facultyIdSnapshot
- departmentIdSnapshot
- unitIdSnapshot
- createdAt
- updatedAt
- closedAt (opsiyonel)

## 9.3 AiMessage alanları
- id
- conversationId
- messageType (`user`, `assistant`, `system`)
- content
- metadataJson
- createdAt

## 9.4 Saklama amacı
- audit
- analytics
- future quality analysis
- assistant usage measurement

---

# 10. Session Reset Kuralı

Bu çok kritik.

## Zorunlu davranış
Kullanıcı:
- logout olduğunda
- sekmeyi kapattığında
- yeniden login olduğunda
- yeni tab açtığında

assistant UI tarafında **boş / yeni session** ile başlamalı.

## Ama
- geçmiş konuşmalar DB’de tutulmaya devam eder
- kullanıcıya otomatik geri yüklenmez
- önceki conversation UI’da görünmez

## Özet kural
- **DB’de persist et**
- **UI’da rehydrate etme**
- **her açılışta temiz session**

---

# 11. UI Session Modeli

Frontend tarafında ephemeral session kullanılmalıdır.

## Öneri
- her assistant açılışında geçici `sessionId`
- bu session browser tab ile sınırlı olabilir
- tab kapanınca assistant session biter
- logout olunca session reset olur

## Kullanıcı deneyimi
- chat kutusu yeniden boş başlar
- eski konuşma görünmez
- DB’de kayıtlı olsa bile UI’da geri çağrılmaz

---

# 12. Güvenlik Kuralları

Assistant aşağıdaki kurallara uymalıdır.

## 12.1 Role ve scope olmadan cevap üretme
Assistant tool çağırmadan önce:
- role
- subrole
- portal
- scope
kontrolü almalıdır.

## 12.2 Yetki dışı bilgi vermeme
Assistant:
- başka kullanıcıların request detaylarını vermez
- başka faculty/department/unit verisini vermez
- admin-only analytics açmaz
- staff-only queue verisini yetkisiz kullanıcıya göstermez
- internal note’ları paylaşmaz

## 12.3 Route güvenliği
Assistant link verdiğinde:
- route gerçekten sistemde olmalı
- kullanıcı yetkili değilse route verilmemeli
- internal/admin route’lar role check olmadan önerilmemeli

---

# 13. Fallback ve Reliability

AI modeli çalışmasa bile sistem bozulmamalıdır.

## Kurallar
- AI service down olursa fallback cevap dönülebilir
- kritik operasyonlar assistant’a bağlı olmamalı
- AI cevap vermezse UI çökmemeli
- assistant butonu health check’e göre gösterilebilir

## Assistant fallback örneği
```json
{
  "answer": "Assistant is temporarily unavailable. Please try again later.",
  "links": [],
  "cards": [],
  "confidence": 0.0
}
```

---

# 14. Timeout / Retry / Validation

## Timeout
Her AI çağrısında timeout olmalı.

## Retry
Sadece güvenli use-case’lerde sınırlı retry yapılmalı.

## Response validation
Modelden gelen JSON her zaman schema’ya karşı doğrulanmalı.

## Validation başarısız olursa
- safe fallback dön
- logla
- kullanıcıya ham model çıktısını gösterme

---

# 15. Similar Solution Use-Case

“Bu sorunun benzer çözümü var mı?” sorusu için özel akış kurulmalı.

## Basit başlangıç
- kategori bazlı geçmiş çözülmüş ticket ara
- başlık/açıklama similarity
- çözüm özeti olan kayıtları getir

## Gelişmiş versiyon
- embedding / semantic similarity
- top-k geçmiş çözüm
- çözüm özetlerinin AI ile sadeleştirilmesi

## Tool örneği
- `find_similar_ticket_solutions(ticketId, userContext)`

---

# 16. My-Day Use-Case

Assistant şu sorulara cevap verebilmelidir:
- bugün toplantım var mı
- bugün kaç randevum var
- bugün event’im var mı
- event kaçta

## Bunun için gerekli tool’lar
- `get_my_today_appointments`
- `get_my_today_events`
- `get_my_today_reservations`
- `get_my_today_summary`

## Örnek cevap
> Bugün 14:00’te bir appointment ve 16:30’da bir event görünüyor.

---

# 17. Ticket Comparison Use-Case

Assistant şu soruya cevap verebilmeli:
- bu 2 ticket arasındaki fark ne

## Gerekli tool
- `compare_two_tickets(ticketIdA, ticketIdB, userContext)`

## Beklenen sonuç
- kategori farkı
- etkilenen sistem farkı
- öncelik farkı
- muhtemel çözüm farkı

---

# 18. Suggested Implementation Order

## Faz 1
- greeting
- help navigation
- student assistant
- basic faculty/staff/admin responses
- structured response contract

## Faz 2
- my-open-requests
- my-today-summary
- request status explanation
- request summary

## Faz 3
- ticket comparison
- similar solution lookup
- event details
- analytics narration

## Faz 4
- richer cards
- cached assistant answers
- semantic similarity
- quality tuning

---

# 19. En Kritik Tasarım İlkesi

Bu assistant’ın başarılı olması için formül şudur:

**LLM + role context + scoped tools + validated JSON + fallback**

Yani:
- model tek başına değil
- izin kontrollü tool’larla
- structured response ile
- yetki filtresiyle
- sistem verisini yorumlayarak
çalışmalıdır.

---

# 20. Final Sonuç

CampusOps içindeki AI assistant:

- serbest sohbet eden düz chatbot olmayacak
- role-aware olacak
- subrole-aware olacak
- unit/faculty/department scope aware olacak
- system tools üzerinden veri çekecek
- yetki dışı veri göstermeyecek
- doğal dilde cevap verecek
- gerektiğinde tıklanabilir link sunacak
- conversation history DB’de tutacak
- ama logout / tab close sonrası UI’da eski konuşmayı göstermeyecek

## Kısa mimari cümle
**Bu assistant bir chatbot değil, permission-checked operational copilot olmalıdır.**
