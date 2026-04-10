# Revision Policy — Campus Ops Request Types

## Amaç
Bu doküman, **revision (revizyon)** durumunda hangi alanların:
- düzenlenebilir
- koşullu düzenlenebilir
- kesinlikle değiştirilemez

olduğunu her request tipi için tanımlar.

---

## Global Kurallar

### Asla değiştirilemez (tüm requestler)
- requestId
- requestNo
- requestTypeId
- requesterUserId
- workflowInstanceId
- createdAt

### Sistem kontrolünde olan alanlar
- status
- submittedAt
- completedAt
- closedAt
- assignment alanları
- approval kayıtları

---

# Request Type Bazlı Kurallar

---

## 1. InternshipRequest

### Editable
- companyName
- companySector
- companyContactName
- companyContactEmail
- internshipType
- workMode

### Conditional
- startDate
- endDate
- durationDays
- termId
- insuranceRequired

### Locked
- studentUserId
- advisorUserId
- finalDecisionNote
- currentStageNote

---

## 2. EquipmentRequest

### Editable
- equipmentName
- equipmentCategory
- quantity
- purpose
- urgencyReason

### Conditional
- labResourceId
- neededFrom
- neededUntil

### Locked
- requesterUserId
- stockCheckStatus
- procurementRequired
- estimatedCost

---

## 3. ItTicket

### Editable
- subcategory
- affectedSystem
- assetId
- locationText
- incidentStartedAt

### Conditional
- category

### Locked
- reportedByUserId
- assignedItUserId
- ticketStatus
- resolutionSummary
- resolvedAt
- closedAt
- slaPolicyId

---

## 4. RoomReservationRequest

### Editable
- eventName
- reservationPurpose
- attendeeCount
- setupNotes

### Conditional
- resourceId
- startAt
- endAt
- requiresSecurityApproval
- requiresTechnicalSupport

### Locked
- requesterUserId
- reservationStatus

---

## 5. EventRequest

### Editable
- eventName
- eventType
- description
- expectedAttendance
- locationPreference

### Conditional
- startAt
- endAt
- needsBudget
- estimatedBudget
- needsPosterApproval
- needsSecuritySupport
- needsTechnicalSupport
- clubId

### Locked
- organizerUserId

---

## 6. AccessRequest

### Editable
- justification

### Conditional
- accessType
- targetResource
- requestedRoleOrPermission
- startAt
- endAt

### Locked
- requesterUserId

---

## 7. ProcurementRequest

### Editable
- justification
- vendorPreference

### Conditional
- itemName
- itemCategory
- quantity
- unitPriceEstimate
- budgetCode

### Locked
- requesterUserId
- procurementStatus

---

## 8. DocumentRequest

### Editable
- language
- copiesCount
- deliveryMethod
- deliveryAddress

### Conditional
- documentType

### Locked
- requesterUserId
- issuedAt

---

## 9. AppointmentRequest

### Editable
- topic
- details

### Conditional
- appointmentType
- preferredStartAt
- preferredEndAt

### Locked
- requesterUserId
- targetUserId
- actualAppointmentId

---

# Revision Türleri

## Minor Revision
- sadece editable alanlar değişir
- aynı step devam eder

## Major Revision
- conditional alanlar değişir
- workflow yeniden başlatılabilir
- approval reset olabilir

---

# Backend Önerisi

```ts
type RevisionPolicy = {
  editable: string[];
  conditional: string[];
  locked: string[];
};
```

Her request tipi için ayrı policy tanımla.

---

# Sonuç

Bu yapı sayesinde:
- veri bütünlüğü korunur
- approval sistemi bozulmaz
- audit sağlıklı çalışır
- kullanıcıya kontrollü esneklik verilir
