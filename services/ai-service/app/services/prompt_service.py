from functools import lru_cache
from pathlib import Path
from typing import Any


PROMPTS_ROOT = Path(__file__).resolve().parent.parent / "prompts"


class PromptService:
    @staticmethod
    @lru_cache
    def load(relative_path: str) -> str:
        return (PROMPTS_ROOT / relative_path).read_text(encoding="utf-8").strip()

    @staticmethod
    def render(relative_path: str, **values: Any) -> str:
        template = PromptService.load(relative_path)
        rendered = template
        for key, value in values.items():
            rendered = rendered.replace(f"{{{key}}}", str(value))
        return rendered
