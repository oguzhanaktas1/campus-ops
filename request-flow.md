Her request için 3 şey tanımlıyoruz:

Owner Unit (sorumlu birim)
Processing Roles (işleyen roller)
Approval Roles (onaylayan roller)

Ek olarak:

kim görür
kim görmez
📊 9 REQUEST İÇİN TAM MAPPING
1) 🎓 INTERNSHIP REQUEST (Staj)
Owner Unit
Faculty / Department
Processing
advisor
internship_coordinator
Approval
advisor (ilk onay)
internship_coordinator (final)
Visibility

✔ student (kendi)
✔ advisor (kendi öğrencileri)
✔ internship_coordinator (faculty bazlı)
✔ admin

❌ diğer faculty
❌ staff
❌ başka departman advisor

2) 🖥️ IT TICKET
Owner Unit
IT Unit (central veya faculty IT)
Processing
it_agent
Approval
it_manager (opsiyonel / kritik durumlarda)
Visibility

✔ requester
✔ assigned it_agent
✔ it_manager
✔ aynı IT unit içindekiler
✔ admin

❌ tüm staff
❌ faculty
❌ diğer birimler

3) 📄 DOCUMENT REQUEST
Owner Unit
Faculty Secretary Office / Document Office
Processing
document_officer
faculty_secretary
Approval
faculty_secretary
Visibility

✔ requester
✔ document_officer
✔ faculty_secretary
✔ admin

❌ diğer staff
❌ faculty (ilgili değilse)

4) 🏢 RESERVATION (Room / Resource)
Owner Unit
Resource Management Unit
Processing
resource_manager
Approval
resource_manager
Opsiyonel Approval
department_chair (özel durumlar)
Visibility

✔ requester
✔ resource_manager
✔ admin

❌ diğer staff
❌ faculty

5) 📅 APPOINTMENT
Owner Unit
Faculty / Advisor
Processing
advisor
faculty_secretary
Approval
advisor
Visibility

✔ student (kendi)
✔ advisor
✔ faculty_secretary
✔ admin

❌ diğer staff
❌ diğer faculty

6) 🔐 ACCESS REQUEST
Owner Unit
IT + Security
Processing
security_officer
it_agent
Approval
system_owner (çok kritik)
security_officer
Visibility

✔ requester
✔ security_officer
✔ it_agent
✔ system_owner
✔ admin

❌ diğer staff
❌ faculty

7) 🧰 EQUIPMENT REQUEST
Owner Unit
Lab / Resource Unit
Processing
resource_manager
lab_technician
Approval
resource_manager
Visibility

✔ requester
✔ resource_manager
✔ lab_technician
✔ admin

❌ diğer staff
❌ faculty

8) 🎉 EVENT REQUEST
Owner Unit
Event / Facility Unit
Processing
event_coordinator
Approval
department_chair
security_officer
resource_manager
Visibility

✔ requester
✔ event_coordinator
✔ ilgili onay roller
✔ admin

❌ tüm staff
❌ ilgisiz faculty

9) 💰 PROCUREMENT REQUEST
Owner Unit
Procurement Unit
Processing
procurement_officer
Approval (çok aşamalı)
advisor (opsiyonel)
department_chair
budget_approver
finance_officer
procurement_officer (final)
Visibility

✔ requester
✔ procurement_officer
✔ approval chain
✔ admin

❌ diğer staff
❌ faculty (ilgili değilse)