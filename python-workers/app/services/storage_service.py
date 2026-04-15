"""
Supabase Storage servisi — dosya yükleme / indirme / signed URL.
httpx ile async HTTP kullanılıyor.
"""
from __future__ import annotations
import structlog
import httpx
from app.config.settings import settings

logger = structlog.get_logger(__name__)

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=settings.supabase_url,
            headers={
                "apikey":        settings.supabase_key,
                "Authorization": f"Bearer {settings.supabase_key}",
            },
            timeout=30,
        )
    return _client


async def upload_file(
    object_path: str,
    content: bytes,
    mime_type: str = "application/octet-stream",
    bucket: str | None = None,
) -> str | None:
    """
    Dosyayı Supabase storage'a yükle.
    Başarılı olursa storage path'i döner.
    """
    if not settings.supabase_url or not settings.supabase_key:
        logger.warning("supabase_not_configured")
        return None

    bucket = bucket or settings.storage_bucket
    client = _get_client()
    url = f"/storage/v1/object/{bucket}/{object_path}"

    try:
        resp = await client.post(
            url,
            content=content,
            headers={"Content-Type": mime_type},
        )
        if resp.status_code in (200, 201):
            logger.info("storage_upload_success", path=object_path, size=len(content))
            return object_path
        else:
            # Zaten varsa UPSERT yap
            resp2 = await client.put(
                url,
                content=content,
                headers={"Content-Type": mime_type},
            )
            if resp2.status_code in (200, 201):
                return object_path
            logger.error("storage_upload_failed", status=resp2.status_code, path=object_path)
            return None
    except Exception as e:
        logger.error("storage_upload_exception", error=str(e), path=object_path)
        return None


async def get_public_url(object_path: str, bucket: str | None = None) -> str:
    """Public URL oluştur."""
    bucket = bucket or settings.storage_bucket
    return f"{settings.supabase_url}/storage/v1/object/public/{bucket}/{object_path}"


async def download_file(object_path: str, bucket: str | None = None) -> bytes | None:
    """Dosyayı Supabase'den indir."""
    if not settings.supabase_url or not settings.supabase_key:
        return None

    bucket = bucket or settings.storage_bucket
    client = _get_client()
    try:
        resp = await client.get(f"/storage/v1/object/{bucket}/{object_path}")
        if resp.status_code == 200:
            return resp.content
        logger.warning("storage_download_failed", status=resp.status_code, path=object_path)
        return None
    except Exception as e:
        logger.error("storage_download_exception", error=str(e))
        return None
