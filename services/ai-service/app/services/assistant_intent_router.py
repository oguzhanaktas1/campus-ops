import re
from dataclasses import dataclass


@dataclass(frozen=True)
class IntentResult:
    name: str
    entities: dict[str, str]


class AssistantIntentRouter:
    def route(self, message: str) -> IntentResult:
        normalized = self._normalize(message)

        # ── Capabilities / what can you do ─────────────────────────────────────
        if self._includes_any(normalized, [
            "what can you do", "help me", "what do you know", "capabilities",
            "what are you", "how can you help", "what can i ask",
            "ne yapabilirsin", "ne yapabilir", "nasil yardim",
            "neler yapabilirsin", "ne sorabilir",
        ]):
            return IntentResult("capabilities", {})

        # ── Greeting / small talk ──────────────────────────────────────────────
        if self._is_greeting(normalized):
            return IntentResult("greeting", {})
        if self._includes_any(normalized, [
            "nasilsin", "naber", "how are you",
        ]):
            return IntentResult("greeting", {})

        # ── Portal guide — what can I do here ─────────────────────────────────
        if self._includes_any(normalized, [
            "portal rehberi", "bu portalde ne yapabilirim", "portal guide",
            "what can i do here", "portal features", "bu sayfada ne var",
            "portaldeki ozellikler", "portal nedir",
        ]):
            return IntentResult("portal_guide", {})

        # ── Onboarding / new user guide ────────────────────────────────────────
        if self._includes_any(normalized, [
            "yeni kullanici", "nasil baslarim", "new user guide",
            "getting started", "baslangic rehberi", "sistemi nasil kullanabilirim",
            "onboarding",
        ]):
            return IntentResult("new_user_guide", {})

        # ── Switch portal ──────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "portal degistir", "baska portale gec", "switch portal",
            "diger portal", "other portal", "admin portalina gec",
            "student portalina gec",
        ]):
            return IntentResult("switch_portal", {})

        # ── Settings / notification preferences ───────────────────────────────
        if self._includes_any(normalized, [
            "ayarlar", "bildirim ayarlari", "settings", "notification settings",
            "profil ayarlari", "hesap ayarlari", "account settings",
        ]):
            return IntentResult("settings_help", {})

        # ── Request status meanings explained ──────────────────────────────────
        if self._includes_any(normalized, [
            "status ne demek", "status anlamlari", "durum ne demek",
            "request status explained", "what does status mean",
            "pending ne demek", "approved ne demek", "rejected ne demek",
            "in review ne demek", "submitted ne demek",
        ]):
            return IntentResult("request_status_explained", {})

        # ── Request type explained ─────────────────────────────────────────────
        if self._includes_any(normalized, [
            "talep tipi nedir", "request type nedir", "request type explained",
            "what is a reservation request", "what is an internship request",
            "ne tur talepler var", "talep cesitleri nedir",
        ]):
            return IntentResult("request_type_explained", {})

        # ── Navigation / how-to ────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "nereden", "nerede", "nasil gidebilir", "hangi sayfa", "sayfasi nerede",
            "nasil yapabilirim", "nasil acabilirim", "nasil olusturabilirim",
            "nereye gideyim", "nasil bulabilirim",
            "where can i", "how do i", "how to", "which page", "where is",
        ]):
            return IntentResult("help_navigation", {})

        # ── Create / open a new request ────────────────────────────────────────
        if self._includes_any(normalized, [
            "yeni talep", "talep ac", "talep olustur", "basvuru yap",
            "new request", "create request", "submit request", "basvurma sureci",
            "yeni basvuru nasil",
        ]):
            return IntentResult("create_request_guide", {})

        # ── Contact IT / open a support ticket ────────────────────────────────
        if self._includes_any(normalized, [
            "it destek", "teknik destek ac", "destek talebi ac", "it ile iletis",
            "contact it", "open support ticket", "it help", "it destek talebi",
            "bolunum it", "bilisim destek",
        ]):
            return IntentResult("contact_it", {})

        # ── What request types are available ──────────────────────────────────
        if self._includes_any(normalized, [
            "hangi talep acilabilir", "ne tur talep", "talep cesitleri",
            "request types", "what types of request", "available request",
            "hangi basvurular", "ne tur basvuru",
        ]):
            return IntentResult("allowed_request_types", {})

        # ── My profile / role ─────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "profilim", "kim benim", "rolum ne", "hangi role sahibim",
            "my profile", "who am i", "my role", "what is my role",
            "departmanim", "birimim", "fakultem",
        ]):
            return IntentResult("my_profile", {})

        # ── Completed / finished requests ──────────────────────────────────────
        if self._includes_any(normalized, [
            "tamamlanan talepler", "biten talepler", "kapanan talepler",
            "completed requests", "finished requests", "closed requests",
            "onaylanan taleplerim", "approved requests",
        ]):
            return IntentResult("completed_requests", {})

        # ── Draft requests ─────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "taslak talepler", "draft talepler", "tamamlanmamis basvurular",
            "draft requests", "my drafts", "yarida kalan talepler",
        ]):
            return IntentResult("draft_requests", {})

        # ── Bulk / breakdown by status ─────────────────────────────────────────
        if self._includes_any(normalized, [
            "talep dagilimi", "status dagilimi", "tum taleplerim ozet",
            "bulk request summary", "request breakdown", "how many in each status",
            "kacar talebim var duruma gore",
        ]):
            return IntentResult("bulk_request_summary", {})

        # ── Request count by type ──────────────────────────────────────────────
        if self._includes_any(normalized, [
            "tipe gore talepler", "talep tipine gore", "request count by type",
            "kac staj kac belge", "tur bazinda talepler",
        ]):
            return IntentResult("request_count_by_type", {})

        # ── Upcoming deadlines ─────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "son teslim", "yaklasan son teslim", "due date", "son tarih",
            "deadline", "upcoming deadline", "ne zaman bitmeli",
            "sure dolmak uzere",
        ]):
            return IntentResult("upcoming_deadlines", {})

        # ── Internship requests ────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "stajim", "staj basvurum", "staj durumu", "stajim ne asamada",
            "internship status", "my internship", "internship request",
            "staj onaylandi mi", "stajim nerede",
        ]):
            return IntentResult("internship_status", {})

        # ── Faculty: internship review queue ───────────────────────────────────
        if self._includes_any(normalized, [
            "danismanlardaki stajlar", "ogrenci stajlari", "staj incelemeleri",
            "faculty internship queue", "student internships", "danismanlik staj",
            "bende bekleyen stajlar", "staj onay kuyruğu",
        ]):
            return IntentResult("faculty_internship_queue", {})

        # ── Document requests ──────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "belge talebim", "belgem hazir mi", "belge durumu", "transkript",
            "ogrenci belgesi", "document status", "my document", "document request",
            "belge ne zaman hazir",
        ]):
            return IntentResult("document_status", {})

        # ── Access requests ────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "erisim talebim", "izin talebim", "erisim durumu",
            "access request status", "my access request", "permission request",
            "erisimim onaylandi mi", "sisteme erisim",
        ]):
            return IntentResult("access_request_status", {})

        # ── Equipment requests ─────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "ekipman talebim", "ekipman durumu", "equipment request",
            "equipment status", "ekipman istegi",
        ]):
            return IntentResult("equipment_status", {})

        # ── Today / schedule summary ───────────────────────────────────────────
        if self._includes_any(normalized, [
            "bugun ne var", "bugun programim", "bugunun ozeti", "takvimim",
            "my schedule", "today summary", "my day", "gunluk ozet", "gunluk durum",
        ]):
            return IntentResult("my_today_summary", {})

        # ── Pending approvals ──────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "bekleyen onay", "onay bekleyen", "onaylamam gereken", "onayimda bekleyen",
            "pending approval", "onayi beklenen", "onay kuyrugu",
            "hangi talepler bende", "bende bekleyen", "imzam bekleniyor",
            "waiting for my approval", "needs my approval",
        ]):
            return IntentResult("pending_approvals", {})

        # ── Approval history ───────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "gecmis onaylarim", "onceki onaylar", "onay gecmisi",
            "approval history", "past approvals", "approved requests",
            "reddettiklerim", "onayladiklarim", "kac talep onayladim",
        ]):
            return IntentResult("approval_history", {})

        # ── My workload overview ───────────────────────────────────────────────
        if self._includes_any(normalized, [
            "is yukum", "kac isim var", "workload", "my workload",
            "kac tanem var", "toplam is yuku", "iş yukum nedir",
        ]):
            return IntentResult("my_workload", {})

        # ── Overdue / delayed items ────────────────────────────────────────────
        if self._includes_any(normalized, [
            "geciken", "gecikmiş talep", "gecikmiş request", "suresi dolmus",
            "overdue", "delayed", "past due", "geciken isler",
        ]):
            return IntentResult("overdue_items", {})

        # ── Assignment queue ───────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "bana atanan", "benim kuyrugum", "assignment queue",
            "assigned to me", "my queue", "bende ne var",
            "bana gelen talepler", "atanmis isler",
        ]):
            return IntentResult("assignment_queue", {})

        # ── Open request count ─────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "kac acik request", "kac acik talep", "acik requestim", "acik talebim",
            "kac talebim var", "toplam talebim", "taleplerimin sayisi",
            "kac islemim var", "acik islemlerim",
            "bugun kac talep", "bugun kac request", "bugun kac basvuru",
            "bugun acik", "today's open", "today open",
            "how many open", "open requests count", "how many requests",
            "kac yeni basvuru", "kac yeni talep",
        ]):
            return IntentResult("my_open_requests_count", {})

        # ── My IT tickets ──────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "ticketlarim", "it ticketlarim", "destek taleplerim",
            "it support", "acik ticketlarim", "bekleyen ticketlarim",
            "ticket kuyrugu", "bana atanan ticket", "bende ticket",
            "my tickets", "it ticket", "support ticket",
        ]):
            return IntentResult("my_tickets", {})

        # ── IT ticket queue (broader) ──────────────────────────────────────────
        if self._includes_any(normalized, [
            "ticket queue", "acik ticket", "bekleyen ticket",
            "kac ticket var", "toplam ticket", "open tickets",
        ]):
            return IntentResult("ticket_queue_summary", {})

        # ── IT resolution statistics ───────────────────────────────────────────
        if self._includes_any(normalized, [
            "it cozum suresi", "ticket cozum istatistigi", "it metrikleri",
            "it resolution", "ticket resolution stats", "average resolution",
            "kac ticket cozuldu", "it performans",
        ]):
            return IntentResult("it_resolution_stats", {})

        # ── SLA policies (admin) — must precede sla_status ────────────────────
        if self._includes_any(normalized, [
            "sla politikasi", "sla konfigurasyonu", "sla policy",
            "sla settings", "sla kurallari", "sla tanimlari",
        ]):
            return IntentResult("sla_policy_info", {})

        # ── SLA status ────────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "sla", "sla durumu", "sla ihlali", "sla breach",
            "hizmet seviyesi", "service level",
        ]):
            return IntentResult("sla_status", {})

        # ── My reservations ────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "rezervasyonlarim", "oda rezervasyon", "rezervasyonum ne zaman",
            "aktif rezervasyon", "upcoming reservation", "rezervasyonum var mi",
            "my reservations", "room booking",
        ]):
            return IntentResult("my_reservations", {})

        # ── Resource availability ──────────────────────────────────────────────
        if self._includes_any(normalized, [
            "oda musait mi", "kaynak musait", "bos oda", "available room",
            "resource availability", "hangi odalar musait", "musait kaynak",
        ]):
            return IntentResult("resource_info", {})

        # ── Notifications ──────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "bildirimlerim", "okunmamis bildirim", "kac bildirim",
            "unread notification", "bildirim sayim", "bildirimim var mi",
            "my notifications", "unread",
        ]):
            return IntentResult("my_notifications", {})

        # ── Appointments ───────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "randevularim", "yaklasan randevularim", "randevum ne zaman",
            "randevum var mi", "today appointment", "my appointments",
            "upcoming appointment", "bugun randevum",
        ]):
            return IntentResult("my_today_appointments", {})

        # ── Events ────────────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "etkinliklerim", "yaklasan etkinlik", "bugun event", "today event",
            "event listesi", "upcoming event", "kac etkinligim",
            "my events", "campus events",
        ]):
            return IntentResult("my_today_events", {})

        # ── Event plan status (organizer) ──────────────────────────────────────
        if self._includes_any(normalized, [
            "event plan", "etkinlik plani", "plan durumu", "event planlarim",
            "event plan status", "my event plans",
        ]):
            return IntentResult("event_plan_status", {})

        # ── Organizer club info ────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "kulubum", "kulup bilgisi", "my club", "club info",
            "kulup durumu", "club status",
        ]):
            return IntentResult("my_club_info", {})

        # ── Procurement / purchasing ───────────────────────────────────────────
        if self._includes_any(normalized, [
            "satin alma", "procurement", "tedarik", "satinalma",
            "satin alma taleplerim", "procurement durumum",
            "purchasing", "purchase request",
        ]):
            return IntentResult("procurement_status", {})

        # ── Recent activity ────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "son aktivitelerim", "son hareketlerim", "recent activity",
            "son yaptiklarim", "gecen hafta ne oldu", "recent changes",
        ]):
            return IntentResult("recent_activity", {})

        # ── Request status / workflow explanation ──────────────────────────────
        if self._includes_any(normalized, [
            "request durumu", "neden bekliyor", "kimde bekliyor",
            "talebim ne asamada", "basvurum nerede", "hangi asamada",
            "request status", "why is it pending", "who has it",
        ]):
            return IntentResult("request_status_explanation", {})

        # ── Analytics / platform reports ───────────────────────────────────────
        if self._includes_any(normalized, [
            "analytics", "analitik", "peak saat", "departman bazli",
            "en yogun request tipi", "istatistik", "metrik",
            "performans", "ozet rapor", "statistics",
        ]):
            return IntentResult("analytics_summary", {})

        # ── Admin: recent users ────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "son kullanicilar", "yeni kayitli", "kullanici listesi",
            "recent user", "son eklenen kullanici", "kac kullanici var",
            "aktif kullanici", "toplam kullanici", "user count",
            "how many users", "user list",
        ]):
            return IntentResult("recent_users", {})

        # ── Admin: workflow definitions ────────────────────────────────────────
        if self._includes_any(normalized, [
            "workflow tanimi", "aktif workflow", "is akislari",
            "workflow definitions", "active workflow", "workflow list",
            "onay akislari", "workflow",
        ]):
            return IntentResult("workflow_info", {})

        # ── Admin: integrations ────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "entegrasyonlar", "integration listesi", "kac entegrasyon",
            "integrations", "integration list", "third party",
        ]):
            return IntentResult("integration_list", {})

        # ── Admin: reports ─────────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "raporlar", "rapor listesi", "reports", "report list",
            "sistem raporu", "platform raporu", "rapor goster",
        ]):
            return IntentResult("report_list", {})

        # ── Admin: audit logs ──────────────────────────────────────────────────
        if self._includes_any(normalized, [
            "audit log", "denetim kaydi", "kim ne yapti", "degisiklik gecmisi",
            "sistem olaylari", "kim degistirdi", "son islemler",
            "audit trail", "who changed", "activity log",
        ]):
            return IntentResult("audit_logs", {})

        # ── Admin: webhook / integration status ────────────────────────────────
        if self._includes_any(normalized, [
            "webhook", "entegrasyon log", "integration durumu",
            "webhook durumu", "webhook hatasi", "webhook logs",
        ]):
            return IntentResult("webhook_status", {})

        # ── Admin: system overview ─────────────────────────────────────────────
        if self._includes_any(normalized, [
            "sistem ozeti", "genel durum", "platforma genel bakis",
            "sistem ne durumda", "genel istatistik", "dashboard ozet",
            "sistemin durumu", "platformun durumu",
            "system overview", "platform status", "system summary",
        ]):
            return IntentResult("system_overview", {})

        # ── Request number lookup (entity-based, must be last specific check) ──
        request_no = self._extract_request_no(message)
        if request_no:
            return IntentResult("request_summary", {"requestNo": request_no})

        return IntentResult("unknown", {})

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _extract_request_no(self, message: str) -> str | None:
        match = re.search(r"\b([A-Z]{2,}-\d{2,}|\d{5,})\b", message)
        return match.group(1) if match else None

    def _is_greeting(self, text: str) -> bool:
        return text in {
            "merhaba", "selam", "selamlar",
            "hello", "hi", "hey",
            "gunaydin", "iyi gunler", "iyi aksamlar",
            "tesekkurler", "tesekkur ederim",
            "tamam", "anladim", "eyvallah",
            "thanks", "thank you", "ok", "okay", "got it",
        }

    def _includes_any(self, text: str, values: list[str]) -> bool:
        return any(value in text for value in values)

    def _normalize(self, text: str) -> str:
        replacements = str.maketrans({
            "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
            "Ç": "c", "Ğ": "g", "İ": "i", "I": "i", "Ö": "o", "Ş": "s", "Ü": "u",
        })
        return text.strip().lower().translate(replacements)
