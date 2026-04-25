# Campus Ops – Unified Request Workflow System

## 🎯 Overview

This document defines a clean, scalable workflow system:

- Minimal global statuses
- Stage-based workflow progression
- Role-based approval chains
- Configurable per request type

---

# 🧠 Core Principle

✅ Status = high-level state  
✅ Stage = current step in workflow  

---

# 🔄 Global Request Status (Minimal)

```ts
export enum RequestStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}
```

---

# 🧩 Workflow Stage (Detailed Steps)

```ts
export enum RequestStage {
  ADVISOR_REVIEW,
  INTERNSHIP_COORDINATOR_REVIEW,
  DOCUMENT_PROCESSING,
  RESOURCE_REVIEW,
  SECURITY_REVIEW,
  IT_REVIEW,
  MANAGER_APPROVAL,
  BUDGET_REVIEW,
  FINANCE_REVIEW,
  PROCUREMENT_REVIEW,
  EVENT_COORDINATOR_REVIEW,
  TECHNICAL_REVIEW
}
```

---

# ⚙️ Workflow Step Status

```ts
export enum WorkflowStepStatus {
  PENDING,
  ACTIVE,
  APPROVED,
  REJECTED
}
```

---

# 🔁 Generic Lifecycle

```txt
DRAFT → SUBMITTED → IN_REVIEW → APPROVED / REJECTED → IN_PROGRESS → COMPLETED → CLOSED
```

---

# 📌 Request Type Implementations

---

## 1. INTERNSHIP_REQUEST

```txt
SUBMITTED
→ ADVISOR_REVIEW
→ INTERNSHIP_COORDINATOR_REVIEW
→ APPROVED / REJECTED
```

Example:

```json
{
  "status": "IN_REVIEW",
  "currentStage": "ADVISOR_REVIEW"
}
```

---

## 2. DOCUMENT_REQUEST

```txt
SUBMITTED
→ DOCUMENT_PROCESSING
→ APPROVED
```

---

## 3. ROOM_RESERVATION

```txt
SUBMITTED
→ RESOURCE_REVIEW
→ SECURITY_REVIEW
→ APPROVED
```

---

## 4. APPOINTMENT

```txt
SUBMITTED
→ RESOURCE_REVIEW
→ APPROVED
```

---

## 5. IT_SUPPORT

```txt
SUBMITTED
→ IT_REVIEW
→ MANAGER_APPROVAL (optional)
→ APPROVED → IN_PROGRESS → COMPLETED
```

---

## 6. EQUIPMENT

```txt
SUBMITTED
→ TECHNICAL_REVIEW
→ RESOURCE_REVIEW
→ APPROVED
```

---

## 7. ACCESS_REQUEST

```txt
SUBMITTED
→ SECURITY_REVIEW
→ IT_REVIEW
→ MANAGER_APPROVAL
→ APPROVED
```

---

## 8. PROCUREMENT_REQUEST

```txt
SUBMITTED
→ BUDGET_REVIEW
→ PROCUREMENT_REVIEW
→ FINANCE_REVIEW
→ APPROVED
```

---

## 9. EVENT_REQUEST

```txt
SUBMITTED
→ EVENT_COORDINATOR_REVIEW
→ RESOURCE_REVIEW
→ SECURITY_REVIEW
→ APPROVED
```

---

## 10. EVENT_CREATION_REQUEST

```txt
SUBMITTED
→ ADVISOR_REVIEW
→ EVENT_COORDINATOR_REVIEW
→ RESOURCE_REVIEW
→ SECURITY_REVIEW
→ APPROVED
```

---

# 🧱 Data Model Example

```ts
{
  id: string;
  type: string;
  status: RequestStatus;
  currentStage?: RequestStage;
  currentStep: number;

  steps: [
    {
      role: string;
      status: WorkflowStepStatus;
      actedBy?: string;
      actedAt?: Date;
    }
  ];
}
```

---

# 🚀 Key Design Decisions

- Status is always simple
- Stage drives workflow logic
- Steps track history
- Everything is configurable per request type

---

# ⚠️ Important Rule

❌ Do NOT use stage as status  
❌ Do NOT create too many statuses  

✔ Keep status minimal  
✔ Use stage for flow  

---

# 🧠 Final Insight

This system is:

- Scalable
- Clean
- Easy to maintain
- Enterprise-ready

