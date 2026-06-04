/**
 * Report export helpers — PDF (jsPDF + Roboto TR-supporting font) and Excel (XLS via
 * styled HTML, opens cleanly in Excel/LibreOffice without needing the `xlsx` package).
 *
 * PDF font: Roboto-Regular and Roboto-Medium are fetched once from jsDelivr (Apache 2.0
 * via the Google Fonts repo) and cached in module scope. Roboto fully covers Turkish
 * characters (ç ğ ı İ ö ş ü). If the fetch fails, the export still produces a PDF using
 * jsPDF's built-in helvetica, but Turkish letters may render incorrectly.
 */

import jsPDF from 'jspdf'

const ROBOTO_REGULAR_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Regular.ttf'
const ROBOTO_MEDIUM_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Medium.ttf'

let robotoCache: { regular: string; medium: string } | null = null
let robotoInflight: Promise<{ regular: string; medium: string } | null> | null = null

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  // Chunked encoding to avoid call-stack overflow on large fonts.
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'force-cache' })
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`)
  return bufferToBase64(await res.arrayBuffer())
}

async function loadRoboto(): Promise<{ regular: string; medium: string } | null> {
  if (robotoCache) return robotoCache
  if (robotoInflight) return robotoInflight
  robotoInflight = (async () => {
    try {
      const [regular, medium] = await Promise.all([
        fetchFontBase64(ROBOTO_REGULAR_URL),
        fetchFontBase64(ROBOTO_MEDIUM_URL),
      ])
      robotoCache = { regular, medium }
      return robotoCache
    } catch {
      return null
    } finally {
      robotoInflight = null
    }
  })()
  return robotoInflight
}

// ─── Public types ──────────────────────────────────────────────────────────────

export interface ReportSection {
  /** Section heading rendered above the table (e.g. "Genel Metrikler"). */
  title: string
  /** Column headers in display order (e.g. ["Metrik", "Değer"]). */
  headers: string[]
  /** Data rows; each row is an array of cell values matching `headers`. */
  rows: Array<Array<string | number>>
}

export interface ReportExportInput {
  /** Document title shown at the top of the PDF and as the sheet name in Excel. */
  title: string
  /** Optional subtitle / sub-header line (one line). */
  subtitle?: string
  /** Sections rendered in order. Each becomes one block in PDF and one sheet in Excel. */
  sections: ReportSection[]
  /** Base filename without extension. A date suffix and extension are appended automatically. */
  filename?: string
}

// ─── PDF export ────────────────────────────────────────────────────────────────

const PDF_MARGIN_X = 40
const PDF_MARGIN_TOP = 60
const PDF_LINE_HEIGHT = 16
const PDF_TABLE_ROW_H = 22
const PDF_TABLE_HEADER_BG: [number, number, number] = [241, 245, 249] // slate-100
const PDF_TABLE_HEADER_FG: [number, number, number] = [30, 41, 59] // slate-800
const PDF_TABLE_BORDER: [number, number, number] = [226, 232, 240] // slate-200
const PDF_TABLE_ZEBRA: [number, number, number] = [248, 250, 252] // slate-50
const PDF_PRIMARY: [number, number, number] = [99, 102, 241] // indigo-500

function setRobotoFont(doc: jsPDF, weight: 'regular' | 'medium', size: number) {
  try {
    doc.setFont('Roboto', weight === 'medium' ? 'bold' : 'normal')
  } catch {
    doc.setFont('helvetica', weight === 'medium' ? 'bold' : 'normal')
  }
  doc.setFontSize(size)
}

function ensurePageRoom(doc: jsPDF, cursorY: number, needed: number, redrawHeader: () => void) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (cursorY + needed > pageHeight - 40) {
    doc.addPage()
    redrawHeader()
    return PDF_MARGIN_TOP
  }
  return cursorY
}

function drawTable(
  doc: jsPDF,
  section: ReportSection,
  cursorY: number,
  pageWidth: number,
  redrawHeader: () => void,
): number {
  const usableWidth = pageWidth - PDF_MARGIN_X * 2
  const colCount = section.headers.length
  // Equal width for non-2-column, 60/40 for 2-column (metric/value).
  const widths =
    colCount === 2
      ? [usableWidth * 0.62, usableWidth * 0.38]
      : Array.from({ length: colCount }, () => usableWidth / colCount)

  // Section title
  cursorY = ensurePageRoom(doc, cursorY, PDF_LINE_HEIGHT * 2, redrawHeader)
  setRobotoFont(doc, 'medium', 12)
  doc.setTextColor(...PDF_PRIMARY)
  doc.text(section.title, PDF_MARGIN_X, cursorY)
  cursorY += 8
  doc.setDrawColor(...PDF_PRIMARY)
  doc.setLineWidth(1)
  doc.line(PDF_MARGIN_X, cursorY, PDF_MARGIN_X + 28, cursorY)
  cursorY += 14

  // Header row
  cursorY = ensurePageRoom(doc, cursorY, PDF_TABLE_ROW_H, redrawHeader)
  doc.setFillColor(...PDF_TABLE_HEADER_BG)
  doc.rect(PDF_MARGIN_X, cursorY - 14, usableWidth, PDF_TABLE_ROW_H, 'F')
  setRobotoFont(doc, 'medium', 9.5)
  doc.setTextColor(...PDF_TABLE_HEADER_FG)
  let x = PDF_MARGIN_X
  section.headers.forEach((header, i) => {
    doc.text(header, x + 8, cursorY)
    x += widths[i]
  })
  cursorY += 8
  doc.setDrawColor(...PDF_TABLE_BORDER)
  doc.setLineWidth(0.5)
  doc.line(PDF_MARGIN_X, cursorY, PDF_MARGIN_X + usableWidth, cursorY)
  cursorY += 4

  // Body rows
  setRobotoFont(doc, 'regular', 9.5)
  doc.setTextColor(30, 41, 59)
  section.rows.forEach((row, rowIdx) => {
    cursorY = ensurePageRoom(doc, cursorY, PDF_TABLE_ROW_H, redrawHeader)
    if (rowIdx % 2 === 0) {
      doc.setFillColor(...PDF_TABLE_ZEBRA)
      doc.rect(PDF_MARGIN_X, cursorY - 12, usableWidth, PDF_TABLE_ROW_H - 4, 'F')
    }
    let cx = PDF_MARGIN_X
    row.forEach((cell, i) => {
      const text = String(cell ?? '')
      const isLast = i === row.length - 1
      // Right-align numeric value column when there are exactly 2 columns.
      if (isLast && colCount === 2) {
        const tw = doc.getTextWidth(text)
        doc.text(text, cx + widths[i] - tw - 8, cursorY)
      } else {
        // Truncate very long values to fit width.
        const maxWidth = widths[i] - 16
        let display = text
        while (display.length > 0 && doc.getTextWidth(display) > maxWidth) {
          display = display.slice(0, -1)
        }
        if (display !== text && display.length > 1) {
          display = display.slice(0, -1) + '…'
        }
        doc.text(display, cx + 8, cursorY)
      }
      cx += widths[i]
    })
    cursorY += PDF_TABLE_ROW_H - 4
  })

  // Closing rule under the table — robust even when the table spans multiple pages.
  doc.setDrawColor(...PDF_TABLE_BORDER)
  doc.setLineWidth(0.5)
  doc.line(PDF_MARGIN_X, cursorY - 2, PDF_MARGIN_X + usableWidth, cursorY - 2)

  return cursorY + 18
}

export async function exportReportToPdf(input: ReportExportInput): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const font = await loadRoboto()

  if (font) {
    doc.addFileToVFS('Roboto-Regular.ttf', font.regular)
    doc.addFileToVFS('Roboto-Medium.ttf', font.medium)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.addFont('Roboto-Medium.ttf', 'Roboto', 'bold')
  }

  const pageWidth = doc.internal.pageSize.getWidth()
  const generatedAt = new Date()
  const generatedAtText = generatedAt.toLocaleString('tr-TR', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  const renderHeader = () => {
    setRobotoFont(doc, 'medium', 16)
    doc.setTextColor(15, 23, 42) // slate-900
    doc.text(input.title, PDF_MARGIN_X, 38)

    setRobotoFont(doc, 'regular', 9)
    doc.setTextColor(100, 116, 139) // slate-500
    const right = `${generatedAtText}`
    doc.text(right, pageWidth - PDF_MARGIN_X - doc.getTextWidth(right), 38)

    if (input.subtitle) {
      setRobotoFont(doc, 'regular', 10)
      doc.setTextColor(71, 85, 105) // slate-600
      doc.text(input.subtitle, PDF_MARGIN_X, 54)
    }

    // Primary accent line
    doc.setDrawColor(...PDF_PRIMARY)
    doc.setLineWidth(2)
    doc.line(PDF_MARGIN_X, 64, pageWidth - PDF_MARGIN_X, 64)
  }

  const renderFooter = (pageNum: number, pageCount: number) => {
    const pageHeight = doc.internal.pageSize.getHeight()
    setRobotoFont(doc, 'regular', 8.5)
    doc.setTextColor(148, 163, 184) // slate-400
    doc.text('CampusOps', PDF_MARGIN_X, pageHeight - 24)
    const right = `${pageNum} / ${pageCount}`
    doc.text(right, pageWidth - PDF_MARGIN_X - doc.getTextWidth(right), pageHeight - 24)
  }

  renderHeader()
  let cursorY = PDF_MARGIN_TOP + 20

  input.sections.forEach((section) => {
    cursorY = drawTable(doc, section, cursorY, pageWidth, renderHeader)
  })

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    renderFooter(i, totalPages)
  }

  const dateSuffix = generatedAt.toISOString().slice(0, 10)
  const filenameBase = input.filename ?? 'campus-ops-report'
  doc.save(`${filenameBase}-${dateSuffix}.pdf`)
}

// ─── Excel export (HTML-based XLS) ─────────────────────────────────────────────
//
// Builds a UTF-8 BOM + styled HTML <table>. Excel parses HTML tables with inline
// CSS and renders them as a real worksheet (Türkçe karakter support intact, no
// external package required). Saved as .xls so Excel opens directly.

function escapeHtml(value: string | number): string {
  const text = String(value ?? '')
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function buildExcelHtml(input: ReportExportInput): string {
  const generatedAt = new Date().toLocaleString('tr-TR', {
    year: 'numeric', month: 'long', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  const styles = `
    <style>
      body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; }
      .doc-title { font-size: 20pt; font-weight: 700; color: #1e293b; padding: 8px 0 2px; }
      .doc-subtitle { font-size: 11pt; color: #475569; padding-bottom: 4px; }
      .doc-meta { font-size: 9pt; color: #94a3b8; padding-bottom: 14px; }
      .section-title {
        font-size: 13pt; font-weight: 700; color: #4f46e5;
        padding: 18px 0 6px;
      }
      table { border-collapse: collapse; width: 100%; }
      th {
        background-color: #4f46e5; color: #ffffff;
        font-weight: 600; font-size: 10pt;
        padding: 8px 10px; border: 1px solid #4338ca;
        text-align: left;
      }
      td {
        padding: 6px 10px; font-size: 10pt;
        border: 1px solid #e2e8f0;
        color: #1e293b;
      }
      td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
      tr.zebra td { background-color: #f8fafc; }
    </style>
  `

  const sectionsHtml = input.sections
    .map((section) => {
      const headerCells = section.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
      const bodyRows = section.rows
        .map((row, idx) => {
          const cells = row
            .map((cell, ci) => {
              const last = ci === row.length - 1
              const className = last && row.length === 2 && isNumeric(cell) ? ' class="num"' : ''
              return `<td${className}>${escapeHtml(cell)}</td>`
            })
            .join('')
          return `<tr${idx % 2 === 1 ? ' class="zebra"' : ''}>${cells}</tr>`
        })
        .join('')
      return `
        <div class="section-title">${escapeHtml(section.title)}</div>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      `
    })
    .join('')

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  ${styles}
</head>
<body>
  <div class="doc-title">${escapeHtml(input.title)}</div>
  ${input.subtitle ? `<div class="doc-subtitle">${escapeHtml(input.subtitle)}</div>` : ''}
  <div class="doc-meta">${generatedAt}</div>
  ${sectionsHtml}
</body>
</html>`
}

export function exportReportToExcel(input: ReportExportInput): void {
  // UTF-8 BOM ensures Excel reads Türkçe characters correctly.
  const html = '﻿' + buildExcelHtml(input)
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const dateSuffix = new Date().toISOString().slice(0, 10)
  const filenameBase = input.filename ?? 'campus-ops-report'
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenameBase}-${dateSuffix}.xls`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
