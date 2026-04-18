# CampusOps Claude Prompt — Chunked Execution Plan

Bu doküman, büyük Gemma AI entegrasyon promptunu Claude'a **parça parça** yaptırmak için hazırlanmıştır.

Ana kaynak prompt: CampusOps_Claude_Gemma_AI_Implementation_Prompt.md
Ek kaynak: CampusOps_Gemma4_Integration_Roadmap.md

Amaç:
- Claude'un tek seferde zorlandığı büyük işi küçük parçalara bölmek
- her parçayı bağımsız uygulanabilir görev haline getirmek
- sırayla ilerleyip sonunda tüm entegrasyonu tamamlamak

---

# Genel kullanım kuralı

Claude'a bu parçaları **tek tek** ver.

## Önemli
- Aynı anda sadece **bir parça** ver
- Claude'dan önce ilgili parçayı **tam uygulamasını** iste
- Her parça sonunda senden beklenen şey:
  - oluşturulan dosyalar
  - güncellenen dosyalar
  - env değişiklikleri
  - docker / compose değişiklikleri
  - endpointler
  - nasıl test edileceği

## Sıra
Bu parçaları aşağıdaki sırayla uygula:

1. Part 01 — Foundation & Architecture
2. Part 02 — Python AI Service Skeleton
3. Part 03 — NestJS AI Gateway
4. Part 04 — Ticket Triage + Workflow + SLA
5. Part 05 — Approval Summary
6. Part 06 — Portal AI Assistants
7. Part 07 — AI Conversation Persistence
8. Part 08 — IT Analytics
9. Part 09 — Admin Analytics
10. Part 10 — Reliability, Fallback, Security, Final Wiring

---

# PART 01 — Foundation & Architecture

## Claude'a verilecek görev

Mevcut CampusOps projesine Gemma AI entegrasyonu için temel mimariyi kur.

Kurallar:
- AI service Python olacak
- CampusOps core backend NestJS kalacak
- AI service ayrı servis olacak
- gerçek AI logic Python tarafında olacak
- NestJS sadece gateway/client olacak
- Gemma ayrı VM'de çalışacak
- VM: Ubuntu 22.04 LTS
- frontend doğrudan Gemma'ya gitmeyecek

Yapılacaklar:
1. proje için AI entegrasyon mimarisini netleştir
2. gerekli klasör/dizin yapısını oluştur
3. oluşturulacak servislerin ve modüllerin listesini çıkar
4. `.env.example` dosyalarını hazırla
5. Docker ve compose tarafında gerekli iskeleti oluştur
6. health check stratejisini planla
7. Gemma servisinin opsiyonel modül gibi davranacağı fallback mimarisini kur
8. sistemde AI yokmuş gibi de çalışabilme kuralını uygula

İstenen çıktı:
- dosya yapısı
- açıklamalı mimari
- oluşturulmuş başlangıç dosyaları
- env örnekleri
- docker/compose taslağı
- health/fallback yaklaşımı

---

# PART 02 — Python AI Service Skeleton

## Claude'a verilecek görev

Python tabanlı AI service iskeletini oluştur.

Teknolojiler:
- FastAPI
- Pydantic
- httpx

İstenen dizin:

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

Kurallar:
- structured JSON response destekli olsun
- Ollama/Gemma HTTP client olsun
- timeout eklensin
- basit API key security olsun
- health endpoint olsun

İstenen çıktı:
- tam çalışan FastAPI skeleton
- route dosyaları
- config/security
- ollama client
- requirements
- Dockerfile
- compose
- env example

---

# PART 03 — NestJS AI Gateway

## Claude'a verilecek görev

NestJS tarafında AI gateway modülünü oluştur.

İstenen yapı:

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

Görevler:
1. Python AI service ile konuşacak NestJS client oluştur
2. aşağıdaki endpointleri ekle:
   - `POST /ai/triage/ticket`
   - `POST /ai/parse/request`
   - `POST /ai/summary/approval`
   - `POST /ai/analytics/summary`
   - `POST /ai/assistant/ask`
3. DTO'ları yaz
4. timeout/fallback mantığını ekle
5. AI service down ise sistem bozulmasın
6. UI tarafına AI unavailable bilgisi verilebilsin
7. feature toggle mantığı ekle

İstenen çıktı:
- NestJS ai module
- controller/service/client
- dto’lar
- env kullanım notları
- fallback mekanizması

---

# PART 04 — Ticket Triage + Workflow + SLA

## Claude'a verilecek görev

IT ticket için AI triage + workflow + SLA entegrasyonunu uygula.

Beklenen akış:
1. kullanıcı IT ticket açar
2. AI triage çalışır
3. AI:
   - request type doğrular
   - ticket category tahmini yapar
   - priority önerir
   - suggested unit verir
   - summary üretir
4. backend bu bilgiyle workflow başlatır
5. SLA policy belirler
6. escalation mantığı bağlanır

Kurallar:
- final karar backend'te
- AI sadece öneri üretir
- AI failure olursa sistem normal çalışır

İstenen JSON output örneği:

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

İstenen çıktı:
- Python triage endpointi
- prompt template
- NestJS integration
- workflow trigger hook
- SLA selection hook
- escalation integration noktaları

---

# PART 05 — Approval Summary

## Claude'a verilecek görev

Approval summary use-case’ini ekle.

Amaç:
- faculty/staff approval ekranında uzun request’i kısaltmak
- karar destek özeti sunmak
- eksik bilgi / risk / revision ihtiyacını belirtmek

Input context:
- request title
- request description
- domain data
- current workflow step
- previous approval actions
- comments summary
- attached file metadata

Structured output örneği:

```json
{
  "summary": "Short summary",
  "missingItems": ["Missing internship letter"],
  "risks": ["Company contact info incomplete"],
  "recommendation": "Needs revision",
  "confidence": 0.81
}
```

İstenen çıktı:
- Python approval summary endpointi
- prompt template
- NestJS endpoint
- faculty/staff ekranına nasıl bağlanacağı
- fallback mantığı

---

# PART 06 — Portal AI Assistants

## Claude'a verilecek görev

Her portal için role-aware AI assistant sistemini kur.

Portallar:
- student
- faculty
- staff
- admin
- organizer

Kurallar:
- assistant sadece route öneren bot olmasın
- role + subrole + scope aware olsun
- sistemle ilgili yardım verebilsin
- yetki dışı veri göstermesin
- clickable link döndürsün
- route mapping ile çalışsın

Beklenen assistant output:

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

Yapılacaklar:
1. portal bazlı assistant promptları
2. route-to-help mapping config
3. role/subrole/scope-aware filtering
4. student/faculty/staff/admin/organizer use-case’leri
5. clickable links

İstenen çıktı:
- assistant service
- route mapping config
- prompt templates
- Python endpoint
- NestJS gateway
- UI entegrasyon önerisi

---

# PART 07 — AI Conversation Persistence

## Claude'a verilecek görev

AI assistant konuşma geçmişini DB’de tut ama UI’da session reset mantığı kur.

Kurallar:
- konuşmalar DB’de kalmalı
- kullanıcı logout olduğunda eski konuşma UI’da görünmemeli
- tab close sonrası yeni session temiz başlamalı
- eski mesajlar otomatik rehydrate edilmemeli
- konuşmalar audit/analytics için tutulmalı

Önerilen tablo yapısı:
- `AiConversation`
- `AiMessage`

Tutulacak alanlar:
- conversation id
- user id
- portal
- role snapshot
- sub role snapshot
- timestamps
- message type
- content
- metadata
- optional linked route/request

İstenen çıktı:
- DB şema önerisi
- backend model/service yapısı
- session reset mantığı
- UI davranış tanımı

---

# PART 08 — IT Analytics

## Claude'a verilecek görev

IT analytics özelliklerini ekle.

İstenen metrikler:
- avg resolution time
- SLA breach rate
- ticket heatmap

Visualization:
- line chart
- bar chart
- trend analysis

Kullanılacak veri kaynakları:
- ItTicket
- Request
- SlaPolicy
- SlaEvent
- RequestAssignment
- DailyMetric
- ReportSnapshot

İstenen çıktı:
- backend analytics query/service
- Python analytics narration endpoint
- chart data contract
- IT dashboard entegrasyon planı
- trend analysis summary

---

# PART 09 — Admin Analytics

## Claude'a verilecek görev

Admin analytics özelliklerini ekle.

İstenen metrikler:
- en yoğun request tipi
- departman bazlı yük
- peak saatler

Visualization:
- line chart
- bar chart
- trend analysis

Kullanılacak veri kaynakları:
- Request
- RequestType
- Faculty
- Department
- Unit
- DailyMetric
- ReportSnapshot

İstenen çıktı:
- backend analytics query/service
- Python analytics narration endpoint
- chart data contract
- admin dashboard/analytics entegrasyon planı
- executive summary

---

# PART 10 — Reliability, Fallback, Security, Final Wiring

## Claude'a verilecek görev

Tüm sistemi production’a yakın şekilde toparla.

Zorunlu kurallar:
- Gemma çalışmıyorsa sistem normal çalışmalı
- AI feature’lar görünmez veya pasif olmalı
- AI service public internete açık olmamalı
- backend’den API key ile erişilmeli
- timeout/fallback her yerde olmalı
- PII dikkatli taşınmalı
- unauthorized route suggestion yapılmamalı

Yapılacaklar:
1. health-based feature toggle
2. AI availability guard
3. UI conditional rendering kuralı
4. backend fallback policy
5. env / docker / deploy notları
6. internal network ve security notları
7. son integration checklist

İstenen çıktı:
- final reliability planı
- fallback implementation
- security checklist
- deploy checklist
- test checklist

---

# Claude Kullanım Şekli

Her seferinde Claude'a şu cümleyle başla:

> Aşağıdaki parçayı uygula. Sadece bu parçaya odaklan. Gerekli dosyaları oluştur veya güncelle. Parça tamamlanınca oluşturduğun dosyaları, yaptığın değişiklikleri ve test etme adımlarını listele.

Sonra ilgili PART bloğunu yapıştır.

---

# Son Not

Bu parçalama, ana prompttaki kapsamı küçültmeden daha yönetilebilir hale getirmek içindir. Ana promptun tüm kapsamı bu parçalara dağıtılmıştır.
