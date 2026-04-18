# Claude Implementation Prompt — CampusOps + Gemma AI Integration (Python AI Service)

## Rolün

Sen bu projede **senior software architect + implementer** olarak davranacaksın.

Bu promptun amacı:
- mevcut CampusOps projesine **Gemma tabanlı AI katmanı** eklemek
- bunu mevcut mimariyi bozmadan yapmak
- doğrudan uygulanabilir dosya/dizin yapısı, backend endpointleri, Python AI service, VM planı, portal AI assistant akışları, analytics ve workflow/SLA entegrasyonu üretmek

Senin görevin:
- fikir vermek değil
- doğrudan uygulanabilir çözüm üretmek
- gerekiyorsa yeni dosyalar oluşturmak
- mevcut dosyaları uygun yerlerde güncellemek
- eksik klasör ve modülleri oluşturmak
- kodu production’a yakın kalitede yazmak

Bu promptta söylenenleri uygula.
Sorun çıkaran belirsizliklerde en mantıklı mühendislik kararını ver ve ilerle.
Gereksiz soru sorma.

---

# 1. Mevcut Proje Bağlamı

Bu proje bir **Campus Operations Platform**.

## Request tipleri
- document
- reservation
- appointment
- access request
- internship
- equipment
- event
- procurement
- it ticket
- event creation

## Ana roller
- admin
- student
- faculty
- staff
- organizer

## Alt roller
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
SYSTEM_OWNER
BUDGET_APPROVER
FINANCE_OFFICER
LAB_TECHNICIAN
EVENT_COORDINATOR

## Portal yapısı
- `/student/*`
- `/faculty/*`
- `/staff/*`
- `/admin/*`
- `/organizer/*`

## Kritik görünürlük mantığı
- her request’i herkes görmeyecek
- `staff` portal rolü, tüm staff’ın tüm request’leri göreceği anlamına gelmez
- request görünürlüğü şunlara göre belirlenir:
  - request sahibi
  - current assignee
  - workflow step approver
  - ilgili faculty / department / unit scope
  - ilgili alt rol
  - admin

## Örnek görünürlük
- internship request → advisor + internship coordinator + ilgili kişi + admin
- IT ticket → it_agent / it_manager / ilgili IT unit + requester + admin
- document request → document_officer / faculty_secretary + requester + admin

---

# 2. Gemma AI Entegrasyonunun Hedefi

Gemma doğrudan sistem karar vericisi olmayacak.
Gemma bir **AI yardımcı katman** olacak.

## Gemma’nın görevleri
- classification
- triage
- summarization
- route suggestion
- assistant answers
- analytics narration
- structured parsing
- intelligent recommendation

## Gemma’nın yapmayacağı şeyler
- final approval kararını tek başına vermek
- access grant kararını tek başına vermek
- procurement final approval vermek
- güvenlik izni vermek
- workflow motorunun yerine geçmek

---

# 3. Gemma Deployment Kararı

## Zorunlu mimari
Gemma ayrı VM’de çalışacak.

## Gemma VM bilgisi
- Virtuozzo panelden açılmış
- Ubuntu 22.04 LTS
- AI servis burada çalışacak

## CampusOps uygulama VM’i ayrı
- Next.js
- NestJS
- PostgreSQL -supabase
- Redis
- Worker / queue
- rabbitmq
- varsa n8n

## Doğru akış

```txt
Frontend → NestJS API → Python AI Service → Gemma Runtime
```

Frontend hiçbir zaman doğrudan Gemma’ya gitmeyecek.

---

# 4. Mevcut Belgede Zaten Olan �?eyler

Bu projede daha önce tanımlanmış şu hedefler korunacak:

- Gemma ayrı AI katmanı olacak
- request classification
- ticket triage
- approval summary
- natural language form parsing
- document summarization
- portal assistant
- ayrı VM deployment
- Docker ile bağlama
- internal API üzerinden erişim

Bu mimari korunacak ve genişletilecek. fileciteturn8file0

---

# 5. Yeni Eklenmesi Zorunlu Özellikler

Aşağıdakileri mevcut AI entegrasyonuna mutlaka ekle.

---

## A. IT Analytics Features

IT tarafında aşağıdaki metrikler ve görseller üretilecek:

### Gösterilecek metrikler
- avg resolution time
- SLA breach rate
- ticket heatmap

### Visualization
- line chart
- bar chart
- trend analysis

### Kullanılacak veri kaynakları
- ItTicket
- Request
- SlaPolicy
- SlaEvent
- RequestAssignment
- DailyMetric (varsa)
- ReportSnapshot (opsiyonel)

### Beklenen çıktı
IT dashboard veya staff/admin analytics ekranında:
- ortalama çözüm süresi
- kategori bazlı yoğunluk
- saatlik/günlük heatmap
- SLA ihlal oranı
- trend grafik

---

## B. Admin Analytics Features

Admin tarafında aşağıdaki metrikler üretilecek:

### Gösterilecek metrikler
- en yoğun request tipi
- departman bazlı yük
- peak saatler

### Visualization
- line chart
- bar chart
- trend analysis

### Kullanılacak veri kaynakları
- Request
- RequestType
- Faculty
- Department
- Unit
- DailyMetric
- ReportSnapshot

### Beklenen çıktı
Admin analytics/dashboard tarafında:
- request type distribution
- department load analysis
- peak request hours
- trend cards
- request growth/decline grafikleri

---

## C. AI + Workflow + SLA birleşimi

Aşağıdaki akış uygulanmalı:

1. kullanıcı request oluşturur
2. özellikle IT ticket gibi requestlerde AI triage yapılır
3. AI:
   - request type / ticket category tahmini yapar
   - priority önerir
   - ilgili birim önerir
   - summary üretir
4. backend workflow’u başlatır
5. SLA policy belirlenir
6. SLA takip edilir
7. gerekiyorsa escalation yapılır
8. AI bazı ekranlarda öneri ve özet göstermeye devam eder

## Beklenen sonuç
Sistem şunu yapabilmeli:

- AI ticket classify eder
- workflow otomatik başlar
- SLA takip eder
- escalation yapar

Ama:
- final approval logic yine backend’te olur
- AI sadece yardımcı olur

---

## D. Her portal için AI assistant (GÜNCELLENMİ�?)

Her portal için ayrı AI assistant olacak.

Bu assistant’lar sadece route öneren mini botlar gibi davranmayacak.  
Her assistant, kullanıcının **rolü + varsa alt rolü + yetki scope’u** içinde kalarak, sistemle ilgili sorulara anlamlı ve yardımcı cevaplar verebilmeli.

AI assistant şu görevleri yapabilmeli:
- ilgili portalın iş akışlarını açıklamak
- kullanıcıyı doğru sayfaya yönlendirmek
- gerektiğinde tıklanabilir link vermek
- request status’ü yorumlamak
- süreç adımlarını açıklamak
- hangi işlemi nasıl yapacağını anlatmak
- sistemdeki modüller hakkında rehberlik etmek
- role uygun yardım ve karar destek sağlamak

Ama:
- kullanıcının rolü dışındaki veriyi göstermemeli
- yetkisi olmayan request, queue, analytics, approval veya kayıtlar hakkında bilgi vermemeli
- başka kullanıcıların verisini sızdırmamalı
- admin olmayan kullanıcıya admin içeriği vermemeli
- staff genel rolü var diye tüm staff verisini açmamalı

---

### Temel güvenlik kuralı

Assistant cevap üretmeden önce aşağıdaki context ile çalışmalı:

- main role
- sub role(s)
- faculty / department / unit scope
- portal
- authorized routes
- allowed request types
- allowed visibility scope

Yani assistant cevabı şu prensiple üretmeli:

> “Bu kullanıcı sistem içinde neyi gerçekten görebilir, hangi akışları kullanabilir, hangi sayfalara erişebilir?”

Bu kontrol olmadan cevap üretmemeli.

---

### 1. Student Assistant

Student assistant sadece öğrencinin kullanabildiği modüller ve kendi verisi üzerinden cevap vermeli.

#### Yardımcı olacağı konular
- hangi formu açacağı
- hangi sayfaya gitmesi gerektiği
- request status yorumlama
- randevu / rezervasyon / belge süreçleri
- staj başvurusu süreçleri
- sık sorulan sorular
- kendi request geçmişiyle ilgili açıklamalar
- kendi açık işlemleriyle ilgili yönlendirmeler

#### Örnek
Soru:
> staj başvurusu nasıl yapılır

Cevap:
> Staj başvurunuzu şu sayfadan yapabilirsiniz: `/student/internships/new`

Bu link **tıklanabilir** olmalı.

#### Önemli
Student assistant:
- başka öğrencilerin verisini görmez
- faculty/staff/admin ekranlarını önermez
- admin analytics, staff tickets, faculty approvals gibi alanlara yönlendirme yapmaz

---

### 2. Faculty Assistant

Faculty assistant, faculty kullanıcısının rolü ve alt rolüne göre cevap vermeli.

#### Yardımcı olacağı konular
- pending approvals nerede
- internship approval süreçleri
- appointment talebi nasıl yönetilir
- kendisine atanmış öğrenci işleri
- onay ekranlarına yönlendirme
- advisor olarak hangi request’leri görebileceği
- department chair ise hangi onayları yapabileceği
- kendi scope’undaki süreçlerin açıklaması

#### Örnek
Soru:
> Bekleyen onaylarımı nereden görebilirim?

Cevap:
> Bekleyen onaylarınıza şu sayfadan ulaşabilirsiniz: `/faculty/approvals`

Bu link **tıklanabilir** olmalı.

#### Önemli
Faculty assistant:
- yalnızca kullanıcının own scope’una göre cevap verir
- advisor olmayan birine advisor işlemi varmış gibi konuşmaz
- başka faculty üyelerinin request verilerini açmaz
- staff queue’larını göstermez

---

### 3. Staff Assistant

Staff assistant, kullanıcının alt rolüne göre davranmalı.

Örnek:
- it_agent
- it_manager
- document_officer
- resource_manager
- procurement_officer
- security_officer
- faculty_secretary

#### Yardımcı olacağı konular
- hangi queue sayfasına gidileceği
- ticket / reservation / document / procurement / access request yönetimi
- ilgili ekran linkleri
- işlem yönlendirmesi
- current assigned işler
- rolüne göre hangi request tipleriyle ilgilendiği
- süreç açıklamaları

#### Örnek
Soru:
> Açık ticket’ları nereden görebilirim?

Cevap:
> Açık ticket’ları şu sayfadan görüntüleyebilirsiniz: `/staff/tickets`

Bu link **tıklanabilir** olmalı.

#### Kritik kural
Staff assistant şu hatayı yapmamalı:
- staff portalı var diye tüm staff alanlarını herkese açmamalı

Örneğin:
- document_officer kullanıcısına IT queue detaylarını vermemeli
- resource_manager kullanıcısına procurement içeriği açmamalı
- security_officer’a ilgisiz ticket verisi göstermemeli

---

### 4. Admin Assistant

Admin assistant en geniş yetkili assistant olacak.

#### Yardımcı olacağı konular
- analytics ekranlarına yönlendirme
- audit logs
- system events
- webhook logs
- integrations
- dashboard summary anlatımı
- request type / workflow ekranları
- SLA / reports / advanced admin işlemleri
- sistem özeti
- role ve süreç açıklamaları

#### Örnek
Soru:
> Webhook hatalarını nereden takip ederim?

Cevap:
> Webhook loglarını şu sayfadan takip edebilirsiniz: `/admin/webhook-logs`

Bu link **tıklanabilir** olmalı.

#### Ek beklenti
Admin assistant sadece navigasyon yapmamalı, ayrıca:
- sistemde neyin nereden yönetileceğini anlatmalı
- analytics verilerini açıklayabilmeli
- workflow ve request type ekranları arasındaki farkı anlatabilmeli
- log ekranlarının ne işe yaradığını açıklayabilmeli

---

### 5. Organizer Assistant

Eğer event / reservation / club / organizer tarafı varsa assistant şu konularda yardımcı olmalı:
- event request oluşturma
- reservation flow
- destek ve güvenlik ihtiyacı
- ilgili sayfaya yönlendirme
- event süreç açıklamaları

Eğer mevcut route’da organizer portal yoksa:
- organizer assistant mevcut uygun portal içine entegre edilebilir
- event request sayfasına yönlendirme yapılabilir
- bu karar mevcut route yapısına göre verilsin

Organizer assistant da yine yalnızca kullanıcının görebildiği alanlar içinde cevap vermeli.

---

## Assistant davranış modeli

Assistant cevap üretirken şu üç şeyi birleştirmeli:

1. **Knowledge / help layer**
   - sistem modülleri
   - akış açıklamaları
   - sayfa rehberliği
   - form doldurma yardımı

2. **Role-aware permission layer**
   - hangi bilgiyi görmeye yetkisi var
   - hangi route’a yönlendirilebilir
   - hangi request tipleriyle ilgilenebilir
   - hangi unit/faculty/department scope’unda

3. **Session-aware but privacy-safe context layer**
   - aktif portal
   - mevcut kullanıcı rolü
   - gerekirse kullanıcının kendi açık işleri / kendi request statüsü
   - ama başka kullanıcı verisi asla değil

---

## Assistant conversation history kuralları

AI assistant konuşmaları veritabanında tutulmalı.

### Bunun için ayrı bir şema / tablo açılabilir
Öneri:
- `AiConversation`
- `AiMessage`
veya benzeri yapı

### Saklanacak alanlar
- conversation id
- user id
- portal
- role snapshot
- sub role snapshot
- createdAt / updatedAt
- message type (user / assistant / system)
- message content
- optional metadata
- optional linked request / route / feature context

### Kritik davranış kuralı
Kullanıcı:
- logout olduğunda
- sekmeyi kapattığında
- sayfayı terk ettiğinde
- yeniden giriş yaptığında

assistant UI tarafında **yeniden sıfırdan başlamalı**.

Yani:
- kullanıcı eski chat geçmişini görmemeli
- assistant yeniden temiz session ile açılmalı

Ama:
- konuşma geçmişi DB’de tutulmaya devam etmeli
- audit / analytics / future internal analysis için saklanmalı

### Yani kural şu
- **DB’de persist et**
- **UI’da session resetle**
- **yeniden açıldığında eski konuşmayı kullanıcıya gösterme**

Bu çok önemli.

---

## Assistant session modeli

UI tarafında assistant için ephemeral session mantığı kurulmalı.

Öneri:
- her browser tab / session için geçici `sessionId`
- logout veya tab close sonrası session sonlandırılsın
- yeni session başladığında boş chat ekranı gelsin

DB’de conversation kayıtları saklansa bile:
- kullanıcıya otomatik rehydrate edilmesin
- eski mesajlar otomatik yüklenmesin

---

## Data access kuralı

Assistant aşağıdaki veri erişim kurallarına uymalı:

### İzin verilen
- kullanıcının kendi verileri
- role bazlı yardım içeriği
- route ve workflow açıklamaları
- kendi scope’u içindeki yönlendirmeler
- kendi yetkisi dahilindeki özetler

### Yasak
- başka kullanıcıların request detayları
- başka department/faculty/unit verileri
- admin-only analytics
- staff-only queue içerikleri
- gizli internal note’lar
- raw audit/system event detayları (yetki yoksa)

---

## Cevap formatı beklentisi

Assistant mümkün olduğunda şu formatta dönmeli:

```json
{
  "answer": "Kısa ve açıklayıcı cevap",
  "links": [
    {
      "label": "Open Page",
      "href": "/student/internships/new"
    }
  ],
  "confidence": 0.91
}
```

UI bu `links` alanını **tıklanabilir link** olarak render etmeli.

---

## Sonuç

Bu assistant sistemi:
- sadece rota öneren bot olmayacak
- role + subrole + scope aware olacak
- sistemle ilgili anlamlı yardım sağlayacak
- yetki dışı veri göstermeyecek
- DB’de conversation history tutacak
- ama kullanıcı logout / tab close sonrası eski konuşmayı UI’da görmeyecek
- her yeni açılışta temiz assistant session ile başlayacak

---

# 6. Teknik Karar — AI API Servisi Python Olacak

## Zorunlu karar
AI API service **NestJS ile değil Python ile yazılacak**.

## Yani
- CampusOps core backend → NestJS
- AI servis → Python

## Önerilen teknoloji
- FastAPI
- Pydantic
- httpx
- Ollama / Gemma runtime HTTP client
- structured JSON response

## Python AI service görevleri
- prompt template yönetimi
- request classification
- ticket triage
- approval summary
- analytics narration
- portal assistant cevap üretimi
- response validation
- timeout / retry
- fallback handling

---

# 7. İstenen Dosya / Dizin Yapısı

AI service için aşağıdaki yapıyı üret:

```txt
services/
  ai-service/
    main.py
    app/
      api/
        routes/
          health.py
          triage.py
          parser.py
          summary.py
          assistant.py
          analytics.py
      core/
        config.py
        security.py
      models/
        triage.py
        parser.py
        summary.py
        assistant.py
        analytics.py
      services/
        ollama_client.py
        prompt_service.py
        triage_service.py
        parser_service.py
        summary_service.py
        assistant_service.py
        analytics_service.py
      prompts/
        triage/
        parser/
        summary/
        assistant/
        analytics/
      utils/
        json_extract.py
        validation.py
    requirements.txt
    Dockerfile
    docker-compose.yml
    .env.example
```

NestJS tarafında da aşağıdaki modül veya servisleri üret / güncelle:

```txt
src/
  modules/
    ai/
      ai.module.ts
      ai.controller.ts
      ai.service.ts
      ai-client.service.ts
      dto/
```

Ama unutma:
- gerçek AI logic Python servisinde olacak
- NestJS yalnızca client/gateway olacak

---

# 8. Endpoint Tasarımı

## Python AI service endpointleri

### Health
- `GET /health`

### Ticket triage
- `POST /triage/ticket`

### Request classification / parser
- `POST /parse/request`

### Approval summary
- `POST /summary/approval`

### Analytics summary
- `POST /analytics/summary`

### Portal assistant
- `POST /assistant/ask`

---

## NestJS tarafı endpointleri
NestJS içinde şu gateway endpointleri olabilir:

- `POST /ai/triage/ticket`
- `POST /ai/parse/request`
- `POST /ai/summary/approval`
- `POST /ai/analytics/summary`
- `POST /ai/assistant/ask`

---

# 9. Structured Output Kuralı

Modelden serbest cevap isteme.

Her use-case için JSON schema benzeri structured response kullan.

## Ticket triage örneği
```json
{
  "requestType": "IT_TICKET",
  "category": "Network",
  "priority": "HIGH",
  "suggestedUnit": "IT",
  "summary": "Possible classroom network issue",
  "missingFields": ["assetId"],
  "confidence": 0.84
}
```

## Assistant örneği
```json
{
  "answer": "Staj başvurunuzu şu sayfadan yapabilirsiniz.",
  "links": [
    {
      "label": "Open Internship Application",
      "href": "/student/internships/new"
    }
  ],
  "confidence": 0.93
}
```

## Analytics summary örneği
```json
{
  "summary": "IT ticket volume increased by 18% this week.",
  "highlights": [
    "Average resolution time is 6.2 hours",
    "Peak ticket hours are 10:00–12:00",
    "Most common issue type is Network"
  ],
  "confidence": 0.88
}
```

---

# 10. Assistant Mantığı

Assistant cevapları sadece serbest chat olmasın.

## Beklenen davranış
Assistant:
- soruyu anlar
- ilgili portalı belirler
- mümkünse uygun route’u bulur
- kısa bir cevap döner
- UI’da tıklanabilir link döner

## Route mapping gerekli
Bu yüzden route-to-help mapping üret.

Örnek:
- internship application → `/student/internships/new`
- faculty approvals → `/faculty/approvals`
- staff tickets → `/staff/tickets`
- admin analytics → `/admin/analytics`
- admin webhook logs → `/admin/webhook-logs`

Bu mapping hardcoded config olarak başlayabilir.

---

# 11. Analytics Modülü Beklentileri

## IT analytics
Üretilecek bileşenler:
- avg resolution time card
- SLA breach rate card
- ticket heatmap
- line chart for ticket trends
- bar chart for category distribution
- trend analysis summary (AI narrated)

## Admin analytics
Üretilecek bileşenler:
- most frequent request type
- department workload chart
- peak hours chart
- line trend by date
- bar chart by department/request type
- AI executive summary

---

# 12. Workflow + SLA + AI Entegrasyonu

Aşağıdaki noktalar koda bağlanmalı:

## Ticket create sonrası
- AI triage çalışır
- classification sonucu alınır
- uygun request type/category set edilir
- priority önerisi alınır
- suggested unit belirlenir
- workflow instance başlatılır
- ilgili SLA policy seçilir
- gerekiyorsa assignment queue’ya düşer

## SLA izleme
- scheduled worker veya queue job ile SLA event kontrolü yapılır
- breach varsa escalation logic çalışır
- AI isterse escalation summary üretebilir

## Escalation
Örnek:
- first response gecikti → manager’a bildir
- resolution time aşıldı → priority yükselt / escalation event oluştur

Ama escalation’ın kendisi backend logic ile yürümeli.

---

# 13. Kullanılacak Veri Alanları

AI servisinin cevap üretirken kullanacağı context’ler:

## Ticket triage için
- title
- description
- requester faculty/department
- source channel
- geçmiş benzer çözümler varsa özet

## Approval summary için
- request title
- request description
- domain-specific data
- current workflow step
- previous approval actions
- comments summary
- attached documents metadata

## Assistant için
- portal name
- user role
- available routes
- request type help mapping
- page descriptions

## Analytics narration için
- chart data
- KPI values
- trend deltas
- grouped counts

---

# 14. Redis / Queue Entegrasyonu

AI istekleri gerekiyorsa Redis ile birlikte kullanılabilir.

## Yapılabilecekler
- heavy analytics summary async üretilebilir
- report summary async üretilebilir
- AI request result kısa süre cache’lenebilir
- repeated assistant answers cache’lenebilir

Ama ilk aşamada:
- basit synchronous API ile başla
- timeout/fallback ekle

---

# 15. Timeout ve Fallback Kuralları

## Zorunlu
Her AI çağrısında timeout olmalı.

## Timeout olursa
- sistem bozulmayacak
- UI “AI suggestion unavailable” benzeri fallback gösterecek
- ana request/workflow/ticket akışı çalışmaya devam edecek

## Kritik kural
AI failure hiçbir zaman ana sistemi bloklamasın.

---

# 16. Güvenlik Kuralları

## Gemma 4 ai modeli projenin ana parçası olmamalı

- gemaa 4 ai modulu çalışmadığı erişelemediği veya benzer herhangi bir durumda bu ai modeli hiç yokmuş veya entegre edilmemiş gibi sistem çalışabilmeli
- gemma 4 çalışmadığı servis down olduğu durumlarda gemma 4 için kurulan koyulan buton sayfa vb görünemz veya erişilemez olmalı
- gemma 4 çalışmadığı durumlarda hiç yokmuş gibi sistem düzgün ve çalışır olmalı

## AI service public internete açık olmasın
- mümkünse internal network
- private IP / firewall
- backend’den API key ile erişim

## PII dikkat
Prompt’a gereksiz kişisel veri koyma.

## Assistant cevapları
- route linkleri güvenli ve internal route’lar olmalı
- kullanıcı yetkisi olmayan sayfaya yönlendirme yapmamalı

---

# 17. Beklenen Uygulama Çıktıları

Bu prompt sonunda senden beklediğim şeyler:

1. güncel mimari önerisi
2. oluşturulacak dosya yapısı
3. Python AI service kodları
4. NestJS AI gateway modülü
5. DTO/response schema’ları
6. prompt template örnekleri
7. assistant route mapping yapısı
8. analytics endpoint tasarımı
9. AI + workflow + SLA entegrasyon akışı
10. Docker / env / deploy notları
11. UI entegrasyon önerileri
12. hangi portalda hangi assistant bileşeni gösterilecek

---

# 18. UI Beklentileri

## Student portal
- assistant widget veya panel
- tıklanabilir yönlendirme linkleri
- internship / reservation / appointment / document konularında rehber cevaplar

## Faculty portal
- assistant panel
- approvals ve internships için rehberlik
- karar destek summary panel

## Staff portal
- assistant panel
- tickets / documents / reservations için yönlendirme
- queue summary önerileri

## Admin portal
- assistant panel
- analytics narration
- system navigation help
- logs / integrations / reports yönlendirme

## Organizer tarafı
- event / reservation yardım paneli
- uygun request route önerileri

---

# 19. Öncelik Sırası

Aşağıdaki sırayla uygula:

## Faz 1
- Python AI service skeleton
- NestJS AI gateway
- health endpoint
- ticket triage
- approval summary
- student assistant basic

## Faz 2
- staff assistant
- faculty assistant
- admin assistant
- request parser
- analytics summary endpoints

## Faz 3
- IT analytics charts integration
- admin analytics charts integration
- SLA escalation summary
- organizer assistant

---

# 20. Kod Kalitesi Kuralları

- TypeScript tarafında temiz service sınırları koru
- Python tarafında FastAPI + Pydantic kullan
- magic string azalt
- promptları ayrı dosyada tut
- structured output validation uygula
- response normalize et
- timeout/fallback uygula
- log ekle
- environment config temiz olsun

---

# 21. Final Uygulama Hedefi

Bu entegrasyon sonunda sistem şunları yapabilmeli:

## AI operational features
- AI ticket classify eder
- workflow otomatik başlar
- SLA takip edilir
- escalation backend tarafından yürür
- AI summary ve recommendation sağlar

## Portal assistants
- student / faculty / staff / admin / organizer assistant çalışır
- assistant cevapları tıklanabilir sayfa linkleri içerir
- assistant role-aware davranır

## Analytics
- IT için:
  - avg resolution time
  - SLA breach rate
  - ticket heatmap
  - line/bar chart
  - trend analysis

- Admin için:
  - en yoğun request tipi
  - departman bazlı yük
  - peak saatler
  - line/bar chart
  - trend analysis

---

# 22. Son Talimat

Bu promptu uygularken:

- dosyaları önerme, mümkün olduğunca oluştur
- eksik klasörleri yarat
- örnek değil, uygulanabilir çözüm üret
- mevcut mimariyi bozma
- özellikle Python AI service’i merkeze al
- NestJS’i sadece AI gateway/client olarak kullan
- assistant linklerini clickable route yapısıyla tasarla
- Gemma VM’in Ubuntu 22.04 LTS üzerinde Docker ile ayağa kalkacağını varsay

