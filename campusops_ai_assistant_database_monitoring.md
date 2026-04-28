# CampusOps AI Assistant – Database ve Monitoring Entegrasyonu

Bu doküman, CampusOps projesinde local çalışan Gemma/Ollama modelini kullanarak proje içi sorulara gerçek database ve sistem monitoring verileriyle cevap veren AI Assistant modülünün nasıl geliştirileceğini anlatır.

---

## 1. Amaç

AI Assistant şu tarz sorulara cevap verebilmelidir:

- Bugün kaç açık talep var?
- Bekleyen onay sayısı kaç?
- Son açılan talepler neler?
- Bu iki ticket arasındaki fark ne?
- Sistem sağlıklı mı?
- RabbitMQ çalışıyor mu?
- Backend, AI servis, worker servisleri aktif mi?
- Bugün event var mı?
- Kullanıcının rolüne göre hangi verilere erişebilir?

Temel amaç:  
AI modelinin kafadan cevap üretmesi değil, backend üzerinden gerçek sistem verisini okuyup doğal dille açıklamasıdır.

---

## 2. Ana Mantık

AI modeli database'e doğrudan bağlanmamalıdır.

Doğru yapı:

```text
Kullanıcı soru sorar
↓
Frontend Chat UI isteği backend'e gönderir
↓
NestJS Assistant API soruyu alır
↓
Intent Router sorunun amacını belirler
↓
İlgili Tool çalışır
↓
Tool database / monitoring / log / queue verisini çeker
↓
Bu veri prompt içine eklenir
↓
Ollama Gemma modeli doğal cevap üretir
↓
Cevap frontend'e döner
```

---

## 3. Önerilen Mimari

```text
frontend/
 └─ assistant-chat.tsx

backend/
 └─ src/
    └─ assistant/
       ├─ assistant.module.ts
       ├─ assistant.controller.ts
       ├─ assistant.service.ts
       ├─ intent-router.service.ts
       ├─ ollama.service.ts
       ├─ prompt-builder.service.ts
       └─ tools/
          ├─ request.tool.ts
          ├─ user.tool.ts
          ├─ monitoring.tool.ts
          ├─ event.tool.ts
          ├─ analytics.tool.ts
          └─ ticket-comparison.tool.ts
```

---

## 4. Temel Kural

AI sadece yorum yapmalıdır.  
Gerçek veriyi backend çekmelidir.

Yanlış kullanım:

```text
AI'ya sor:
Bugün kaç açık talep var?
```

Doğru kullanım:

```text
Backend DB'den açık talep sayısını çeker.
AI'ya şu veri verilir:

Sistem verisi:
Açık talep sayısı: 24

Kullanıcı sorusu:
Bugün kaç açık talep var?
```

AI cevabı:

```text
Bugün sistemde 24 açık talep bulunuyor.
```

---

## 5. Intent Listesi

İlk MVP için kullanılabilecek intent tipleri:

```ts
export enum AssistantIntent {
  REQUEST_COUNT = 'REQUEST_COUNT',
  REQUEST_LIST = 'REQUEST_LIST',
  REQUEST_DETAIL = 'REQUEST_DETAIL',
  REQUEST_COMPARISON = 'REQUEST_COMPARISON',
  APPROVAL_SUMMARY = 'APPROVAL_SUMMARY',
  SYSTEM_MONITORING = 'SYSTEM_MONITORING',
  EVENT_INFO = 'EVENT_INFO',
  USER_INFO = 'USER_INFO',
  ANALYTICS_SUMMARY = 'ANALYTICS_SUMMARY',
  GENERAL_PROJECT = 'GENERAL_PROJECT',
  UNKNOWN = 'UNKNOWN',
}
```

---

## 6. Assistant Controller

```ts
// src/assistant/assistant.controller.ts

import { Body, Controller, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('ask')
  async ask(
    @Body()
    body: {
      question: string;
      userId: string;
      role?: string;
    },
  ) {
    return this.assistantService.ask({
      question: body.question,
      userId: body.userId,
      role: body.role || 'USER',
    });
  }
}
```

---

## 7. Intent Router

```ts
// src/assistant/intent-router.service.ts

import { Injectable } from '@nestjs/common';

@Injectable()
export class IntentRouterService {
  detectIntent(question: string): string {
    const q = question.toLowerCase();

    if (
      q.includes('kaç açık') ||
      q.includes('açık talep') ||
      q.includes('open request') ||
      q.includes('bekleyen talep')
    ) {
      return 'REQUEST_COUNT';
    }

    if (
      q.includes('son talepler') ||
      q.includes('son açılan') ||
      q.includes('recent request')
    ) {
      return 'REQUEST_LIST';
    }

    if (
      q.includes('monitoring') ||
      q.includes('sistem durumu') ||
      q.includes('rabbitmq') ||
      q.includes('worker') ||
      q.includes('cpu') ||
      q.includes('ram')
    ) {
      return 'SYSTEM_MONITORING';
    }

    if (
      q.includes('onay') ||
      q.includes('approval') ||
      q.includes('bekleyen başvuru')
    ) {
      return 'APPROVAL_SUMMARY';
    }

    if (
      q.includes('event') ||
      q.includes('etkinlik') ||
      q.includes('toplantı')
    ) {
      return 'EVENT_INFO';
    }

    if (
      q.includes('karşılaştır') ||
      q.includes('fark') ||
      q.includes('iki ticket')
    ) {
      return 'REQUEST_COMPARISON';
    }

    return 'GENERAL_PROJECT';
  }
}
```

---

## 8. Request Tool

```ts
// src/assistant/tools/request.tool.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RequestTool {
  constructor(private readonly prisma: PrismaService) {}

  async getOpenRequestCount() {
    return this.prisma.request.count({
      where: {
        status: 'OPEN',
      },
    });
  }

  async getPendingApprovalCount() {
    return this.prisma.request.count({
      where: {
        status: 'PENDING_APPROVAL',
      },
    });
  }

  async getRecentRequests() {
    return this.prisma.request.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getRequestSummary() {
    const total = await this.prisma.request.count();
    const open = await this.prisma.request.count({
      where: { status: 'OPEN' },
    });
    const pending = await this.prisma.request.count({
      where: { status: 'PENDING_APPROVAL' },
    });
    const approved = await this.prisma.request.count({
      where: { status: 'APPROVED' },
    });
    const rejected = await this.prisma.request.count({
      where: { status: 'REJECTED' },
    });

    return {
      total,
      open,
      pending,
      approved,
      rejected,
    };
  }
}
```

---

## 9. Monitoring Tool

```ts
// src/assistant/tools/monitoring.tool.ts

import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MonitoringTool {
  async getSystemStatus() {
    const backendStatus = 'ACTIVE';

    let ollamaStatus = 'UNKNOWN';
    let rabbitStatus = 'UNKNOWN';

    try {
      await axios.get('http://OLLAMA_SERVER_IP:11434/api/tags', {
        timeout: 5000,
      });
      ollamaStatus = 'ACTIVE';
    } catch {
      ollamaStatus = 'DOWN';
    }

    try {
      // RabbitMQ Management API açıksa kullanılabilir.
      await axios.get('http://RABBITMQ_HOST:15672/api/overview', {
        auth: {
          username: 'guest',
          password: 'guest',
        },
        timeout: 5000,
      });
      rabbitStatus = 'ACTIVE';
    } catch {
      rabbitStatus = 'DOWN';
    }

    return {
      backendStatus,
      ollamaStatus,
      rabbitStatus,
    };
  }
}
```

---

## 10. Ollama Service

```ts
// src/assistant/ollama.service.ts

import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OllamaService {
  private readonly baseUrl = process.env.OLLAMA_URL || 'http://OLLAMA_SERVER_IP:11434';
  private readonly model = process.env.OLLAMA_MODEL || 'gemma4:e2b';

  async chat(prompt: string) {
    const response = await axios.post(
      `${this.baseUrl}/api/chat`,
      {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
      },
      {
        timeout: 60000,
      },
    );

    return response.data.message.content;
  }
}
```

---

## 11. Prompt Builder

```ts
// src/assistant/prompt-builder.service.ts

import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptBuilderService {
  buildPrompt(params: {
    question: string;
    intent: string;
    role: string;
    systemData: unknown;
  }) {
    return `
Sen CampusOps projesi içinde çalışan bir AI asistansın.

Kurallar:
- Sadece verilen sistem verisine göre cevap ver.
- Sistem verisinde olmayan bilgiyi uydurma.
- Eğer bilgi yoksa "Bu bilgiye şu anda erişemiyorum" de.
- Cevapları kısa, net ve Türkçe ver.
- Kullanıcının rolüne göre hassas bilgileri gösterme.
- Sayısal veri varsa net sayı ver.
- Teknik monitoring sorularında servis durumlarını açıkça belirt.

Kullanıcı rolü:
${params.role}

Intent:
${params.intent}

Kullanıcı sorusu:
${params.question}

Sistem verisi:
${JSON.stringify(params.systemData, null, 2)}

Cevap:
`;
  }
}
```

---

## 12. Assistant Service

```ts
// src/assistant/assistant.service.ts

import { Injectable } from '@nestjs/common';
import { IntentRouterService } from './intent-router.service';
import { RequestTool } from './tools/request.tool';
import { MonitoringTool } from './tools/monitoring.tool';
import { OllamaService } from './ollama.service';
import { PromptBuilderService } from './prompt-builder.service';

@Injectable()
export class AssistantService {
  constructor(
    private readonly intentRouter: IntentRouterService,
    private readonly requestTool: RequestTool,
    private readonly monitoringTool: MonitoringTool,
    private readonly ollamaService: OllamaService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  async ask(params: {
    question: string;
    userId: string;
    role: string;
  }) {
    const intent = this.intentRouter.detectIntent(params.question);

    let systemData: unknown = null;

    if (intent === 'REQUEST_COUNT') {
      const summary = await this.requestTool.getRequestSummary();
      systemData = summary;
    }

    if (intent === 'REQUEST_LIST') {
      const recentRequests = await this.requestTool.getRecentRequests();
      systemData = recentRequests;
    }

    if (intent === 'APPROVAL_SUMMARY') {
      const pendingApprovalCount =
        await this.requestTool.getPendingApprovalCount();

      systemData = {
        pendingApprovalCount,
      };
    }

    if (intent === 'SYSTEM_MONITORING') {
      const status = await this.monitoringTool.getSystemStatus();
      systemData = status;
    }

    if (intent === 'GENERAL_PROJECT') {
      const summary = await this.requestTool.getRequestSummary();
      systemData = {
        projectName: 'CampusOps',
        description:
          'Üniversite içi talep, onay, event, monitoring ve kullanıcı yönetimi sistemi.',
        requestSummary: summary,
      };
    }

    const prompt = this.promptBuilder.buildPrompt({
      question: params.question,
      intent,
      role: params.role,
      systemData,
    });

    const answer = await this.ollamaService.chat(prompt);

    return {
      answer,
      intent,
      data: systemData,
    };
  }
}
```

---

## 13. Assistant Module

```ts
// src/assistant/assistant.module.ts

import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { IntentRouterService } from './intent-router.service';
import { OllamaService } from './ollama.service';
import { PromptBuilderService } from './prompt-builder.service';
import { RequestTool } from './tools/request.tool';
import { MonitoringTool } from './tools/monitoring.tool';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AssistantController],
  providers: [
    AssistantService,
    IntentRouterService,
    OllamaService,
    PromptBuilderService,
    RequestTool,
    MonitoringTool,
    PrismaService,
  ],
  exports: [AssistantService],
})
export class AssistantModule {}
```

---

## 14. App Module'a Ekleme

```ts
// src/app.module.ts

import { Module } from '@nestjs/common';
import { AssistantModule } from './assistant/assistant.module';

@Module({
  imports: [
    AssistantModule,
  ],
})
export class AppModule {}
```

---

## 15. Environment Ayarları

`.env` içine ekle:

```env
OLLAMA_URL=http://188.132.177.238:11434
OLLAMA_MODEL=gemma4:e2b

RABBITMQ_HOST=localhost
RABBITMQ_MANAGEMENT_URL=http://localhost:15672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
```

---

## 16. Frontend Chat Örneği

```tsx
'use client';

import { useState } from 'react';

export default function AssistantChat() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  async function askAssistant() {
    setLoading(true);

    const res = await fetch('/api/assistant/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        userId: 'demo-user-id',
        role: 'ADMIN',
      }),
    });

    const data = await res.json();

    setAnswer(data.answer);
    setLoading(false);
  }

  return (
    <div className="rounded-xl border p-4 space-y-4">
      <h2 className="text-xl font-semibold">CampusOps Assistant</h2>

      <textarea
        className="w-full rounded-lg border p-3"
        placeholder="Örn: Bugün kaç açık talep var?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <button
        onClick={askAssistant}
        disabled={loading}
        className="rounded-lg bg-black px-4 py-2 text-white"
      >
        {loading ? 'Cevaplanıyor...' : 'Sor'}
      </button>

      {answer && (
        <div className="rounded-lg bg-gray-100 p-3">
          {answer}
        </div>
      )}
    </div>
  );
}
```

---

## 17. Rol Bazlı Veri Güvenliği

AI Assistant her kullanıcıya her veriyi göstermemelidir.

Örnek roller:

```text
ADMIN
FACULTY
ADVISOR
STUDENT
STAFF
```

Örnek kural:

```ts
if (role === 'STUDENT') {
  // Sadece kendi taleplerini görebilir.
}

if (role === 'ADMIN') {
  // Tüm sistem özetini görebilir.
}
```

Örnek prompt kuralı:

```text
Kullanıcı STUDENT rolündeyse sistem geneli kullanıcı sayısı, tüm talepler, monitoring detayları gibi hassas bilgileri gösterme.
```

Ama asıl güvenlik prompt ile değil, backend sorgularıyla sağlanmalıdır.

---

## 18. AI'nın Uydurmasını Engelleme

Prompt içine mutlaka şu kurallar eklenmelidir:

```text
Sadece verilen sistem verisine göre cevap ver.
Sistem verisinde olmayan bilgiyi uydurma.
Emin değilsen "Bu bilgiye şu anda erişemiyorum" de.
```

Ayrıca backend cevabında ham data da döndürülebilir:

```ts
return {
  answer,
  intent,
  data: systemData,
};
```

Bu sayede admin panelde AI cevabı ve gerçek veri karşılaştırılabilir.

---

## 19. Örnek Sorular ve Beklenen Akış

### Soru 1

```text
Bugün kaç açık talep var?
```

Akış:

```text
Intent: REQUEST_COUNT
Tool: RequestTool.getRequestSummary()
DB: request.count()
AI: Sayıyı doğal dille açıklar
```

---

### Soru 2

```text
Sistem monitoring durumu nasıl?
```

Akış:

```text
Intent: SYSTEM_MONITORING
Tool: MonitoringTool.getSystemStatus()
Servisler: Backend, Ollama, RabbitMQ
AI: Servis durumlarını açıklar
```

---

### Soru 3

```text
Son açılan talepleri göster.
```

Akış:

```text
Intent: REQUEST_LIST
Tool: RequestTool.getRecentRequests()
DB: Son 5 talep çekilir
AI: Listeyi özetler
```

---

### Soru 4

```text
Onay bekleyen kaç başvuru var?
```

Akış:

```text
Intent: APPROVAL_SUMMARY
Tool: RequestTool.getPendingApprovalCount()
DB: PENDING_APPROVAL sayısı çekilir
AI: Cevap üretir
```

---

## 20. İlk MVP Sırası

Önerilen geliştirme sırası:

```text
1. AssistantModule oluştur
2. /assistant/ask endpoint ekle
3. OllamaService yaz
4. IntentRouterService yaz
5. RequestTool yaz
6. MonitoringTool yaz
7. PromptBuilderService yaz
8. Frontend Chat UI ekle
9. Role-based filtreleme ekle
10. Loglama ve timeout handling ekle
```

---

## 21. Timeout ve Retry

Ollama bazen yavaş cevap verebilir. Axios timeout 60 saniye yapılmalıdır.

```ts
timeout: 60000
```

Daha sonra retry eklenebilir:

```text
1. İlk istek başarısız olursa tekrar dene
2. İkinci istek de başarısız olursa fallback cevap ver
```

Fallback cevap:

```text
AI servisine şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.
```

---

## 22. Loglama

Her assistant isteği loglanmalıdır.

Örnek tablo:

```text
assistant_logs
- id
- userId
- question
- intent
- answer
- systemData
- responseTimeMs
- createdAt
```

Bu ileride şu işler için kullanılır:

- En çok sorulan sorular
- AI hata analizi
- Yavaş cevap tespiti
- Intent geliştirme
- Kullanıcı davranışı analizi

---

## 23. Gelişmiş Versiyon

İlk MVP tamamlandıktan sonra şu özellikler eklenebilir:

```text
- AI ile intent classification
- Tool calling mimarisi
- Streaming response
- Redis cache
- RabbitMQ queue ile async cevap üretimi
- Admin için AI analytics narration
- Ticket similarity search
- Benzer çözüm önerisi
- RAG sistemi
- Vector database
- Role-based AI memory
```

---

## 24. Sonuç

Bu yapı sayesinde CampusOps içinde çalışan AI Assistant:

- Gerçek database verisine göre cevap verir
- Monitoring servislerini kontrol eder
- Talepleri özetler
- Onay süreçlerini yorumlar
- Kullanıcı rolüne göre güvenli cevap üretir
- Local Ollama/Gemma modeliyle çalışır
- Uydurma cevap riskini azaltır

En doğru yaklaşım:

```text
AI = yorumlayan asistan
Backend = veri ve güvenlik katmanı
Database = doğruluk kaynağı
Tool servisleri = AI'nın güvenli veri erişim yolu
```
