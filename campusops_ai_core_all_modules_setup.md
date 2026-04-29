# CampusOps AI Core – Tüm AI Modülleri İçin Uygulama Planı

Bu doküman CampusOps projesinde sadece AI Assistant için değil; Dashboard AI Summary, Approval Summary, Ticket Triage, Request Parser, Analytics Narration ve diğer tüm AI özellikleri için ortak bir AI Core mimarisi kurmak amacıyla hazırlanmıştır.

---

## 1. Ana Hedef

CampusOps içinde AI özellikleri tek tek bağımsız yazılmayacak. Bunun yerine merkezi bir AI Core kurulacak.

Amaç:

- Kullanıcı doğal dilde soru sorsun.
- Sistem kullanıcının rolünü bilsin.
- Gerektiğinde veritabanından güvenli veri çeksin.
- AI modülleri aynı model, aynı güvenlik, aynı timeout ve aynı fallback sistemini kullansın.
- Chat assistant, dashboard summary, approval summary, ticket triage ve request parser aynı altyapıdan çalışsın.

---

## 2. Genel Mimari

```text
Frontend AI UI / Dashboard / Ticket Form / Approval Page
        ↓
NestJS AI Module
        ↓
AI Core Service
        ↓
Module Router
        ↓
Task-specific AI Service
        ↓
Safe DB Views / Prisma Services / SQL Agent
        ↓
Ollama Runtime VM
        ↓
Qwen2.5 Model
```

---

## 3. Runtime Model Bilgileri

Prod AI runtime:

```env
AI_PROVIDER=ollama
AI_BASE_URL=http://188.132.177.60:11434
AI_PRIMARY_MODEL=qwen2.5:3b-instruct
AI_FALLBACK_MODEL=llama3.2:1b
AI_TIMEOUT_MS=60000
AI_ENABLED=true
```

Eğer aktif çalışan IP farklıysa `AI_BASE_URL` güncellenmelidir.

---

## 4. AI Core Modülleri

Kurulacak modüller:

```text
1. Assistant Chat
2. Dashboard AI Summary
3. Approval Summary
4. Ticket Triage
5. Request Parser
6. Analytics Narration
7. Similar Ticket Finder
8. Response Validator
```

Hepsi aynı AI client üzerinden çalışacak.

---

## 5. Önerilen Dosya Yapısı

```text
src/
  ai/
    ai.module.ts
    ai.controller.ts

    core/
      ai-core.service.ts
      ai-client.service.ts
      ai-response-validator.service.ts
      ai-timeout.service.ts
      ai-types.ts

    prompts/
      base-system.prompt.ts
      assistant.prompt.ts
      dashboard-summary.prompt.ts
      approval-summary.prompt.ts
      ticket-triage.prompt.ts
      request-parser.prompt.ts
      analytics-narration.prompt.ts
      sql-agent.prompt.ts

    modules/
      assistant/
        assistant-ai.service.ts
      dashboard/
        dashboard-ai.service.ts
      approvals/
        approval-ai.service.ts
      tickets/
        ticket-ai.service.ts
      requests/
        request-ai.service.ts
      analytics/
        analytics-ai.service.ts

    sql-agent/
      sql-agent.service.ts
      sql-validator.service.ts
      schema-registry.service.ts

    views/
      ai-views.sql
```

---

## 6. AI Core Service Mantığı

Tüm AI modülleri bu servisi kullanacak.

```ts
@Injectable()
export class AiCoreService {
  constructor(private readonly aiClient: AiClientService) {}

  async runTask(input: AiTaskInput): Promise<AiTaskResult> {
    const messages = [
      {
        role: 'system',
        content: input.systemPrompt,
      },
      {
        role: 'user',
        content: input.userPrompt,
      },
    ];

    return this.aiClient.chat({
      model: input.model,
      messages,
      temperature: input.temperature ?? 0.2,
      numPredict: input.numPredict ?? 300,
      timeoutMs: input.timeoutMs ?? 60000,
    });
  }
}
```

Amaç: Her modül ayrı ayrı Ollama çağırmasın. Hepsi `AiCoreService.runTask()` kullansın.

---

## 7. AI Client Service

Ollama bağlantısı burada tutulur.

```ts
@Injectable()
export class AiClientService {
  private readonly baseUrl = process.env.AI_BASE_URL;
  private readonly primaryModel = process.env.AI_PRIMARY_MODEL;
  private readonly fallbackModel = process.env.AI_FALLBACK_MODEL;

  async chat(payload: {
    model?: string;
    messages: any[];
    temperature?: number;
    numPredict?: number;
    timeoutMs?: number;
  }) {
    try {
      return await this.callOllama({
        ...payload,
        model: payload.model ?? this.primaryModel,
      });
    } catch (error) {
      return await this.callOllama({
        ...payload,
        model: this.fallbackModel,
        timeoutMs: 15000,
      });
    }
  }

  private async callOllama(payload: any) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: payload.model,
        messages: payload.messages,
        stream: false,
        options: {
          temperature: payload.temperature ?? 0.2,
          num_predict: payload.numPredict ?? 300,
        },
      }),
      signal: AbortSignal.timeout(payload.timeoutMs ?? 60000),
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed: ${res.status}`);
    }

    return res.json();
  }
}
```

---

## 8. Safe AI Database Views

AI doğrudan gerçek tablolara erişmemeli. AI sadece güvenli view şemalarını bilmeli.

Başlangıç için yeterli view listesi:

```text
ai_requests_view
ai_tickets_view
ai_approvals_view
ai_dashboard_view
ai_users_limited_view
```

Bu view’lar sadece okunabilir amaçlıdır.

---

## 9. ai_requests_view

Bu view request modülü, assistant chat, dashboard summary ve approval summary içinde kullanılabilir.

```sql
CREATE OR REPLACE VIEW ai_requests_view AS
SELECT
  r.id,
  r.title,
  r.description,
  r.type,
  r.status,
  r.priority,
  r.created_by_id,
  r.assignee_id,
  r.department_id,
  r.created_at,
  r.updated_at
FROM requests r;
```

Bu view ile cevaplanabilecek örnekler:

```text
- Bana atanmış kaç talep var?
- Açık taleplerim neler?
- Bekleyen talepler kaç tane?
- Onaylanan talepler kaç tane?
- Reddedilen talepler kaç tane?
- Bu ay kaç request açılmış?
- Hangi requestler acil?
```

---

## 10. ai_tickets_view

Ticket triage, assistant chat ve analytics narration için kullanılır.

```sql
CREATE OR REPLACE VIEW ai_tickets_view AS
SELECT
  t.id,
  t.title,
  t.description,
  t.category,
  t.priority,
  t.status,
  t.created_by_id,
  t.assigned_to_id,
  t.department_id,
  t.created_at,
  t.updated_at
FROM tickets t;
```

Bu view ile cevaplanabilecek örnekler:

```text
- Açık ticket sayısı kaç?
- IT biriminde kaç bekleyen ticket var?
- Bana atanmış ticketlar neler?
- En acil ticketlar hangileri?
- Bu ticket hangi kategoriye ait olabilir?
```

---

## 11. ai_approvals_view

Approval Summary modülü için kullanılır.

```sql
CREATE OR REPLACE VIEW ai_approvals_view AS
SELECT
  a.id,
  a.request_id,
  a.approver_id,
  a.status,
  a.step_name,
  a.comment,
  a.created_at,
  a.updated_at,
  r.title AS request_title,
  r.type AS request_type,
  r.priority AS request_priority,
  r.created_by_id AS request_owner_id
FROM approvals a
JOIN requests r ON r.id = a.request_id;
```

Bu view ile cevaplanabilecek örnekler:

```text
- Onay bekleyen taleplerim neler?
- Bu request neden onay bekliyor?
- Approval geçmişini özetle.
- Advisor onayında bekleyen kaç kayıt var?
```

---

## 12. ai_users_limited_view

AI kullanıcıların hassas bilgilerini görmemeli. Sadece sınırlı kullanıcı bilgisi verilmeli.

```sql
CREATE OR REPLACE VIEW ai_users_limited_view AS
SELECT
  u.id,
  u.name,
  u.email,
  u.role,
  u.department_id,
  u.created_at
FROM users u;
```

Bu view’da password hash, token, private bilgiler, reset token gibi alanlar olmamalı.

---

## 13. ai_dashboard_view

Dashboard özetleri için opsiyonel ama faydalıdır.

```sql
CREATE OR REPLACE VIEW ai_dashboard_view AS
SELECT
  u.id AS user_id,
  u.role,
  u.department_id,
  COUNT(DISTINCT r.id) FILTER (WHERE r.created_by_id = u.id) AS total_created_requests,
  COUNT(DISTINCT r.id) FILTER (WHERE r.assignee_id = u.id) AS total_assigned_requests,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'OPEN') AS open_requests,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'PENDING') AS pending_requests,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'APPROVED') AS approved_requests,
  COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'REJECTED') AS rejected_requests
FROM users u
LEFT JOIN requests r
  ON r.created_by_id = u.id
  OR r.assignee_id = u.id
  OR r.department_id = u.department_id
GROUP BY u.id, u.role, u.department_id;
```

Not: Gerçek tablo ve kolon adlarına göre düzenlenmelidir.

---

## 14. SQL Agent Mantığı

Assistant Chat ve Analytics gibi serbest soru cevap gereken modüllerde SQL Agent kullanılabilir.

Akış:

```text
User question
↓
AI SQL Agent
↓
SELECT SQL üretir
↓
Backend SQL Validator kontrol eder
↓
Role-based güvenlik eklenir
↓
DB sonucu alınır
↓
AI doğal cevap üretir
```

---

## 15. SQL Agent Prompt

```text
Sen CampusOps SQL Agent'sın.

Görevin kullanıcının sorusuna göre güvenli PostgreSQL SELECT sorgusu üretmektir.

Kurallar:
- Sadece SELECT sorgusu üret.
- INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE yasak.
- Sadece AI-safe view'ları kullan.
- Gerçek tablo isimlerini kullanma.
- Kullanıcının rolüne göre veri erişimini sınırla.
- SQL dışında açıklama yazma.
- LIMIT kullan.

Kullanılabilir view'lar:
- ai_requests_view
- ai_tickets_view
- ai_approvals_view
- ai_dashboard_view
- ai_users_limited_view
```

---

## 16. SQL Validator

```ts
@Injectable()
export class SqlValidatorService {
  validate(sql: string) {
    const lowered = sql.toLowerCase().trim();

    if (!lowered.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed');
    }

    const forbidden = [
      'insert',
      'update',
      'delete',
      'drop',
      'alter',
      'truncate',
      'create',
      'grant',
      'revoke',
      'execute',
      'copy',
      'pg_sleep',
    ];

    for (const word of forbidden) {
      if (lowered.includes(word)) {
        throw new Error(`Forbidden SQL keyword: ${word}`);
      }
    }

    const allowedViews = [
      'ai_requests_view',
      'ai_tickets_view',
      'ai_approvals_view',
      'ai_dashboard_view',
      'ai_users_limited_view',
    ];

    const usesAllowedView = allowedViews.some((view) => lowered.includes(view));

    if (!usesAllowedView) {
      throw new Error('Query must use AI-safe views');
    }

    return true;
  }
}
```

---

## 17. Role-Based Güvenlik

AI hangi SQL’i üretirse üretsin backend kullanıcı rolüne göre filtre uygular.

Örnek mantık:

```ts
function buildRoleContext(user: AuthUser) {
  return {
    userId: user.id,
    role: user.role,
    departmentId: user.departmentId,
  };
}
```

Prompt içine bu context verilir:

```text
Current user:
- id: 123
- role: STUDENT
- department_id: 5

STUDENT sadece kendi created_by_id kayıtlarını görebilir.
STAFF sadece kendi department_id kayıtlarını görebilir.
ADMIN tüm kayıtları görebilir.
```

MVP’de role filter prompt ile verilir. Daha güvenli sürümde SQL backend tarafında zorunlu filtrelenir.

---

## 18. Assistant Chat Modülü

Serbest soru-cevap için kullanılır.

Endpoint:

```text
POST /ai/assistant/ask
```

Akış:

```text
1. Kullanıcı soru sorar.
2. AI Core sorunun canlı veri gerektirip gerektirmediğini değerlendirir.
3. Veri gerekiyorsa SQL Agent çalışır.
4. SQL sonucu alınır.
5. AI doğal dilde cevap üretir.
```

Örnek:

```text
Bugün bana atanmış kaç açık talep var?
```

Cevap:

```text
Bugün sana atanmış 4 açık talep var. Bunlardan 2 tanesi yüksek öncelikli görünüyor.
```

---

## 19. Dashboard AI Summary Modülü

Endpoint:

```text
GET /ai/dashboard/summary
```

Bu modül SQL Agent kullanmak zorunda değildir. Genelde doğrudan backend servisinden veri alıp AI’ya özetlettirmek daha güvenlidir.

Akış:

```text
1. Backend dashboard verisini Prisma ile çeker.
2. AI Core’a structured JSON gönderilir.
3. AI kısa, rol bazlı özet üretir.
```

Prompt:

```text
Sen CampusOps dashboard özet asistanısın.
Verilen JSON dashboard verisini kısa ve anlaşılır Türkçe ile özetle.
Uydurma bilgi ekleme.
Sayıları değiştirme.
Rol bazlı öneri ekleyebilirsin.
```

Örnek input:

```json
{
  "assignedRequests": 8,
  "openRequests": 4,
  "pendingApprovals": 2,
  "approvedRequests": 3,
  "rejectedRequests": 1
}
```

Örnek output:

```text
Bugün sana atanmış 8 talep var. Bunların 4 tanesi açık, 2 tanesi onay bekliyor. 3 talep onaylanmış, 1 talep reddedilmiş.
```

---

## 20. Approval Summary Modülü

Endpoint:

```text
GET /ai/approvals/:requestId/summary
```

Akış:

```text
1. Request ve approval geçmişi backend tarafından çekilir.
2. AI’ya structured veri gönderilir.
3. AI onaylayıcı için karar özeti üretir.
```

Prompt:

```text
Sen CampusOps approval summary asistanısın.
Verilen request ve approval geçmişini onaylayıcı için özetle.
Kararı sen verme, sadece özet ve dikkat edilmesi gereken noktaları çıkar.
Uydurma bilgi ekleme.
```

Örnek output:

```text
Bu staj talebi danışman onayından geçmiş ve şu anda Internship Coordinator incelemesinde bekliyor. Öğrenci gerekli belgeleri yüklemiş görünüyor. Son işlem 2 gün önce yapılmış.
```

---

## 21. Ticket Triage Modülü

Endpoint:

```text
POST /ai/tickets/triage
```

Bu modül için SQL gerekmez. AI structured JSON döndürmelidir.

Prompt:

```text
Sen CampusOps ticket triage asistanısın.
Kullanıcının yazdığı ticket açıklamasına göre kategori, öncelik, önerilen departman ve kısa özet üret.
Sadece JSON döndür.

Format:
{
  "category": "IT | FACILITY | STUDENT_AFFAIRS | FINANCE | OTHER",
  "priority": "LOW | MEDIUM | HIGH | CRITICAL",
  "suggestedDepartment": "...",
  "summary": "...",
  "reason": "..."
}
```

Örnek input:

```text
Laboratuvardaki internet çalışmıyor, ders başlayacak.
```

Örnek output:

```json
{
  "category": "IT",
  "priority": "HIGH",
  "suggestedDepartment": "IT Department",
  "summary": "Laboratuvar internet bağlantısı çalışmıyor.",
  "reason": "Ders başlamadan önce çözülmesi gereken operasyonel bir teknik sorun."
}
```

---

## 22. Request Parser Modülü

Endpoint:

```text
POST /ai/requests/parse
```

Bu modül kullanıcı doğal dille request oluşturmak istediğinde form alanlarını çıkarır.

Prompt:

```text
Sen CampusOps request parser asistanısın.
Kullanıcının doğal dilde anlattığı talebi structured JSON'a çevir.
Eksik alan varsa null bırak.
Sadece JSON döndür.

Format:
{
  "type": "INTERNSHIP | DOCUMENT | TECHNICAL | APPOINTMENT | OTHER",
  "title": "...",
  "description": "...",
  "priority": "LOW | MEDIUM | HIGH",
  "missingFields": []
}
```

Örnek input:

```text
Yaz dönemi için staj başvurusu yapmak istiyorum.
```

Örnek output:

```json
{
  "type": "INTERNSHIP",
  "title": "Yaz Dönemi Staj Başvurusu",
  "description": "Kullanıcı yaz dönemi için staj başvurusu yapmak istiyor.",
  "priority": "MEDIUM",
  "missingFields": ["companyName", "startDate", "endDate"]
}
```

---

## 23. Analytics Narration Modülü

Endpoint:

```text
POST /ai/analytics/narrate
```

Bu modül grafik veya istatistik verisini doğal dile çevirir.

Prompt:

```text
Sen CampusOps analytics narration asistanısın.
Verilen metrikleri kısa ve anlaşılır şekilde yorumla.
Sayıları değiştirme.
Abartılı yorum yapma.
```

Örnek input:

```json
{
  "openTickets": 23,
  "resolvedTickets": 51,
  "avgResolutionTimeHours": 18,
  "topCategory": "IT"
}
```

Örnek output:

```text
Bu dönemde 51 ticket çözümlenmiş, 23 ticket hâlâ açık. Ortalama çözüm süresi 18 saat. En yoğun kategori IT olarak görünüyor.
```

---

## 24. Similar Ticket Finder

Bu modül iki aşamalı yapılabilir.

MVP:

```text
PostgreSQL ILIKE / full-text search
```

İleri seviye:

```text
pgvector / Qdrant + embedding
```

Endpoint:

```text
POST /ai/tickets/similar
```

MVP akışı:

```text
1. Ticket text alınır.
2. DB’de benzer title/description aranır.
3. Bulunan kayıtlar AI’ya verilir.
4. AI benzerlik özetini çıkarır.
```

---

## 25. Response Validator

Tüm AI cevaplarından sonra basit bir validator çalışmalıdır.

Kontrol edilecekler:

```text
- AI yetki dışı bilgi verdi mi?
- Hassas bilgi döndürdü mü?
- SQL sonucu dışında sayı uydurdu mu?
- JSON formatı bozuk mu?
- Kullanıcı rolüne aykırı cevap var mı?
```

MVP için kod bazlı validator yeterlidir.

---

## 26. Hangi Modül SQL Agent Kullanmalı?

```text
Assistant Chat: Evet
Dashboard Summary: Genelde hayır, structured backend data daha iyi
Approval Summary: Genelde hayır, backend data daha iyi
Ticket Triage: Hayır
Request Parser: Hayır
Analytics Narration: Hayır veya opsiyonel
Similar Ticket Finder: Opsiyonel
```

Önemli karar:

```text
SQL Agent sadece serbest soru-cevap gereken yerlerde kullanılsın.
Diğer modüllerde backend veriyi hazırlayıp AI’ya özetlettirsin.
```

Bu daha güvenli ve daha stabil olur.

---

## 27. Endpoint Listesi

```text
POST /ai/assistant/ask
GET  /ai/dashboard/summary
GET  /ai/approvals/:requestId/summary
POST /ai/tickets/triage
POST /ai/requests/parse
POST /ai/analytics/narrate
POST /ai/tickets/similar
GET  /ai/health
```

---

## 28. AI Health Endpoint

```text
GET /ai/health
```

Dönecek örnek response:

```json
{
  "enabled": true,
  "provider": "ollama",
  "baseUrl": "http://188.132.177.60:11434",
  "primaryModel": "qwen2.5:3b-instruct",
  "fallbackModel": "llama3.2:1b",
  "reachable": true,
  "latencyMs": 1300
}
```

---

## 29. Timeout ve Fallback

Her AI çağrısında timeout olmalı.

Öneri:

```text
Primary model timeout: 60000 ms
Fallback model timeout: 15000 ms
```

Primary başarısız olursa fallback otomatik çalışır.

---

## 30. Prompt Kuralları

Tüm promptlarda ortak kurallar:

```text
- Uydurma bilgi verme.
- Verilen data dışına çıkma.
- Kullanıcı rolünü dikkate al.
- Kısa ve net cevap ver.
- Sayıları değiştirme.
- Hassas bilgi döndürme.
- Emin değilsen bunu açıkça söyle.
```

---

## 31. Uygulama Sırası

Önerilen geliştirme sırası:

```text
1. AI env ayarlarını doğrula.
2. AiClientService kur.
3. AiCoreService kur.
4. /ai/health endpointini yap.
5. Ticket Triage modülünü yap.
6. Request Parser modülünü yap.
7. Dashboard Summary modülünü yap.
8. Approval Summary modülünü yap.
9. Safe AI views oluştur.
10. SQL Agent kur.
11. Assistant Chat modülünü SQL Agent ile bağla.
12. Response Validator ekle.
```

Neden bu sıra?

Çünkü Ticket Triage ve Request Parser DB gerektirmez, hızlı test edilir. Sonra dashboard ve approval gibi structured data modülleri eklenir. En son SQL Agent eklenir.

---

## 32. Kabul Kriterleri

Sistem başarılı sayılırsa:

```text
- /ai/health runtime erişimini doğru gösterir.
- Ticket triage JSON döndürür.
- Request parser JSON döndürür.
- Dashboard summary gerçek dashboard verisini özetler.
- Approval summary request geçmişini özetler.
- Assistant doğal sorudan DB verisi çekerek cevap verir.
- AI SQL sadece safe view kullanır.
- Kullanıcı rolüne aykırı veri dönmez.
- Ollama timeout olduğunda sistem çökmez.
```

---

## 33. Önemli Mimari Not

Bu sistemde AI tek başına karar veren bir yapı değildir.

Doğru yaklaşım:

```text
AI = dil anlama ve özetleme motoru
Backend = güvenlik ve veri kontrol noktası
DB Views = güvenli veri katmanı
```

Yani AI modülleri güçlü görünür ama tüm kritik kontrol backend tarafındadır.

---

## 34. Kısa Özet

Bu planla CampusOps içinde tek bir AI asistan değil, tüm projeye yayılan merkezi bir AI altyapısı kurulmuş olur.

```text
Assistant Chat → SQL Agent kullanır
Dashboard Summary → Backend data + AI summary kullanır
Approval Summary → Backend data + AI summary kullanır
Ticket Triage → AI classification kullanır
Request Parser → AI structured extraction kullanır
Analytics Narration → AI explanation kullanır
```

Tüm modüller aynı AI Core, aynı model, aynı fallback, aynı güvenlik ve aynı prompt standardını kullanır.
