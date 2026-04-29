import json

import httpx

from app.core.config import get_settings
from app.models.analytics import AnalyticsSummaryRequest, AnalyticsSummaryResponse
from app.services.ollama_client import OllamaClient
from app.services.prompt_service import PromptService
from app.utils.validation import clamp_confidence


class AnalyticsService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = OllamaClient()

    async def summarize(
        self, payload: AnalyticsSummaryRequest
    ) -> AnalyticsSummaryResponse:
        fallback = self._build_fallback(payload)
        if not self.settings.ai_enabled:
            return fallback

        prompt = PromptService.render(
            "analytics/summary.md",
            payload=json.dumps(payload.model_dump(), ensure_ascii=False, indent=2),
        )

        try:
            result = await self.client.generate_json(prompt)
            return AnalyticsSummaryResponse.model_validate(
                {
                    "summary": result.get("summary", fallback.summary),
                    "highlights": result.get("highlights", []),
                    "confidence": clamp_confidence(result.get("confidence"), 0.86),
                    "fallbackUsed": False,
                }
            )
        except (httpx.HTTPError, ValueError, KeyError):
            return fallback

    def _build_fallback(
        self, payload: AnalyticsSummaryRequest
    ) -> AnalyticsSummaryResponse:
        if payload.domain == "ADMIN":
            summary, highlights = self._build_admin_fallback(payload)
        elif payload.domain == "IT":
            summary, highlights = self._build_it_fallback(payload)
        elif payload.domain == "DASHBOARD":
            summary, highlights = self._build_dashboard_fallback(payload)
        else:
            summary = f"{payload.domain} analytics summary is temporarily unavailable."
            highlights = []

        return AnalyticsSummaryResponse(
            summary=summary,
            highlights=highlights,
            confidence=self.settings.fallback_confidence,
            fallbackUsed=True,
        )

    def _build_admin_fallback(
        self, payload: AnalyticsSummaryRequest
    ) -> tuple[str, list[str]]:
        kpis = payload.kpis
        chart_data = payload.chart_data
        trend_deltas = payload.trend_deltas

        total_requests = self._as_int(kpis.get("totalRequests"))
        open_requests = self._as_int(kpis.get("openRequests"))
        overdue_requests = self._as_int(kpis.get("overdueRequests"))
        total_users = self._as_int(kpis.get("totalUsers"))
        active_users = self._as_int(kpis.get("activeUsers"))
        approval_rate = self._as_int(kpis.get("approvalRate"))
        today_requests = self._as_int(kpis.get("todayRequests"))
        open_tickets = self._as_int(kpis.get("openTickets"))
        today_reservations = self._as_int(kpis.get("todayReservations"))
        today_appointments = self._as_int(kpis.get("todayAppointments"))
        top_request_type = self._as_text(kpis.get("topRequestType"))
        top_department = self._as_text(kpis.get("topDepartment"))
        daily_delta = self._as_int(trend_deltas.get("dailyRequestDelta"))

        summary_parts = [
            f"Toplam {total_requests} talep içinde {open_requests} açık kayıt ve {overdue_requests} gecikmiş iş bulunuyor.",
            f"Kullanıcı tabanında {active_users}/{total_users} aktif kullanıcı görünüyor ve onay oranı %{approval_rate} seviyesinde.",
        ]

        daily_part = (
            f"Bugün {today_requests} yeni talep, {today_reservations} rezervasyon ve {today_appointments} randevu kaydı var; açık IT ticket sayısı {open_tickets}."
        )
        summary_parts.append(daily_part)

        if top_request_type:
            summary_parts.append(f"En yoğun talep tipi şu anda {top_request_type}.")
        if top_department:
            summary_parts.append(f"En yüksek talep yükü {top_department} üzerinde görünüyor.")
        if daily_delta > 0:
            summary_parts.append(
                f"Günlük talep akışı düne göre {daily_delta} adet artmış durumda."
            )
        elif daily_delta < 0:
            summary_parts.append(
                f"Günlük talep akışı düne göre {abs(daily_delta)} adet düşmüş durumda."
            )

        highlights = [
            f"Açık talepler: {open_requests}",
            f"Gecikmiş işler: {overdue_requests}",
            f"Bugünkü yeni talepler: {today_requests}",
            f"Açık IT ticket: {open_tickets}",
        ]

        if top_request_type:
            highlights.append(f"En yoğun talep tipi: {top_request_type}")
        if top_department:
            highlights.append(f"En yoğun departman: {top_department}")

        return " ".join(summary_parts[:5]), highlights[:4]

    def _build_it_fallback(
        self, payload: AnalyticsSummaryRequest
    ) -> tuple[str, list[str]]:
        kpis = payload.kpis
        chart_data = payload.chart_data
        grouped_counts = payload.grouped_counts
        trend_deltas = payload.trend_deltas

        total_tickets = self._as_int(kpis.get("totalTickets"))
        avg_resolution_hours = self._as_float(kpis.get("avgResolutionHours"))
        sla_breach_rate = self._as_float(kpis.get("slaBreachRate"))
        active_vs_resolved = self._as_int(trend_deltas.get("activeVsResolved"))
        trend_by_date = chart_data.get("trendByDate", {})
        latest_daily_volume = 0
        previous_daily_volume = 0

        if isinstance(trend_by_date, dict) and trend_by_date:
            ordered_days = sorted(
                (
                    (str(key), self._as_int(value))
                    for key, value in trend_by_date.items()
                ),
                key=lambda item: item[0],
            )
            latest_daily_volume = ordered_days[-1][1]
            if len(ordered_days) > 1:
                previous_daily_volume = ordered_days[-2][1]

        top_category = None
        if grouped_counts:
            top_category = max(grouped_counts.items(), key=lambda item: item[1])[0]

        summary_parts = [
            f"IT görünümünde son dönemde {total_tickets} ticket izleniyor.",
            f"Ortalama çözüm süresi {avg_resolution_hours:.1f} saat ve SLA ihlal oranı %{sla_breach_rate:.1f}.",
        ]

        if active_vs_resolved > 0:
            summary_parts.append(
                f"Aktif iş yükü çözülen ticket sayısından {active_vs_resolved} adet fazla görünüyor."
            )
        elif active_vs_resolved < 0:
            summary_parts.append(
                f"Çözülen ticketlar aktif iş yükünden {abs(active_vs_resolved)} adet daha fazla."
            )

        if top_category:
            summary_parts.append(f"En yoğun kategori {top_category}.")
        if latest_daily_volume > 0:
            summary_parts.append(
                f"Güncel günlük hacimde {latest_daily_volume} ticket hareketi izleniyor."
            )
        if previous_daily_volume > 0 and latest_daily_volume != previous_daily_volume:
            diff = latest_daily_volume - previous_daily_volume
            if diff > 0:
                summary_parts.append(
                    f"Günlük hacim bir önceki güne göre {diff} adet artmış."
                )
            else:
                summary_parts.append(
                    f"Günlük hacim bir önceki güne göre {abs(diff)} adet düşmüş."
                )

        highlights = [
            f"Toplam ticket: {total_tickets}",
            f"Ort. çözüm süresi: {avg_resolution_hours:.1f} saat",
            f"SLA ihlal oranı: %{sla_breach_rate:.1f}",
        ]
        if top_category:
            highlights.append(f"Yoğun kategori: {top_category}")
        elif latest_daily_volume > 0:
            highlights.append(f"Günlük ticket hacmi: {latest_daily_volume}")

        return " ".join(summary_parts[:4]), highlights[:4]

    def _build_dashboard_fallback(
        self, payload: AnalyticsSummaryRequest
    ) -> tuple[str, list[str]]:
        kpis = payload.kpis
        my_requests = self._as_int(kpis.get("myRequests"))
        open_requests = self._as_int(kpis.get("openRequests"))
        pending_approvals = self._as_int(kpis.get("pendingApprovals"))
        upcoming_appointments = self._as_int(kpis.get("upcomingAppointments"))
        upcoming_reservations = self._as_int(kpis.get("upcomingReservations"))

        parts = [f"Toplam {my_requests} talebiniz bulunuyor."]
        if open_requests:
            parts.append(f"{open_requests} talebiniz hâlâ açık durumda.")
        if pending_approvals:
            parts.append(f"{pending_approvals} talep sizin onayınızı bekliyor.")
        if upcoming_appointments:
            parts.append(f"{upcoming_appointments} yaklaşan randevunuz var.")
        if upcoming_reservations:
            parts.append(f"{upcoming_reservations} yaklaşan rezervasyonunuz var.")

        highlights = [f"Toplam talepler: {my_requests}"]
        if open_requests:
            highlights.append(f"Açık talepler: {open_requests}")
        if pending_approvals:
            highlights.append(f"Onay bekleyenler: {pending_approvals}")
        if upcoming_appointments:
            highlights.append(f"Yaklaşan randevular: {upcoming_appointments}")

        return " ".join(parts), highlights[:4]

    def _as_int(self, value: object) -> int:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            try:
                return int(float(value))
            except ValueError:
                return 0
        return 0

    def _as_float(self, value: object) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                return 0.0
        return 0.0

    def _as_text(self, value: object) -> str | None:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return None
