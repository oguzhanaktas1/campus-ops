Bu şemayı tek tek tüm tabloları ayrı ayrı kullanayım diye değil, tek bir merkez etrafında kullanmalısın: o merkez Request tablosu. Senin sisteminde neredeyse her iş akışı bir “talep” olarak başlamalı. Şemaya göre Request, RequestType, workflow, assignment, comment, notification, SLA ve alt modülleri birbirine bağlayan ana omurga zaten bu.

Senin kullanım mantığın bence şöyle olmalı:

1) Sistemi 4 ana katman olarak düşün
A. Organizasyon yapısı

Bunlar kurumun hiyerarşisi:

Campus
Faculty
Department
Unit

Kullanıcı profilleri, roller, kaynaklar ve talepler bu yapılara bağlanıyor. Yani “kim hangi fakültede”, “hangi birim sorumlu”, “hangi oda hangi kampüste” gibi şeyleri buradan çözersin. UserProfile, Faculty, Department, Unit, Resource ve Request arasında bu bağlar açıkça kurulmuş.

B. Kimlik ve yetki

Bunlar auth/RBAC kısmı:

User
UserProfile
Role
Permission
RolePermission
UserRole

Burada önemli nokta şu: kullanıcıya tek bir role verme mantığı yok; kullanıcıya farklı scope’larda rol verebiliyorsun. Mesela biri global admin olabilir, biri sadece belirli faculty için staff olabilir, biri department bazlı yetkili olabilir. Bunu UserRole içindeki facultyId, departmentId, unitId alanlarıyla çözüyorsun.

C. Talep ve iş akışı motoru

Burası sistemin kalbi:

RequestType
Request
RequestStatusHistory
RequestAssignment
RequestComment
RequestWatcher
WorkflowDefinition
WorkflowStep
WorkflowTransition
WorkflowInstance
WorkflowInstanceStep
ApprovalAction

Yani kullanıcı önce bir talep oluşturur, sonra bu talep bir workflow’a girer, adımlar halinde ilerler, biri atanır, yorum düşülür, onay/red olur, geçmiş tutulur. Şema zaten buna göre tasarlanmış.

D. Domain modülleri

Bunlar talebin tipi neyse onun detay tablosu:

InternshipRequest
EquipmentRequest
ItTicket
RoomReservationRequest
EventRequest
AccessRequest
ProcurementRequest
DocumentRequest
AppointmentRequest

Yani Request genel kayıt, bunlar ise o request’in özel detayları. Mesela bir IT support kaydı açıldığında:

Request içine genel bilgi,
ItTicket içine teknik detay girersin.
Aynı mantık equipment, reservation, appointment için de geçerli.
2) En doğru kullanım modeli: “Request-first architecture”

Sen bu DB’yi şöyle kullanmalısın:

Örnek: öğrenci staj başvurusu açıyor
RequestType = internship
Request kaydı oluşur
InternshipRequest kaydı oluşur
ilgili WorkflowInstance başlatılır
ilk step danışmana veya fakülteye atanır
durum değiştikçe:
RequestStatusHistory
WorkflowInstanceStep
ApprovalAction
Notification
kayıtları oluşur

Yani özel tabloyu asla tek başına kullanma. Önce Request, sonra onun alt detay tablosu.

Aynı şey:

bakım talebi için Request + ItTicket
ekipman için Request + EquipmentRequest
oda rezervasyonu için Request + RoomReservationRequest
randevu için Request + AppointmentRequest
şeklinde ilerlemeli. Şemadaki birebir/tekil ilişkiler de bunu destekliyor; birçok alt modülde requestId alanı @unique. Bu da “bir request = bir domain detay kaydı” mantığını gösteriyor.
3) Frontend’de modül değil, portal bazlı düşün

Bu şemada bence frontend’i şöyle kurman daha mantıklı:

Student portal

Öğrenci şunları açar:

internship request
document request
appointment request
access request
room reservation
event request
kendi request listesi
Staff portal

Staff şunları yönetir:

assigned requests
maintenance / IT / equipment
reservation approvals
workflow action ekranları
resource availability
dashboard
Faculty portal

Faculty:

internship approvals
departmental document processes
event approvals
student requests visibility
Admin portal

Admin:

campus/faculty/unit yönetimi
role & permission yönetimi
request type yönetimi
workflow tasarımı
SLA / integrations / reports / audit

Sebep şu: şema role ve scope mantığıyla tasarlanmış; “sayfa” mantığından çok “kim neyi hangi scope’ta görüyor” mantığı var. UserRole ve organizasyon alanları bunu doğrudan destekliyor.

4) RequestType + WorkflowDefinition birlikte çalışmalı

Bu DB’nin en güçlü tarafı burada.

Her talep tipi için:

bir RequestType
ona bağlı bir WorkflowDefinition
tanımlarsın.

Mesela:

IT Ticket workflow
Start
Triage
Assignment
In Progress
Waiting User
Resolved
Closed
Internship workflow
Submit
Advisor Review
Faculty Approval
Final Approval
Completed
Room reservation workflow
Submit
Conflict Check
Facility Review
Approval / Reject
Reservation Create

Şemada RequestType.workflowDefinitionId, WorkflowStep, WorkflowTransition, WorkflowInstance, WorkflowInstanceStep ilişkileri bunu doğrudan kuruyor. Yani hardcode if-else ile bütün akışları yönetmek yerine workflow motoru üzerinden götürmen daha doğru olur.

5) Resource ve Reservation kısmını ayrı mantıkla ele al

Şemada oda/lab/ekipman gibi fiziksel varlıklar için ayrı kaynak yapısı var:

Resource
ResourceAvailability
Reservation
ReservationConflict
RoomReservationRequest

Bu demek oluyor ki:

Resource = oda/lab/araç/ekipman tanımı
ResourceAvailability = düzenli müsaitlik slotları
RoomReservationRequest = kullanıcının rezervasyon talebi
Reservation = gerçekten oluşturulmuş rezervasyon
ReservationConflict = çakışma kaydı

Yani rezervasyon akışında kullanıcı doğrudan Reservation oluşturmamalı. Önce talep açmalı (RoomReservationRequest), onay sonrası gerçek Reservation oluşmalı. Şema buna çok net işaret ediyor.

6) Appointment tarafında da aynı mantık

Burada da iki aşama var:

AppointmentRequest
Appointment

Önce randevu isteği gelir, sonra kabul edilirse gerçek randevu oluşturulur. Ayrıca:

AppointmentParticipant
UserAvailabilitySlot
ile takvim ve katılımcı mantığı da desteklenmiş. Yani doğrudan randevu yaratmak yerine çoğu durumda request üzerinden gitmelisin.
7) Bildirim, dosya, audit, email, metrics katmanlarını en baştan aktif tasarla

Bu şemada sadece business tablolar yok; operasyonel tablolar da var:

File, FileLink
Notification, EmailLog, NotificationPreference
AuditLog, LoginHistory
DailyMetric, ReportSnapshot, DashboardCache
WebhookLog, IntegrationJob, N8nWorkflowRun

Yani sistem sadece CRUD değil; izlenebilirlik ve raporlama için de hazırlanmış. Bu yüzden daha baştan:

request açılınca notification üret
status değişince audit log yaz
dosyaları FileLink ile request’e bağla
dashboard için aggregate metric üret
mantığıyla ilerlemen gerekir. Şema zaten bunu hedefliyor.
8) Sana en doğru geliştirme sırası

Bu şemayı tek seferde kullanmaya çalışma. Aşamalı git:

Faz 1 — temel iskelet
auth
user/profile
role/permission
campus/faculty/department/unit
request type
generic request create/list/detail
Faz 2 — workflow
workflow definition
workflow step/transition
request submit
assign / approve / reject / revision
status history
Faz 3 — ilk gerçek modüller

Önce en kritik 3 modülü bağla:

ItTicket
EquipmentRequest
RoomReservationRequest
Faz 4 — destek sistemleri
comments
files
notifications
email logs
audit logs
Faz 5 — ileri modüller
appointment
event
procurement
document
access request
reporting / SLA / integrations

Bu şema büyük; hepsini aynı anda bağlamaya çalışırsan frontend-backend birbirine dolaşır.

9) En büyük hata ne olur?

Bu şemada yapılabilecek en büyük hata şu olur:

Hata 1:

Her modül için ayrı bağımsız sistem yazmak
Örn. IT için ayrı tablo mantığı, reservation için ayrı lifecycle, internship için ayrı approval kodu.

Doğrusu:

ortak Request
ortak Workflow
ortak Assignment
ortak Comment
ortak Notification
Hata 2:

Role kontrolünü sadece frontend’de yapmak

Doğrusu:
Backend’de UserRole + Permission + scope ile kontrol etmelisin. Çünkü şema bunun için kurulmuş.

Hata 3:

Faculty/staff ayrımını sadece UI üzerinden yapmak

Doğrusu:
Aynı kullanıcıya farklı scope’larda farklı roller verebilirsin. Yetkiyi UserRole üzerinden çözmen lazım