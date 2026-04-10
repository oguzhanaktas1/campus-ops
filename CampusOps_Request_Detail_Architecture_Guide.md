# CampusOps Request Detail Architecture Guide

## Amaç

Bu belge, CampusOps projesindeki **9 ana request domain modülü** için senior seviye detail page mimarisini tanımlar.

Hedef:
- her request domain için ayrı ayrı dağınık detail sayfaları üretmemek
- ortak bir **Request Detail Shell** kurmak
- domain-specific panelleri bu shell içine takmak
- portal bazlı aksiyonları (student/faculty/staff/admin) ayrı yönetmek
- backend tarafında tek bir **detail aggregator contract** ile ilerlemek

---

# 1. Ana Mimari Karar

## Doğru yaklaşım
Her request için:

- ortak bir detail shell
- domain-specific overview panel
- portal-specific action panel
- workflow/timeline/comments/files gibi ortak bloklar

kullanılmalı.

## Yanlış yaklaşım
Şunu yapma:

- `/student/internships/[id]` ayrı mimari
- `/faculty/internships/[id]` ayrı mimari
- `/staff/tickets/[id]` ayrı mimari
- `/admin/tickets/[id]` ayrı mimari

ve hepsini sıfırdan farklı tasarlama.

Bu yaklaşım:
- bakım maliyetini artırır
- tekrar eden component üretir
- permission logic'i dağıtır
- bug fix'i zorlaştırır

---

# 2. Route Stratejisi

## Canonical detail route'lar

```txt
/student/requests/[id]
/faculty/requests/[id]
/staff/requests/[id]
/admin/requests/[id]
```

Bu route'lar sistemin **gerçek detail route**'ları olmalı.

## Domain liste route'ları

```txt
/student/internships
/student/documents
/student/appointments
/student/reservations

/faculty/internships
/faculty/approvals
/faculty/student-requests
/faculty/appointments

/staff/requests
/staff/tickets
/staff/reservations
/staff/documents
/staff/approvals
```

## Domain-specific alias detail route
İstersen UX için şu route'lar da olabilir:

```txt
/faculty/internships/[id]
/staff/tickets/[id]
/staff/reservations/[id]
```

Ama bunlar:
- ya unified request detail component render etmeli
- ya da `requests/[id]`'e redirect etmeli

---

# 3. Ortak Detail Shell Yapısı

## Sayfa wireframe

```txt
┌──────────────────────────────────────────────────────────┐
│ RequestHeader                                            │
│ requestNo | title | type | status | priority            │
└──────────────────────────────────────────────────────────┘

┌───────────────────────────────┬──────────────────────────┐
│ Left Column                   │ Right Column             │
│                               │                          │
│ RequestMetaCard               │ RequestActionPanel       │
│ DomainDetailPanel             │ WorkflowCurrentStepCard  │
│ RequestAttachmentsPanel       │ RequestQuickFactsCard    │
│ RequestCommentsPanel          │ RelatedEntitiesCard      │
│                               │                          │
└───────────────────────────────┴──────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Timeline / Activity Tabs                                 │
│ [Status] [Assignments] [Approvals] [Audit]              │
└──────────────────────────────────────────────────────────┘
```

## Ortak bloklar
Her request detail’de ortak bulunmalı:

- Request header
- Request meta
- Workflow current step
- Status history
- Assignment history
- Approval history
- Comments
- Attachments
- Activity / audit özeti
- Portal-specific action panel

---

# 4. Component Tree

```txt
features/request-detail/
  RequestDetailPage.tsx

  components/
    RequestHeader.tsx
    RequestMetaCard.tsx
    RequestQuickFactsCard.tsx
    WorkflowCurrentStepCard.tsx
    RequestTimelineTabs.tsx
    RequestStatusHistoryTab.tsx
    RequestAssignmentsTab.tsx
    RequestApprovalsTab.tsx
    RequestAuditTab.tsx
    RequestCommentsPanel.tsx
    RequestAttachmentsPanel.tsx
    RequestActionPanel.tsx
    RelatedEntitiesCard.tsx

  domain-panels/
    InternshipDetailPanel.tsx
    EquipmentDetailPanel.tsx
    TicketDetailPanel.tsx
    ReservationDetailPanel.tsx
    EventDetailPanel.tsx
    AccessDetailPanel.tsx
    ProcurementDetailPanel.tsx
    DocumentDetailPanel.tsx
    AppointmentDetailPanel.tsx

  action-resolvers/
    resolveStudentActions.ts
    resolveFacultyActions.ts
    resolveStaffActions.ts
    resolveAdminActions.ts

  mappers/
    mapRequestDetailToViewModel.ts

  hooks/
    useRequestDetail.ts
    useAvailableActions.ts
    useRequestPermissions.ts
```

---

# 5. Backend Response Contract

Frontend detail sayfası 6-7 farklı endpoint'e gitmemeli.  
Bunun yerine backend tek bir **aggregated detail response** dönmeli.

## Önerilen endpoint

```txt
GET /requests/:id/detail
```

veya portal-specific:

```txt
GET /student/requests/:id/detail
GET /faculty/requests/:id/detail
GET /staff/requests/:id/detail
GET /admin/requests/:id/detail
```

## Response contract örneği

```json
{
  "request": {
    "id": "req_123",
    "requestNo": "REQ-2026-000123",
    "title": "Internship approval",
    "status": "WAITING_APPROVAL",
    "priority": "MEDIUM",
    "createdAt": "2026-04-10T10:00:00Z",
    "submittedAt": "2026-04-10T10:05:00Z",
    "dueAt": "2026-04-15T10:05:00Z",
    "sourceChannel": "WEB"
  },
  "requestType": {
    "key": "INTERNSHIP_REQUEST",
    "name": "Internship Request",
    "category": "ACADEMIC"
  },
  "scope": {
    "faculty": { "id": "f1", "name": "Engineering" },
    "department": { "id": "d1", "name": "Computer Engineering" },
    "unit": null
  },
  "requester": {
    "id": "u1",
    "fullName": "Student Name",
    "email": "student@example.com"
  },
  "currentAssignee": {
    "id": "u2",
    "fullName": "Advisor Name"
  },
  "domainData": {},
  "workflow": {
    "instance": {
      "id": "wf_1",
      "status": "ACTIVE"
    },
    "currentStep": {
      "id": "step_2",
      "stepKey": "ADVISOR_APPROVAL",
      "stepName": "Advisor Approval",
      "stepType": "APPROVAL",
      "dueAt": "2026-04-12T12:00:00Z",
      "isOverdue": false
    },
    "steps": [],
    "approvalActions": []
  },
  "comments": [],
  "attachments": [],
  "statusHistory": [],
  "assignments": [],
  "relatedEntities": {
    "appointment": null,
    "reservation": null,
    "resource": null,
    "club": null
  },
  "availableActions": [
    "APPROVE",
    "REJECT",
    "REQUEST_REVISION"
  ],
  "permissions": {
    "canComment": true,
    "canUploadFile": true,
    "canApprove": true,
    "canAssign": false,
    "canCancel": false
  }
}
```

## Kritik kural
Frontend kendi başına aksiyon üretmemeli.  
**`availableActions` backend’den gelmeli.**

---

# 6. 9 Domain Modül İçin Detail Tasarımı

---

## 6.1 InternshipRequest Detail

### Header
- Request No
- Status
- Current Step
- Student
- Advisor
- Academic Term

### Overview alanı
- Company Name
- Company Sector
- Company Contact Name
- Company Contact Email
- Internship Type
- Work Mode
- Start Date
- End Date
- Duration Days
- Insurance Required

### Ek alanlar
- Current Stage Note
- Final Decision Note

### Alt paneller
- Uploaded internship documents
- Approval history
- Revision notes
- Comments
- Attachments

### Portal action'ları

#### Student
- Revise submission
- Upload missing file
- Add comment
- Cancel request

#### Faculty
- Approve
- Reject
- Request revision
- Add advisor note

#### Staff
- Check missing documents
- Forward to next stage
- Internal note

#### Admin
- Reassign
- Override decision
- Force close

---

## 6.2 EquipmentRequest Detail

### Header
- Request No
- Status
- Priority
- Requester
- Assigned Unit

### Overview
- Equipment Name
- Equipment Category
- Quantity
- Lab Resource
- Purpose
- Needed From
- Needed Until
- Urgency Reason
- Stock Check Status
- Procurement Required
- Estimated Cost

### Alt paneller
- Lab/resource info
- Stock/procurement notes
- Attachments
- Comments
- Status history

### Portal action'ları

#### Requester
- Comment
- Add file
- Cancel if pending

#### Staff
- Mark stock checked
- Request procurement
- Approve / reject
- Assign to lab / procurement

#### Admin
- Reassign
- Override
- Force close

---

## 6.3 ItTicket Detail

### Header
- Ticket No
- Ticket Status
- Priority
- Reporter
- Assigned IT Agent
- SLA badge

### Overview
- Category
- Subcategory
- Affected System
- Asset ID
- Location
- Incident Started At
- Resolution Summary
- Resolved At
- Reopened Count

### Özel paneller
- SLA events
- Internal notes
- Public comment thread
- Uploaded screenshots/files
- Similar issues (ileride AI / similarity ile)

### Portal action'ları

#### Student / Faculty
- Add reply
- Confirm issue resolved
- Reopen request

#### Staff / IT
- Triage
- Assign
- Change status
- Mark waiting user
- Resolve
- Close
- Reopen

#### Admin
- Override agent
- Reassign
- SLA override
- Force close

---

## 6.4 RoomReservationRequest Detail

### Header
- Request No
- Reservation Status
- Resource
- Start / End
- Requester

### Overview
- Event Name
- Reservation Purpose
- Resource Name
- Resource Type
- Attendee Count
- StartAt / EndAt
- Requires Security Approval
- Requires Technical Support
- Setup Notes

### Özel paneller
- Resource availability
- Conflict detection
- Linked reservation
- Venue notes
- Attachments
- Comments

### Portal action'ları

#### Student / Faculty
- Update request
- Cancel request
- Add note

#### Staff
- Approve
- Reject
- Resolve conflict
- Create/confirm reservation
- Escalate for security or technical review

#### Admin
- Override
- Manual reservation creation
- Force close

---

## 6.5 EventRequest Detail

### Header
- Request No
- Event Name
- Organizer
- Club
- Status
- Date Range

### Overview
- Event Type
- Description
- Expected Attendance
- Location Preference
- Needs Budget
- Estimated Budget
- Needs Poster Approval
- Needs Security Support
- Needs Technical Support

### Özel paneller
- Poster files
- Budget/finance notes
- Venue/resource links
- Club information
- Workflow history
- Comments

### Portal action'ları

#### Student / Club owner
- Update submission
- Upload poster
- Add comment

#### Faculty advisor
- Review
- Approve / reject
- Request revision

#### Staff
- Venue review
- Security review
- Technical support review
- Budget routing

#### Admin
- Override
- Reassign
- Final approval

---

## 6.6 AccessRequest Detail

### Header
- Request No
- Access Type
- Status
- Requester
- Target Resource

### Overview
- Access Type
- Target Resource
- Requested Role / Permission
- Justification
- StartAt
- EndAt

### Özel paneller
- Security notes
- Approval log
- Audit summary
- Attachments
- Comments

### Portal action'ları

#### Requester
- Add clarification
- Cancel if pending

#### Staff / Security / IT
- Approve
- Reject
- Request revision
- Mark granted
- Mark expired

#### Admin
- Override
- Reassign
- Force revoke / close

---

## 6.7 ProcurementRequest Detail

### Header
- Request No
- Status
- Procurement Status
- Requester
- Total Estimate

### Overview
- Item Name
- Item Category
- Quantity
- Unit Price Estimate
- Total Estimate
- Vendor Preference
- Justification
- Budget Code

### Özel paneller
- Finance notes
- Vendor files / quotations
- Approval chain
- Comments
- Attachments

### Portal action'ları

#### Requester
- Add clarification
- Upload quotation
- Cancel if pending

#### Staff / Procurement
- Assign buyer
- Request more info
- Approve / reject
- Update procurement status

#### Admin
- Override
- Reassign
- Force close

---

## 6.8 DocumentRequest Detail

### Header
- Request No
- Document Type
- Status
- Requester
- Delivery Method

### Overview
- Document Type
- Language
- Copies Count
- Delivery Method
- Delivery Address
- Issued At

### Özel paneller
- Generated document file
- Delivery info
- Processing notes
- Status history
- Comments

### Portal action'ları

#### Student
- View status
- Download output
- Update delivery info if allowed

#### Staff
- Mark processing
- Mark issued
- Upload final document
- Complete request

#### Admin
- Override
- Reassign
- Force complete / close

---

## 6.9 AppointmentRequest Detail

### Header
- Request No
- Requester
- Target User
- Appointment Type
- Status

### Overview
- Appointment Type
- Topic
- Details
- Preferred Start
- Preferred End
- Linked Actual Appointment

### Özel paneller
- Target availability
- Linked calendar event
- Meeting location / URL
- Comments
- Workflow history

### Portal action'ları

#### Student
- Cancel
- Update preference
- Add note

#### Faculty / Staff target
- Accept
- Decline
- Propose slot
- Create actual appointment

#### Admin
- Reassign host
- Cancel
- Override scheduling

---

# 7. Portal Bazlı Action Policy

## Student portal
Göster:
- comment
- upload file
- cancel own request
- revise if asked
- view timeline

Gösterme:
- assign
- approve
- internal note
- workflow override

## Faculty portal
Göster:
- approve / reject / request revision
- advisor note
- appointment accept / decline
- kendi scope’una ait yorum ve işlem butonları

Gösterme:
- global override
- geniş reassign
- sistem yönetimi aksiyonları

## Staff portal
Göster:
- assign / reassign within scope
- internal note
- approve operational steps
- process reservation / document / ticket
- status güncelleme

## Admin portal
Göster:
- tüm aksiyonlar
- override
- force close
- reassign
- workflow diagnostics

---

# 8. Frontend Implementation Pattern

## Kullanım önerisi

```tsx
<RequestDetailPage
  portal="faculty"
  requestId={params.id}
/>
```

## İç mimari

```tsx
const detail = useRequestDetail(requestId, portal);

return (
  <RequestDetailShell
    request={detail.request}
    workflow={detail.workflow}
    domainPanel={
      <DomainPanelResolver
        requestType={detail.requestType.key}
        domainData={detail.domainData}
      />
    }
    actions={
      <ActionPanelResolver
        portal={portal}
        availableActions={detail.availableActions}
        permissions={detail.permissions}
      />
    }
  />
);
```

Bu sayede:
- detail shell tek olur
- domain panel runtime'da seçilir
- action panel portal ve permission'a göre belirlenir

---

# 9. Backend Service Mimarisi

## Önerilen servisler

```txt
RequestsService
RequestDetailService
WorkflowService
ApprovalService
AssignmentService
CommentService
FileService
PermissionService
```

## En kritik servis
### RequestDetailService

Bu servis:

- request’i çeker
- request type’ı bulur
- domain relation’ı include eder
- workflow verisini toplar
- comments / files / history / approvals ekler
- availableActions hesaplar
- unified detail response döner

Bu servis olmadan detail mimarisi parçalanır.

---

# 10. Prisma / Query Stratejisi

Tek bir request detail sorgusu mantığı ile ilerle.

## Include map yaklaşımı
`requestType.key`’e göre include relation’ı seç.

Örnek mantık:

```ts
if (requestType.key === 'INTERNSHIP_REQUEST') {
  include.internshipRequest = true;
}

if (requestType.key === 'IT_TICKET') {
  include.itTicket = {
    include: {
      slaPolicy: true,
    },
  };
}
```

Ama dışarıya dönen response hep aynı shape'te olsun:
- request
- requestType
- domainData
- workflow
- comments
- attachments
- availableActions

---

# 11. Yetkilendirme Modeli

## Görme yetkisi kontrolü
Bir kullanıcı detail sayfasını açabiliyor mu?

Kontrol sırası:

1. admin mi?
2. request’in requester’ı mı?
3. current assignee mi?
4. current workflow approver mı?
5. aynı faculty / department / unit scope’unda mı?
6. ilgili domain role / permission’a sahip mi?

## Action yetkisi kontrolü
Butonlar gösterilecek mi?

Kontrol sırası:

1. request status uygun mu?
2. current workflow step buna izin veriyor mu?
3. role / permission uygun mu?
4. ownership / scope uygun mu?

## Kritik not
Route guard yeterli değil.  
**Record-level authorization** şart.

---

# 12. Senior-Level Final Karar

## Aç
- her portal için `requests/[id]`
- her domain için ayrı liste sayfası
- gerekirse alias detail route

## Açma
- her portal x her domain için tamamen bağımsız detail sistemi

## Kur
- unified request detail shell
- domain panel resolver
- portal action resolver
- backend-driven `availableActions`
- request detail aggregator service

---

# 13. Sonuç

Bu mimari sayesinde:

- tek bakım noktası oluşur
- 9 domain modül ölçeklenebilir hale gelir
- student/faculty/staff/admin farklı davranabilir
- workflow / comments / files / timeline tutarlı kalır
- backend ve frontend daha düzenli büyür

## Ana prensip
**Her domain için ayrı detail UI olabilir ama ayrı detail architecture olmamalı.**

Doğru yaklaşım:
- ortak request detail shell
- domain-specific overview panel
- portal-specific action sistemi
- backend-driven permission + availableActions
