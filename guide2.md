2. İşlevsel operasyon rolleri

Bunlar approval/assignment/workflow için:

advisor
department_chair
faculty_secretary
internship_coordinator
it_agent
it_manager
resource_manager
procurement_officer
security_officer
document_officer

Yani kullanıcı portalda “faculty” olabilir ama aynı zamanda sistem içinde advisor rolüne de sahip olabilir.
Ya da biri “staff”tir ama aynı zamanda procurement_officer rolü vardır.

Zaten UserRole tablosu bir kullanıcıya birden çok rol vermek için tasarlanmış.



Minimum kullanıcı/rol listesi
Ana roller
1. Student User

Roller:

student

Amaç:

internship, document, appointment, event, access, reservation request açsın
2. Faculty User

Roller:

faculty

Amaç:

normal akademik kullanıcı
appointment alabilsin/görebilsin
faculty bazlı request görsün
3. Staff User

Roller:

staff

Amaç:

genel operasyon personeli
dashboard ve basic staff portal testi
4. Admin User

Roller:

admin

Amaç:

tüm sistemi görsün
role/permission/workflow yönetimi
Domain kombinasyonlu kullanıcılar
5. Advisor User

Roller:

faculty
advisor

Amaç:

internship review
student appointment
advisor dashboard
6. Department Chair User

Roller:

faculty
department_chair

Amaç:

department-level approval
escalation approval
7. Faculty Secretary User

Roller:

staff
faculty_secretary

Amaç:

document request
appointment coordination
faculty admin işleri
8. Internship Coordinator User

Roller:

staff
internship_coordinator

Amaç:

staj başvurularını operasyonel yönetmek
9. IT Agent User

Roller:

staff
it_agent

Amaç:

ticket alma/çözme
10. IT Manager User

Roller:

staff
it_manager

Amaç:

IT approval, escalation, reassignment
11. Resource Manager User

Roller:

staff
resource_manager

Amaç:

room/resource approval
reservation yönetimi
12. Procurement Officer User

Roller:

staff
procurement_officer

Amaç:

procurement request süreci
13. Security Officer User

Roller:

staff
security_officer

Amaç:

security approval gereken süreçler
14. Document Officer User

Roller:

staff
document_officer

Amaç:

belge taleplerini işlemek
6) Toplam minimum örnek kullanıcı seti

En mantıklı minimum seed set:

student
faculty
staff
admin
faculty + advisor
faculty + department_chair
staff + faculty_secretary
staff + internship_coordinator
staff + it_agent
staff + it_manager
staff + resource_manager
staff + procurement_officer
staff + security_officer
staff + document_officer