from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import get_settings


PROMPTS_ROOT = Path(__file__).resolve().parent.parent / "prompts"


class PromptService:
    @staticmethod
    def load(relative_path: str) -> str:
        settings = get_settings()
        if settings.app_env == "development":
            return (PROMPTS_ROOT / relative_path).read_text(encoding="utf-8").strip()
        return _load_cached(relative_path)

    @staticmethod
    def render(relative_path: str, **values: Any) -> str:
        template = PromptService.load(relative_path)
        rendered = template
        for key, value in values.items():
            rendered = rendered.replace(f"{{{key}}}", str(value))
        return rendered


@lru_cache
def _load_cached(relative_path: str) -> str:
    return (PROMPTS_ROOT / relative_path).read_text(encoding="utf-8").strip()
