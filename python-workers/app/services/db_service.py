"""
PostgreSQL bağlantısı — asyncpg üzerinden.
"""
import asyncpg
import structlog
from app.config.settings import settings

logger = structlog.get_logger(__name__)

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("db_pool_created")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def fetch_user_by_id(user_id: str) -> dict | None:
    """Kullanıcı bilgilerini çek (notification/email için)."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT u.id, u.email,
               p."fullName", p."firstName", p."lastName"
        FROM "User" u
        LEFT JOIN "UserProfile" p ON p."userId" = u.id
        WHERE u.id = $1
        """,
        user_id,
    )
    return dict(row) if row else None


async def fetch_request_by_id(request_id: str) -> dict | None:
    """Request bilgilerini çek."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT r.id, r."requestNo", r.title, r.status, r.priority,
               rt.key AS "requestTypeKey", rt.name AS "requestTypeName",
               r."requesterUserId"
        FROM "Request" r
        LEFT JOIN "RequestType" rt ON rt.id = r."requestTypeId"
        WHERE r.id = $1
        """,
        request_id,
    )
    return dict(row) if row else None


async def create_notification(
    user_id: str,
    title: str,
    message: str,
    request_id: str | None = None,
    action_url: str | None = None,
) -> str | None:
    """In-app notification kaydı oluştur."""
    pool = await get_pool()
    try:
        row = await pool.fetchrow(
            """
            INSERT INTO "Notification"
              (id, "userId", type, title, message, "requestId", "actionUrl", status, "createdAt", "updatedAt")
            VALUES
              (gen_random_uuid(), $1, 'IN_APP', $2, $3, $4, $5, 'SENT', NOW(), NOW())
            RETURNING id
            """,
            user_id, title, message, request_id, action_url,
        )
        return str(row["id"]) if row else None
    except Exception as e:
        logger.error("create_notification_failed", error=str(e))
        return None


async def fetch_request_full(request_id: str) -> dict | None:
    """Onay belgesi için detaylı request bilgisi."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT r.id, r."requestNo", r.title, r.status, r.priority,
               r."createdAt", r."completedAt", r."requesterUserId",
               rt.name AS "requestTypeName", rt.key AS "requestTypeKey",
               p."fullName", p."firstName", p."lastName", p."studentNumber",
               u.email,
               dep.name AS "departmentName"
        FROM "Request" r
        LEFT JOIN "RequestType" rt ON rt.id = r."requestTypeId"
        LEFT JOIN "User" u         ON u.id  = r."requesterUserId"
        LEFT JOIN "UserProfile" p  ON p."userId" = u.id
        LEFT JOIN "Department" dep ON dep.id = p."departmentId"
        WHERE r.id = $1
        """,
        request_id,
    )
    return dict(row) if row else None


async def save_generated_file(
    request_id: str,
    uploader_user_id: str,
    storage_path: str,
    original_name: str,
    mime_type: str,
    size_bytes: int,
    bucket: str = "campusops-files",
) -> str | None:
    """Üretilen dosyayı File + FileLink tablolarına kaydet."""
    pool = await get_pool()
    try:
        file_row = await pool.fetchrow(
            """
            INSERT INTO "File"
              (id, "storageProvider", "bucketName", "storagePath",
               "originalFileName", "mimeType", "fileSizeBytes",
               "fileCategory", "uploadedByUserId", "createdAt", "updatedAt")
            VALUES
              (gen_random_uuid(), 'SUPABASE', $1, $2, $3, $4, $5,
               'DOCUMENT', $6, NOW(), NOW())
            RETURNING id
            """,
            bucket, storage_path, original_name, mime_type, size_bytes, uploader_user_id,
        )
        if not file_row:
            return None
        file_id = str(file_row["id"])

        await pool.execute(
            """
            INSERT INTO "FileLink"
              (id, "fileId", "entityType", "entityId", "relationType",
               "requestId", "createdAt")
            VALUES
              (gen_random_uuid(), $1, 'Request', $2, 'GENERATED_DOCUMENT',
               $2, NOW())
            """,
            file_id, request_id,
        )
        return file_id
    except Exception as e:
        logger.error("save_generated_file_failed", error=str(e))
        return None


async def fetch_report_data(report_type: str, period_days: int = 30) -> list[dict]:
    """Rapor için aggregated veri çek."""
    pool = await get_pool()
    rows: list[asyncpg.Record] = []

    if report_type == "request_summary":
        rows = await pool.fetch(
            """
            SELECT rt.name AS "requestType",
                   r.status,
                   COUNT(*) AS "count"
            FROM "Request" r
            LEFT JOIN "RequestType" rt ON rt.id = r."requestTypeId"
            WHERE r."createdAt" >= NOW() - ($1 || ' days')::interval
            GROUP BY rt.name, r.status
            ORDER BY "count" DESC
            """,
            str(period_days),
        )
    elif report_type == "sla_breaches":
        rows = await pool.fetch(
            """
            SELECT se."eventType",
                   COUNT(*) AS "count",
                   rt.name AS "requestType"
            FROM "SlaEvent" se
            LEFT JOIN "Request" r  ON r.id  = se."requestId"
            LEFT JOIN "RequestType" rt ON rt.id = r."requestTypeId"
            WHERE se."occurredAt" >= NOW() - ($1 || ' days')::interval
              AND se."eventType" IN ('FIRST_RESPONSE_BREACHED','RESOLUTION_BREACHED','ESCALATION_TRIGGERED')
            GROUP BY se."eventType", rt.name
            ORDER BY "count" DESC
            """,
            str(period_days),
        )

    return [dict(r) for r in rows]


async def create_audit_log(
    entity_type: str,
    entity_id: str,
    action_type: str,
    description: str,
    actor_user_id: str | None = None,
    meta: dict | None = None,
) -> None:
    """Audit log kaydı oluştur."""
    pool = await get_pool()
    import json
    try:
        await pool.execute(
            """
            INSERT INTO "AuditLog"
              (id, "userId", "actionType", "entityType", "entityId",
               "newValuesJson", "createdAt")
            VALUES
              (gen_random_uuid(), $1, $2::text::"AuditActionType", $3, $4, $5, NOW())
            """,
            actor_user_id, action_type, entity_type, entity_id,
            json.dumps({"description": description, **(meta or {})}),
        )
    except Exception as e:
        logger.warning("create_audit_log_failed", error=str(e))


async def create_reminder_record(
    request_id: str,
    target_user_id: str,
    reminder_type: str,
    scheduled_at: str,
) -> None:
    """Reminder kaydını DB'ye yaz."""
    pool = await get_pool()
    try:
        await pool.execute(
            """
            INSERT INTO "Notification"
              (id, "userId", type, title, message, "requestId", status, "createdAt", "updatedAt")
            VALUES
              (gen_random_uuid(), $1, 'IN_APP',
               $2, $3, $4, 'PENDING', NOW(), NOW())
            ON CONFLICT DO NOTHING
            """,
            target_user_id,
            f"Reminder: {reminder_type}",
            f"Scheduled reminder at {scheduled_at}",
            request_id,
        )
    except Exception as e:
        logger.warning("create_reminder_failed", error=str(e))


async def fetch_active_students(
    faculty_id: str | None = None,
    department_id: str | None = None,
) -> list[dict]:
    """Aktif öğrencileri çek — event.published bildirimleri için."""
    pool = await get_pool()
    if faculty_id:
        rows = await pool.fetch(
            """
            SELECT u.id, u.email, p."fullName"
            FROM "User" u
            LEFT JOIN "UserProfile" p ON p."userId" = u.id
            WHERE u.role = 'STUDENT' AND u."isActive" = true
              AND p."facultyId" = $1
            """,
            faculty_id,
        )
    elif department_id:
        rows = await pool.fetch(
            """
            SELECT u.id, u.email, p."fullName"
            FROM "User" u
            LEFT JOIN "UserProfile" p ON p."userId" = u.id
            WHERE u.role = 'STUDENT' AND u."isActive" = true
              AND p."departmentId" = $1
            """,
            department_id,
        )
    else:
        rows = await pool.fetch(
            """
            SELECT u.id, u.email, p."fullName"
            FROM "User" u
            LEFT JOIN "UserProfile" p ON p."userId" = u.id
            WHERE u.role = 'STUDENT' AND u."isActive" = true
            """,
        )
    return [dict(r) for r in rows]


async def create_email_log(
    to_email: str,
    subject: str,
    template_key: str | None = None,
    user_id: str | None = None,
    request_id: str | None = None,
    status: str = "SENT",
) -> None:
    """Email log kaydı oluştur."""
    pool = await get_pool()
    try:
        await pool.execute(
            """
            INSERT INTO "EmailLog"
              (id, "userId", "requestId", "toEmail", subject, "templateKey", status, "createdAt", "updatedAt")
            VALUES
              (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
            """,
            user_id, request_id, to_email, subject, template_key, status,
        )
    except Exception as e:
        logger.error("create_email_log_failed", error=str(e))
