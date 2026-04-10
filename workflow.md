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

Yani kullanıcı önce bir talep oluşturur, sonra bu talep bir workflow’a girer, adımlar halinde ilerler, biri atanır, yorum düşülür, onay/red olur, geçmiş tutulur.

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


RequestType + WorkflowDefinition birlikte çalışmalı

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
Aynı kullanıcıya farklı scope’larda farklı roller verebilirsin. Yetkiyi UserRole üzerinden çözmen lazım.