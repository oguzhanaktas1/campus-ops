# SLA + Workflow Engine Architecture (Campus Ops)

## Amaç
Bu doküman, Campus Ops sisteminde SLA (Service Level Agreement) mekanizmasının
workflow motoru ile birlikte nasıl çalışacağını açıklar.

---

# 1. Genel Mimari

## İki seviyeli SLA modeli

### A) Request-level SLA
Talebin genel yaşam süresini kontrol eder:
- first response
- resolution
- escalation

### B) Workflow Step-level SLA
Her workflow adımının süresini kontrol eder:
- advisor review süresi
- IT triage süresi
- approval gecikmeleri

---

# 2. Veri Yapıları

## SlaPolicy
Kural tablosudur.

Alanlar:
- requestTypeId
- priority
- firstResponseMinutes
- resolutionMinutes
- escalationMinutes

---

## SlaEvent
Gerçekleşen SLA olaylarını tutar.

Event tipleri:
- FIRST_RESPONSE_STARTED
- FIRST_RESPONSE_MET
- FIRST_RESPONSE_BREACHED
- RESOLUTION_STARTED
- RESOLUTION_MET
- RESOLUTION_BREACHED
- ESCALATION_TRIGGERED
- STEP_OVERDUE

---

## WorkflowStep
- slaHours → step bazlı SLA

## WorkflowInstanceStep
- startedAt
- dueAt
- completedAt
- isOverdue

---

# 3. SLA Lifecycle

## 1. Request Submit

Trigger:
- request.status = SUBMITTED

Aksiyon:
- SLA policy bulunur
- 2 event oluşturulur:
  - FIRST_RESPONSE_STARTED
  - RESOLUTION_STARTED
- workflow başlatılır
- ilk step dueAt hesaplanır

---

## 2. First Response

Trigger:
- assign
- first staff comment
- first workflow action

Aksiyon:
- FIRST_RESPONSE_STARTED resolve edilir
- FIRST_RESPONSE_MET veya BREACHED oluşturulur

---

## 3. Workflow Step Start

Trigger:
- yeni step başlar

Aksiyon:
- dueAt = startedAt + slaHours

---

## 4. Workflow Step Complete

Trigger:
- step tamamlandı

Aksiyon:
- now > dueAt ise:
  - isOverdue = true
  - STEP_OVERDUE event/log

---

## 5. Resolution

Trigger:
- request final status:
  - COMPLETED
  - CLOSED
  - APPROVED
  - REJECTED

Aksiyon:
- RESOLUTION_STARTED resolve edilir
- RESOLUTION_MET veya BREACHED oluşturulur

---

## 6. Escalation

Trigger:
- now > createdAt + escalationMinutes
- hala çözülmemiş

Aksiyon:
- ESCALATION_TRIGGERED
- notification
- internal comment
- optional reassignment

---

# 4. Cron Job

## Frekans
- her 5 dakika

## İşlemler

### 1. First Response Breach
- FIRST_RESPONSE_STARTED açık
- süre dolmuş
→ BREACHED

### 2. Resolution Breach
- RESOLUTION_STARTED açık
- süre dolmuş
→ BREACHED

### 3. Escalation
- escalation süresi dolmuş
→ ESCALATION_TRIGGERED

### 4. Step Overdue
- dueAt < now
- completedAt null
→ isOverdue = true

---

# 5. Backend Servisleri

## SLA
- startRequestSla(requestId)
- markFirstResponse(requestId)
- markResolution(requestId)
- checkAndEscalateRequestSla()

## Workflow
- createWorkflowInstance()
- createWorkflowStep()
- completeWorkflowStep()
- moveToNextStep()

---

# 6. First Response Tanımı

Sayılır:
- assignment
- first staff comment
- first review action

Sayılmaz:
- requester update
- requester comment

---

# 7. Resolution Tanımı (Request Type Bazlı)

IT_SUPPORT:
- CLOSED / COMPLETED

ROOM_RESERVATION:
- APPROVED / REJECTED

DOCUMENT_REQUEST:
- ISSUED / COMPLETED

INTERNSHIP:
- APPROVED / REJECTED

APPOINTMENT:
- CONFIRMED / DECLINED

ACCESS_REQUEST:
- GRANTED / REJECTED

PROCUREMENT:
- COMPLETED / REJECTED

EVENT_REQUEST:
- APPROVED / REJECTED

EQUIPMENT:
- COMPLETED / REJECTED

---

# 8. UI Gösterimleri

## Request Detail
- SLA deadlines
- current SLA state
- overdue badge
- step dueAt

## Dashboard
- SLA success rate
- overdue count
- escalation count
- role bazlı performans

---

# 9. Temel Kurallar

1. Draft → SLA başlamaz
2. Submit → SLA başlar
3. First action → first response kapanır
4. Final status → resolution kapanır
5. Step start → dueAt hesaplanır
6. Step geçerse → overdue
7. escalationMinutes → escalation
8. cron job sürekli kontrol eder

---

# 10. Sonuç

Bu yapı ile:

- SLA aktif çalışır
- workflow ile entegre olur
- gecikmeler yakalanır
- escalation otomatik olur
- sistem production-grade hale gelir
