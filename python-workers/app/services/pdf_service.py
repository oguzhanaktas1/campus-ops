"""
PDF oluşturma servisi — reportlab kullanılıyor.

Faz 3 kapsamı:
  - Onaylı talep özet belgesi
  - Öğrenci kayıt belgesi (document request)
  - Genel rapor export'u
"""
from __future__ import annotations
import io
from datetime import datetime
import structlog
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

logger = structlog.get_logger(__name__)

# ─── Renkler ─────────────────────────────────────────────────────────────────
PRIMARY   = colors.HexColor("#4f46e5")
SUCCESS   = colors.HexColor("#059669")
DANGER    = colors.HexColor("#dc2626")
MUTED     = colors.HexColor("#6b7280")
LIGHT_BG  = colors.HexColor("#f9fafb")
BORDER    = colors.HexColor("#e5e7eb")


def _base_doc(buffer: io.BytesIO, title: str) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        leftMargin=2.5 * cm,
        rightMargin=2.5 * cm,
        title=title,
        author="CampusFlow",
    )


def _styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "cf_title", parent=base["Heading1"],
            fontSize=20, textColor=PRIMARY, spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "cf_subtitle", parent=base["Normal"],
            fontSize=10, textColor=MUTED, spaceAfter=12,
        ),
        "label": ParagraphStyle(
            "cf_label", parent=base["Normal"],
            fontSize=8, textColor=MUTED, spaceAfter=1,
            fontName="Helvetica-Bold",
        ),
        "value": ParagraphStyle(
            "cf_value", parent=base["Normal"],
            fontSize=11, textColor=colors.black, spaceAfter=8,
        ),
        "section": ParagraphStyle(
            "cf_section", parent=base["Heading2"],
            fontSize=12, textColor=PRIMARY, spaceBefore=12, spaceAfter=6,
        ),
        "footer": ParagraphStyle(
            "cf_footer", parent=base["Normal"],
            fontSize=8, textColor=MUTED, alignment=TA_CENTER,
        ),
        "stamp": ParagraphStyle(
            "cf_stamp", parent=base["Normal"],
            fontSize=14, textColor=SUCCESS, alignment=TA_CENTER,
            fontName="Helvetica-Bold",
        ),
    }


# ─── Onaylı Talep Özet Belgesi ────────────────────────────────────────────────

def generate_approval_summary(
    request: dict,
    requester: dict | None = None,
    approver: dict | None = None,
) -> bytes:
    """
    Onaylı talep için resmi PDF özet belgesi.
    request: {id, requestNo, title, status, requestTypeName, priority, createdAt, completedAt}
    requester: {fullName, email, studentNumber, department}
    approver: {fullName, email}
    """
    buffer = io.BytesIO()
    doc = _base_doc(buffer, f"Approval Summary — {request.get('requestNo', '')}")
    s = _styles()
    story = []

    # Başlık
    story.append(Paragraph("CampusFlow", s["title"]))
    story.append(Paragraph("Official Approval Document", s["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceAfter=16))

    # Onay damgası
    story.append(Paragraph("✓  APPROVED", s["stamp"]))
    story.append(Spacer(1, 0.4 * cm))

    # Talep Bilgileri
    story.append(Paragraph("Request Details", s["section"]))

    req_data = [
        ["Request No",  request.get("requestNo", "—")],
        ["Title",       request.get("title", "—")],
        ["Type",        request.get("requestTypeName", "—")],
        ["Priority",    request.get("priority", "—").title()],
        ["Status",      request.get("status", "—").replace("_", " ").title()],
        ["Submitted",   _fmt_date(request.get("createdAt"))],
        ["Completed",   _fmt_date(request.get("completedAt"))],
    ]

    tbl = Table(req_data, colWidths=[5 * cm, 11 * cm])
    tbl.setStyle(_key_value_style())
    story.append(tbl)

    # Başvuran Bilgileri
    if requester:
        story.append(Paragraph("Requester", s["section"]))
        req_info = [
            ["Full Name",   requester.get("fullName", "—")],
            ["Email",       requester.get("email", "—")],
        ]
        if requester.get("studentNumber"):
            req_info.append(["Student No", requester["studentNumber"]])
        if requester.get("department"):
            req_info.append(["Department", requester["department"]])

        tbl2 = Table(req_info, colWidths=[5 * cm, 11 * cm])
        tbl2.setStyle(_key_value_style())
        story.append(tbl2)

    # Onaylayan
    if approver:
        story.append(Paragraph("Approved By", s["section"]))
        appr_info = [
            ["Full Name", approver.get("fullName", "—")],
            ["Email",     approver.get("email", "—")],
        ]
        tbl3 = Table(appr_info, colWidths=[5 * cm, 11 * cm])
        tbl3.setStyle(_key_value_style())
        story.append(tbl3)

    # Footer
    story.append(Spacer(1, 1 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        f"Generated by CampusFlow on {datetime.now().strftime('%d %B %Y %H:%M')} UTC  |  "
        "info@campusflow.com.tr",
        s["footer"],
    ))

    doc.build(story)
    return buffer.getvalue()


# ─── Rapor PDF ────────────────────────────────────────────────────────────────

def generate_report_pdf(
    title: str,
    period: str,
    rows: list[dict],
    columns: list[str],
) -> bytes:
    """
    Genel tablo raporu PDF.
    rows: [{"col1": "val1", "col2": "val2", ...}, ...]
    columns: ["col1", "col2", ...]
    """
    buffer = io.BytesIO()
    doc = _base_doc(buffer, title)
    s = _styles()
    story = []

    story.append(Paragraph("CampusFlow", s["title"]))
    story.append(Paragraph(f"{title} — {period}", s["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceAfter=12))

    # Tablo başlıkları
    header = [col.replace("_", " ").title() for col in columns]
    data_rows = [[str(row.get(col, "—")) for col in columns] for row in rows]
    table_data = [header] + data_rows

    col_width = (A4[0] - 5 * cm) / len(columns)
    tbl = Table(table_data, colWidths=[col_width] * len(columns))
    tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR",    (0, 0), (-1, 0), colors.white),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0), 9),
        ("ALIGN",        (0, 0), (-1, -1), "LEFT"),
        ("FONTSIZE",     (0, 1), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("GRID",         (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    story.append(tbl)

    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph(
        f"Total records: {len(rows)}  |  Generated: {datetime.now().strftime('%d %B %Y %H:%M')}",
        s["footer"],
    ))

    doc.build(story)
    return buffer.getvalue()


# ─── Yardımcılar ──────────────────────────────────────────────────────────────

def _key_value_style() -> TableStyle:
    return TableStyle([
        ("FONTNAME",     (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, -1), 9),
        ("TEXTCOLOR",    (0, 0), (0, -1), MUTED),
        ("TEXTCOLOR",    (1, 0), (1, -1), colors.black),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("LINEBELOW",    (0, 0), (-1, -2), 0.3, BORDER),
        ("BACKGROUND",   (0, 0), (-1, -1), colors.white),
    ])


def _fmt_date(val: str | None) -> str:
    if not val:
        return "—"
    try:
        dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        return dt.strftime("%d %B %Y")
    except Exception:
        return str(val)
