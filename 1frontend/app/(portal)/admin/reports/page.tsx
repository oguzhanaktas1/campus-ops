'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart2, FileText, Ticket, BookMarked, CalendarDays,
  Loader2, TrendingUp, Clock, Users, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, Download, FileSpreadsheet, ChevronDown,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
  PieChart, Pie,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import {
  exportReportToExcel,
  exportReportToPdf,
  type ReportExportInput,
} from '@/lib/report-export'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportData {
  totalUsers:          number
  totalRequests:       number
  openRequests:        number
  resolvedRequests:    number
  avgResolutionDays:   number | null
  overdueRequests?:    number
  approvalRate?:       number
  totalTickets:        number
  openTickets:         number
  totalReservations:   number
  totalAppointments:   number
  requestsByStatus:    { status: string; count: number }[]
  requestsByType:      { type:   string; count: number }[]
  ticketsByStatus:     { status: string; count: number }[]
}

// ─── Styling maps ─────────────────────────────────────────────────────────────

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#ef4444', '#64748b']
const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: '#6366f1',
  IN_REVIEW: '#f59e0b',
  WAITING_APPROVAL: '#8b5cf6',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  COMPLETED: '#059669',
  CANCELLED: '#94a3b8',
  REVISION_REQUESTED: '#ec4899',
  DRAFT: '#64748b',
  OPEN: '#ef4444',
  TRIAGED: '#f59e0b',
  IN_PROGRESS: '#6366f1',
  WAITING_USER: '#8b5cf6',
  RESOLVED: '#10b981',
  CLOSED: '#94a3b8',
  REOPENED: '#ec4899',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent, accentColor }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: string; accentColor?: string
}) {
  return (
    <div className={cn(
      'bg-gradient-to-br from-card to-muted/10 border border-border rounded-lg p-5 shadow-sm flex items-start justify-between gap-3 border-l-4',
      accentColor ?? 'border-l-primary'
    )}>
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
        <p className={cn('text-2xl font-bold text-foreground', accent)}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className="size-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
        {icon}
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h2>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </div>
  )
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  )
}

// ─── Export payload builder ───────────────────────────────────────────────────
//
// Produces the common structured payload consumed by both PDF and Excel exporters.
// Single source of truth — keeps both formats in sync.

interface ReportLabels {
  title: string
  subtitle: string
  metric: string
  value: string
  status: string
  type: string
  days: string
  sectionSummary: string
  sectionRequests: string
  sectionRequestsByStatus: string
  sectionRequestsByType: string
  sectionTickets: string
  sectionTicketsByStatus: string
  sectionOperations: string
  rowTotalRequests: string
  rowOpenRequests: string
  rowResolvedRequests: string
  rowOverdueRequests: string
  rowAvgResolution: string
  rowApprovalRate: string
  rowTotalUsers: string
  rowTotalTickets: string
  rowOpenTickets: string
  rowTotalReservations: string
  rowTotalAppointments: string
}

function buildReportPayload(data: ReportData, l: ReportLabels): ReportExportInput {
  const dash = '—'
  const sections: ReportExportInput['sections'] = []

  sections.push({
    title: l.sectionSummary,
    headers: [l.metric, l.value],
    rows: [
      [l.rowTotalRequests, data.totalRequests],
      [l.rowOpenRequests, data.openRequests],
      [l.rowResolvedRequests, data.resolvedRequests],
      [l.rowOverdueRequests, data.overdueRequests ?? 0],
      [
        l.rowAvgResolution,
        data.avgResolutionDays != null ? `${data.avgResolutionDays} ${l.days}` : dash,
      ],
      [l.rowApprovalRate, data.approvalRate != null ? `%${data.approvalRate}` : dash],
      [l.rowTotalUsers, data.totalUsers],
    ],
  })

  if (data.requestsByStatus?.length) {
    sections.push({
      title: l.sectionRequestsByStatus,
      headers: [l.status, l.value],
      rows: data.requestsByStatus.map((row) => [row.status.replace(/_/g, ' '), row.count]),
    })
  }

  if (data.requestsByType?.length) {
    sections.push({
      title: l.sectionRequestsByType,
      headers: [l.type, l.value],
      rows: data.requestsByType.map((row) => [row.type, row.count]),
    })
  }

  sections.push({
    title: l.sectionTickets,
    headers: [l.metric, l.value],
    rows: [
      [l.rowTotalTickets, data.totalTickets],
      [l.rowOpenTickets, data.openTickets],
    ],
  })

  if (data.ticketsByStatus?.length) {
    sections.push({
      title: l.sectionTicketsByStatus,
      headers: [l.status, l.value],
      rows: data.ticketsByStatus.map((row) => [row.status.replace(/_/g, ' '), row.count]),
    })
  }

  sections.push({
    title: l.sectionOperations,
    headers: [l.metric, l.value],
    rows: [
      [l.rowTotalReservations, data.totalReservations],
      [l.rowTotalAppointments, data.totalAppointments],
    ],
  })

  return {
    title: l.title,
    subtitle: l.subtitle,
    filename: 'campus-ops-report',
    sections,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminReportsPage() {
  const { t } = useI18n()
  const [data,       setData]       = useState<ReportData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting,  setExporting]  = useState<'pdf' | 'excel' | null>(null)

  const fetchReport = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const base    = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const headers = { Authorization: `Bearer ${getToken()}` }
      const [repRes, sumRes] = await Promise.all([
        fetch(`${base}/admin/reports`,          { headers }),
        fetch(`${base}/admin/dashboard/summary`, { headers }),
      ])
      if (!repRes.ok) throw new Error()
      const report  = await repRes.json()
      const summary = sumRes.ok ? await sumRes.json() : {}
      setData({ ...report, overdueRequests: summary.overdueRequests ?? 0, approvalRate: summary.approvalRate ?? 0 })
    } catch {
      toast.error(t('reports.loadFail'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void fetchReport() }, [fetchReport])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">{t('reports.generating')}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const resolveRate = data.totalRequests > 0
    ? Math.round((data.resolvedRequests / data.totalRequests) * 100)
    : 0

  const ticketResolveRate = data.totalTickets > 0
    ? Math.round(((data.totalTickets - data.openTickets) / data.totalTickets) * 100)
    : 0

  // Localized labels for PDF / Excel export. `tt()` falls back to a Turkish default
  // when the i18n key is not yet defined in the dictionary, so the export works
  // even before translations are added.
  const tt = (key: string, fallback: string): string => {
    const v = t(key)
    return v === key ? fallback : v
  }
  const buildLabels = (): ReportLabels => ({
    title: tt('reports.title', 'Yönetici Raporu'),
    subtitle: tt('reports.subtitle', 'Platform geneli operasyon özeti'),
    metric: tt('reports.colName', 'Metrik'),
    value: tt('reports.colPeriod', 'Değer'),
    status: tt('reports.statusColumn', 'Durum'),
    type: tt('reports.typeColumn', 'Tip'),
    days: tt('reports.daysShort', 'gün'),
    sectionSummary: tt('reports.fullSummary', 'Genel Özet'),
    sectionRequests: tt('reports.requests', 'Talepler'),
    sectionRequestsByStatus: tt('reports.byStatus', 'Duruma Göre Talepler'),
    sectionRequestsByType: tt('reports.byType', 'Tipe Göre Talepler'),
    sectionTickets: tt('reports.itTickets', 'IT Ticketları'),
    sectionTicketsByStatus: tt('reports.byTicketStatus', 'Duruma Göre Ticketlar'),
    sectionOperations: tt('reports.operations', 'Operasyonlar'),
    rowTotalRequests: tt('reports.rowTotalRequests', 'Toplam Talep'),
    rowOpenRequests: tt('reports.rowOpenRequests', 'Açık Talep'),
    rowResolvedRequests: tt('reports.rowResolvedRequests', 'Çözülmüş Talep'),
    rowOverdueRequests: tt('reports.rowOverdueRequests', 'Geciken Talep'),
    rowAvgResolution: tt('reports.rowAvgResolution', 'Ortalama Çözüm Süresi'),
    rowApprovalRate: tt('reports.rowApprovalRate', 'Onay Oranı'),
    rowTotalUsers: tt('reports.totalUsers', 'Toplam Kullanıcı'),
    rowTotalTickets: tt('reports.rowTotalTickets', 'Toplam Ticket'),
    rowOpenTickets: tt('reports.rowOpenTickets', 'Açık Ticket'),
    rowTotalReservations: tt('reports.rowTotalReservations', 'Toplam Rezervasyon'),
    rowTotalAppointments: tt('reports.rowTotalAppointments', 'Toplam Randevu'),
  })

  const handleExportPdf = async () => {
    if (!data) return
    setExporting('pdf')
    try {
      const payload = buildReportPayload(data, buildLabels())
      await exportReportToPdf(payload)
      toast.success(tt('reports.exportPdfSuccess', 'PDF indirildi'))
    } catch {
      toast.error(tt('reports.exportFail', 'Dışa aktarma başarısız oldu'))
    } finally {
      setExporting(null)
    }
  }

  const handleExportExcel = () => {
    if (!data) return
    setExporting('excel')
    try {
      const payload = buildReportPayload(data, buildLabels())
      exportReportToExcel(payload)
      toast.success(tt('reports.exportExcelSuccess', 'Excel indirildi'))
    } catch {
      toast.error(tt('reports.exportFail', 'Dışa aktarma başarısız oldu'))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto pb-20">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart2 className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{t('reports.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('reports.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => void fetchReport(true)} disabled={refreshing}>
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary/90"
                disabled={exporting !== null}
              >
                {exporting !== null ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {t('reports.download')}
                <ChevronDown className="size-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40">
              <DropdownMenuLabel>
                {tt('reports.exportAs', 'Dışa Aktar')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleExportPdf()}>
                <FileText className="size-4 text-red-500" />
                <span>PDF</span>
                <span className="ml-auto text-[10px] text-muted-foreground">.pdf</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExportExcel()}>
                <FileSpreadsheet className="size-4 text-emerald-600" />
                <span>Excel</span>
                <span className="ml-auto text-[10px] text-muted-foreground">.xls</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Health summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 border-t-2 border-t-emerald-500 rounded-lg p-3.5 flex items-center gap-2.5 shadow-sm">
          <CheckCircle2 className="size-4 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">{resolveRate}%</p>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-500">{t('reports.resolutionRate')}</p>
          </div>
        </div>
        <div className={cn(
          'border rounded-lg p-3.5 flex items-center gap-2.5 shadow-sm border-t-2',
          (data.overdueRequests ?? 0) > 0
            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 border-t-red-500'
            : 'bg-muted/30 border-border border-t-slate-300'
        )}>
          <AlertTriangle className={cn('size-4 flex-shrink-0', (data.overdueRequests ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground')} />
          <div>
            <p className={cn('text-base font-bold', (data.overdueRequests ?? 0) > 0 ? 'text-red-700 dark:text-red-400' : 'text-foreground')}>
              {data.overdueRequests ?? 0}
            </p>
            <p className="text-[11px] text-muted-foreground">{t('reports.overdue')}</p>
          </div>
        </div>
        <div className="bg-card border border-border border-t-2 border-t-primary rounded-lg p-3.5 flex items-center gap-2.5 shadow-sm">
          <Clock className="size-4 text-primary flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-foreground">
              {data.avgResolutionDays != null ? `${data.avgResolutionDays}d` : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground">{t('reports.avgResolution')}</p>
          </div>
        </div>
        <div className="bg-card border border-border border-t-2 border-t-purple-500 rounded-lg p-3.5 flex items-center gap-2.5 shadow-sm">
          <Users className="size-4 text-purple-500 flex-shrink-0" />
          <div>
            <p className="text-base font-bold text-foreground">{data.totalUsers.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">{t('reports.totalUsers')}</p>
          </div>
        </div>
      </div>

      {/* ── Requests ──────────────────────────────────────────────────────────── */}
      <Section title={t('reports.requests')} icon={<FileText className="size-4" />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard icon={<FileText    className="size-5" />} label={t('reports.total')}           value={(data.totalRequests    ?? 0).toLocaleString()}
            accentColor="border-l-primary" />
          <StatCard icon={<TrendingUp  className="size-5" />} label={t('reports.open')}            value={data.openRequests      ?? 0} sub={t('reports.awaitingAction')}
            accent={(data.openRequests ?? 0) > 0 ? 'text-amber-600' : undefined}
            accentColor="border-l-amber-500" />
          <StatCard icon={<CheckCircle2 className="size-5" />} label={t('reports.resolved')}      value={data.resolvedRequests  ?? 0} sub={t('reports.ofTotal', { rate: resolveRate })}
            accent="text-emerald-600"
            accentColor="border-l-emerald-500" />
          <StatCard icon={<Clock       className="size-5" />} label={t('reports.avgResolution')}  value={data.avgResolutionDays != null ? `${data.avgResolutionDays}d` : '—'}
            sub={t('reports.daysToClose')}
            accentColor="border-l-indigo-500" />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <ChartPanel title={t('reports.byStatus')}>
            {data.requestsByStatus?.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.requestsByStatus} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 264 / 0.55)" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.replace(/_/g, ' ').slice(0, 12)} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {data.requestsByStatus.map((row, i) => (
                      <Cell key={row.status} fill={STATUS_COLORS[row.status] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-6">{t('reports.noData')}</p>}
          </ChartPanel>

          <ChartPanel title={t('reports.byType')}>
            {data.requestsByType?.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.requestsByType.slice(0, 10)} layout="vertical" barSize={18} margin={{ top: 4, right: 18, bottom: 4, left: 96 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 264 / 0.55)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="type" width={92} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {data.requestsByType.slice(0, 10).map((row, i) => (
                      <Cell key={row.type} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-muted-foreground text-center py-6">{t('reports.noData')}</p>}
          </ChartPanel>
        </div>
      </Section>

      {/* ── IT Tickets ────────────────────────────────────────────────────────── */}
      <Section title={t('reports.itTickets')} icon={<Ticket className="size-4" />}>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <StatCard icon={<Ticket       className="size-5" />} label="Total"    value={(data.totalTickets ?? 0).toLocaleString()}
            accentColor="border-l-primary" />
          <StatCard icon={<XCircle      className="size-5" />} label="Open"     value={data.openTickets   ?? 0} sub="Unresolved"
            accent={(data.openTickets ?? 0) > 0 ? 'text-red-600' : undefined}
            accentColor="border-l-red-500" />
          <StatCard icon={<CheckCircle2 className="size-5" />} label="Resolved" value={Math.max(0, (data.totalTickets ?? 0) - (data.openTickets ?? 0))}
            sub={`${ticketResolveRate}% of total`} accent="text-emerald-600"
            accentColor="border-l-emerald-500" />
        </div>

        {data.ticketsByStatus?.length > 0 && (
          <ChartPanel title={t('reports.byTicketStatus')}>
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.ticketsByStatus} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 264 / 0.55)" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.replace(/_/g, ' ')} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {data.ticketsByStatus.map((row, i) => (
                      <Cell key={row.status} fill={STATUS_COLORS[row.status] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data.ticketsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={2}>
                    {data.ticketsByStatus.map((row, i) => (
                      <Cell key={row.status} fill={STATUS_COLORS[row.status] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartPanel>
        )}
      </Section>

      {/* ── Operations ────────────────────────────────────────────────────────── */}
      <Section title={t('reports.operations')} icon={<BarChart2 className="size-4" />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<BookMarked   className="size-5" />} label="Total Reservations" value={(data.totalReservations ?? 0).toLocaleString()}
            accentColor="border-l-emerald-500" />
          <StatCard icon={<CalendarDays className="size-5" />} label="Total Appointments" value={(data.totalAppointments ?? 0).toLocaleString()}
            accentColor="border-l-indigo-500" />
          <StatCard icon={<Users        className="size-5" />} label={t('reports.totalUsers')}        value={(data.totalUsers        ?? 0).toLocaleString()}
            accentColor="border-l-purple-500" />
          <StatCard icon={<FileText     className="size-5" />} label="All Requests"       value={(data.totalRequests     ?? 0).toLocaleString()}
            accentColor="border-l-amber-500" />
        </div>
      </Section>

      {/* ── Summary table ─────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t('reports.fullSummary')}</h3>
          <span className="text-xs text-muted-foreground">
            {t('reports.generated', { time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) })}
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-primary/5 border-b border-border">
              <th className="text-left py-2.5 px-5 font-medium text-muted-foreground">{t('reports.colName')}</th>
              <th className="text-right py-2.5 px-5 font-medium text-muted-foreground">{t('reports.colPeriod')}</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Total Requests',     value: (data.totalRequests    ?? 0).toLocaleString() },
              { label: 'Open Requests',      value: data.openRequests      ?? 0 },
              { label: 'Resolved Requests',  value: data.resolvedRequests  ?? 0 },
              { label: 'Overdue Requests',   value: data.overdueRequests   ?? 0 },
              { label: 'Avg. Resolution',    value: data.avgResolutionDays != null ? `${data.avgResolutionDays} days` : '—' },
              { label: 'Total Users',        value: (data.totalUsers        ?? 0).toLocaleString() },
              { label: 'Total Tickets',      value: (data.totalTickets      ?? 0).toLocaleString() },
              { label: 'Open Tickets',       value: data.openTickets        ?? 0 },
              { label: 'Total Reservations', value: (data.totalReservations ?? 0).toLocaleString() },
              { label: 'Total Appointments', value: (data.totalAppointments ?? 0).toLocaleString() },
            ].map((row, i) => (
              <tr key={row.label} className={cn(
                'border-b border-border/50 border-l-2',
                i % 2 === 0 ? 'bg-muted/20 border-l-primary' : 'border-l-transparent'
              )}>
                <td className="py-2.5 px-5 text-muted-foreground">{row.label}</td>
                <td className="py-2.5 px-5 text-right font-bold text-primary">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
