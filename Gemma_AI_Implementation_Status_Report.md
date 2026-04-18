# Gemma AI Implementation Status Report

## Durum

Bu repo içinde `Gemma_AI_Implementation_Prompt.md` dosyasındaki kapsam **kısmen uygulandı**. Temel AI omurgası, NestJS gateway, Python AI service, role-aware assistant, conversation persistence, IT triage entegrasyonu ve admin/IT analytics narration eklendi.

Tamamlanan ana başlıklar:

- Ayrı Python AI service iskeleti `services/ai-service/*`
- FastAPI endpointleri:
  - `GET /health`
  - `POST /triage/ticket`
  - `POST /parse/request`
  - `POST /summary/approval`
  - `POST /analytics/summary`
  - `POST /assistant/ask`
- NestJS AI gateway modülü:
  - `POST /ai/triage/ticket`
  - `POST /ai/parse/request`
  - `POST /ai/summary/approval`
  - `POST /ai/analytics/summary`
  - `POST /ai/assistant/ask`
  - `GET /ai/health`
  - `GET /ai/analytics/admin-overview`
  - `GET /ai/analytics/it-overview`
- Assistant conversation persistence:
  - `AiConversation`
  - `AiMessage`
- UI tarafında portal assistant panelleri:
  - student dashboard
  - faculty dashboard
  - staff dashboard
  - admin dashboard
  - organizer dashboard
- UI session reset davranışı:
  - `sessionStorage` tab bazlı `sessionId`
  - logout sonrası temizleme
  - eski konuşmalar UI'da otomatik rehydrate edilmiyor
- IT ticket create akışında AI triage çağrısı
- Admin analytics ve IT analytics için AI narrated summary
- Docker Compose içinde `ai-service` servisi ve backend bağlantı env’leri

## Eksik veya Kısmi Kalanlar

Tam uygulanmayan maddeler:

- Approval summary panelinin gerçek portal ekranlarına bağlanması
- Request parser’ın form doldurma akışlarına bağlanması
- Tüm assistant cevaplarında gerçek permission graph / authorized route graph kullanılması
  - şu an route ve request type izinleri kural tabanlı ve kısmen scope-aware
- Assistant’ın canlı request visibility mantığını her domain için eksiksiz kullanması
  - şu an student için kendi request’leri güvenli
  - staff/faculty için kural tabanlı daraltma var
  - tam domain-level ACL çözümü henüz yok
- IT heatmap ve admin trend chart veri kaynaklarının tamamının `DailyMetric` / `ReportSnapshot` ile beslenmesi
  - şu an doğrudan operational tablolar + günlük metrikler kısmen kullanılıyor
- SLA escalation summary’nin ayrı ekran/panel olarak sunulması
- AI servisinin RabbitMQ/Redis async summary işleri
  - promptta opsiyonel/ileri faz olarak geçiyor
- Assistant widget’larının dashboard dışındaki ilgili sayfalara genişletilmesi
- Gemma servis down durumunda tüm AI entrypointlerinin UI navigasyonundan tamamen kaldırılması
  - mevcut durumda widget health check ile görünmüyor
  - ancak tüm olası AI bağlantılı alanlar merkezi feature flag ile henüz kapanmıyor
- Ayrı Ubuntu VM deployment automation
  - compose ve env tanımı hazır
  - gerçek VM provisioning / reverse proxy / firewall scriptleri repo içinde yok

## Gemma 4 Bağlantısı Nasıl Olacak

Önerilen production akışı:

```txt
Frontend -> NestJS Backend -> Python AI Service -> Ollama -> gemma4
```

### 1. Gemma runtime

AI VM üzerinde Ollama çalışır:

```bash
ollama serve
ollama pull gemma4:latest
```

Bu proje için private Gemma VM adresi:

```ts
const OLLAMA_URL = 'http://192.168.25.197:11434';
```

Varsayılan bağlantı mantığı:

- Python AI service `AI_RUNTIME_PROVIDER=ollama`
- Python AI service `AI_RUNTIME_BASE_URL=http://192.168.25.197:11434`
- Python AI service `AI_DEFAULT_MODEL=gemma4:latest`

### 2. Python AI service

`services/ai-service/app/services/ollama_client.py` içinde Ollama HTTP API çağrısı yapılır:

- hedef: `POST /api/generate`
- body:
  - `model`
  - `prompt`
  - `stream: false`
  - `format: "json"`

### 3. NestJS -> Python AI service

Backend env:

```env
AI_SERVICE_ENABLED=true
AI_SERVICE_BASE_URL=http://ai-service:8010
AI_SERVICE_API_KEY=campusops-ai-internal-dev-key
AI_SERVICE_TIMEOUT_MS=12000
```

Backend sadece Python AI service’e gider. Frontend hiçbir zaman doğrudan Gemma’ya gitmez.

### 4. AI service -> Gemma 4

AI service env:

```env
AI_ENABLED=true
AI_RUNTIME_PROVIDER=ollama
AI_DEFAULT_MODEL=gemma4:latest
AI_RUNTIME_BASE_URL=http://192.168.25.197:11434
AI_INTERNAL_API_KEY=campusops-ai-internal-dev-key
```

NestJS tarafında referans sabit:

- [ai.constants.ts](C:/Users/oguzz/Desktop/campus-ops/2backend/src/modules/ai/ai.constants.ts)

ve güvenlik için:

- sadece private network erişimi
- firewall ile `11434` dışarı kapalı
- NestJS ile AI service arasında iç ağ
- AI service public internete açılmamalı

## Gemma 4 Servis Down Olursa

Mevcut davranış:

- Backend `AiClientService` timeout/fallback döner
- Ana iş akışı bloklanmaz
- Assistant widget health check ile görünmez hale gelir
- Ticket create triage fallback ile devam eder

Yani sistem AI yokmuş gibi çalışmaya devam eder.

## Önerilen Sonraki Adımlar

1. Assistant permission modelini gerçek authorization katmanına bağla
2. Approval summary panelini faculty/staff approval ekranlarına ekle
3. Request parser’ı yeni talep formlarına bağla
4. IT heatmap ve admin analytics chart verisini özel backend endpointleriyle zenginleştir
5. Gemma VM için nginx + systemd + firewall deploy scripti ekle
