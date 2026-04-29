from time import perf_counter

import httpx
from fastapi import APIRouter

from app.core.config import get_settings


router = APIRouter(tags=["health"])


@router.get("/live")
async def live() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "campusops-ai-service",
    }


@router.get("/health")
async def health() -> dict[str, object]:
    settings = get_settings()
    runtime = await _check_runtime()
    runtime_ok = runtime["status"] == "ok"
    service_status = "ok"

    if settings.ai_enabled and not runtime_ok:
        service_status = "degraded"

    return {
        "status": service_status,
        "service": "campusops-ai-service",
        "model": settings.default_model,
        "provider": settings.runtime_provider,
        "enabled": settings.ai_enabled,
        "runtime": runtime,
    }


async def _check_runtime() -> dict[str, object]:
    settings = get_settings()
    started_at = perf_counter()
    runtime_urls = _runtime_base_urls()

    if not settings.ai_enabled:
        return {
            "status": "disabled",
            "baseUrl": runtime_urls[0] if runtime_urls else "",
            "checkedUrls": runtime_urls,
            "model": settings.default_model,
            "modelAvailable": False,
            "latencyMs": 0,
        }

    checked: list[dict[str, object]] = []

    for runtime_url in runtime_urls:
        result = await _check_runtime_url(runtime_url, started_at)
        checked.append(result)
        if result["status"] == "ok":
            return {
                **result,
                "checkedUrls": runtime_urls,
                "checkedEndpoints": checked,
            }

    last = checked[-1] if checked else {}
    return {
        "status": "unreachable",
        "baseUrl": runtime_urls[0] if runtime_urls else "",
        "model": settings.default_model,
        "modelAvailable": False,
        "fallbackModel": settings.fallback_model,
        "fallbackModelAvailable": False,
        "availableModels": [],
        "latencyMs": round((perf_counter() - started_at) * 1000),
        "error": last.get("error", "No AI runtime URL configured."),
        "checkedUrls": runtime_urls,
        "checkedEndpoints": checked,
    }


async def _check_runtime_url(runtime_url: str, started_at: float) -> dict[str, object]:
    settings = get_settings()

    try:
        async with httpx.AsyncClient(timeout=min(settings.request_timeout_seconds, 10.0)) as client:
            response = await client.get(f"{runtime_url}/api/tags")
            response.raise_for_status()
            payload = response.json()

        models = payload.get("models", [])
        model_names = [
            model.get("name")
            for model in models
            if isinstance(model, dict) and isinstance(model.get("name"), str)
        ]

        return {
            "status": "ok",
            "baseUrl": runtime_url,
            "model": settings.default_model,
            "modelAvailable": settings.default_model in model_names,
            "fallbackModel": settings.fallback_model,
            "fallbackModelAvailable": settings.fallback_model in model_names,
            "availableModels": model_names[:20],
            "latencyMs": round((perf_counter() - started_at) * 1000),
        }
    except (httpx.HTTPError, ValueError) as exc:
        error_message = str(exc) or exc.__class__.__name__
        return {
            "status": "unreachable",
            "baseUrl": runtime_url,
            "model": settings.default_model,
            "modelAvailable": False,
            "availableModels": [],
            "latencyMs": round((perf_counter() - started_at) * 1000),
            "error": error_message,
        }


def _runtime_base_urls() -> list[str]:
    settings = get_settings()
    urls = [settings.runtime_base_url, *settings.runtime_fallback_urls.split(",")]
    cleaned: list[str] = []
    for url in urls:
        normalized = url.strip().rstrip("/")
        if normalized and normalized not in cleaned:
            cleaned.append(normalized)
    return cleaned
