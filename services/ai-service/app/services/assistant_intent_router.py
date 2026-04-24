import re
from dataclasses import dataclass


@dataclass(frozen=True)
class IntentResult:
    name: str
    entities: dict[str, str]


class AssistantIntentRouter:
    def route(self, message: str) -> IntentResult:
        normalized = self._normalize(message)

        if self._is_greeting(normalized):
            return IntentResult("greeting", {})
        if self._includes_any(normalized, ["nasil", "nasilsin", "naber", "how are you"]):
            return IntentResult("greeting", {})
        if self._includes_any(normalized, ["staj", "basvuru nasil", "nereden gorebilirim", "hangi sayfa", "sayfasi nerede"]):
            return IntentResult("help_navigation", {})
        if self._includes_any(normalized, ["kac acik request", "kac acik talep", "acik requestim", "acik talebim"]):
            return IntentResult("my_open_requests_count", {})
        if self._includes_any(normalized, ["bugun kac randevum", "bugun randevum", "today appointment"]):
            return IntentResult("my_today_appointments", {})
        if self._includes_any(normalized, ["bugun event", "today event"]):
            return IntentResult("my_today_events", {})
        if self._includes_any(normalized, ["bugun ne var", "bugun programim", "my day", "today summary"]):
            return IntentResult("my_today_summary", {})
        if self._includes_any(normalized, ["request durumu", "status ne", "neden bekliyor", "kimde bekliyor"]):
            return IntentResult("request_status_explanation", {})
        if self._includes_any(normalized, ["ticket queue", "acik ticket", "bekleyen ticket", "ticket bekliyor"]):
            return IntentResult("ticket_queue_summary", {})
        if self._includes_any(normalized, ["analytics", "analitik", "peak saat", "departman bazli", "en yogun request tipi"]):
            return IntentResult("analytics_summary", {})

        request_no = self._extract_request_no(message)
        if request_no:
            return IntentResult("request_summary", {"requestNo": request_no})

        return IntentResult("unknown", {})

    def _extract_request_no(self, message: str) -> str | None:
        match = re.search(r"\b([A-Z]{2,}-\d{2,}|\d{5,})\b", message)
        return match.group(1) if match else None

    def _is_greeting(self, text: str) -> bool:
        return text in {
            "merhaba",
            "selam",
            "selamlar",
            "hello",
            "hi",
            "hey",
            "gunaydin",
            "iyi gunler",
            "iyi aksamlar",
            "tesekkurler",
            "tesekkur ederim",
        }

    def _includes_any(self, text: str, values: list[str]) -> bool:
        return any(value in text for value in values)

    def _normalize(self, text: str) -> str:
        replacements = str.maketrans(
            {
                "ç": "c",
                "ğ": "g",
                "ı": "i",
                "ö": "o",
                "ş": "s",
                "ü": "u",
                "Ç": "c",
                "Ğ": "g",
                "İ": "i",
                "I": "i",
                "Ö": "o",
                "Ş": "s",
                "Ü": "u",
            }
        )
        return text.strip().lower().translate(replacements)
