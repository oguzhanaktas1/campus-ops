'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Server,
  Cpu,
  Database,
  Radio,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Bot,
  HardDrive,
  Layers,
  MessageSquareX,
  GitBranch,
  Zap,
  MemoryStick,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceStatus {
  status: 'ok' | 'ready' | 'not_ready' | 'unreachable' | 'error' | string
  service?: string
  error?: string
  checks?: Record<string, boolean>
  timestamp?: string
  model?: string
  provider?: string
  enabled?: boolean
  runtime?: AiRuntimeStatus
  uptime_seconds?: number
}

interface AiRuntimeStatus {
  status: 'ok' | 'disabled' | 'unreachable' | 'error' | string
  baseUrl?: string
  model?: string
  modelAvailable?: boolean
  fallbackModel?: string
  fallbackModelAvailable?: boolean
  availableModels?: string[]
  latencyMs?: number
  error?: string
  checkedUrls?: string[]
  checkedEndpoints?: AiRuntimeEndpointStatus[]
}

interface AiRuntimeEndpointStatus {
  status: string
  baseUrl?: string
  latencyMs?: number
  error?: string
  modelAvailable?: boolean
}

interface QueueStats {
  name: string
  messages: number
  messagesReady: number
  messagesUnacked: number
  consumers: number
  publishRate: number
  deliverRate: number
}

interface DlqMessage {
  routingKey: string
  payload: string
  deathReason: string
  originalQueue: string
  timestamp: number
}

interface OutboxStats {
  pending: number
  failed: number
  processed: number
  oldestPendingAt?: string | null
  recentFailed?: Array<{
    id: string
    routingKey: string
    retryCount: number
    lastError?: string | null
    createdAt: string
  }>
}

interface RabbitmqStatus {
  timestamp?: string
  queues?: QueueStats[]
  dlq?: { count: number; messages: DlqMessage[] }
  outbox?: OutboxStats
  error?: string
  status?: string
}

interface Snapshot {
  timestamp: string
  backend: ServiceStatus
  workers: ServiceStatus
  ai: ServiceStatus
  rabbitmq: RabbitmqStatus
  outbox: OutboxStats
  urls: {
    backendHealth: string
    backendReady: string
    workersHealth: string
    workersReady: string
    aiHealth: string
    metrics: string
    rabbitmqMgmt: string
    prometheus: string
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isOk(s?: ServiceStatus | null) {
  return s?.status === 'ok' || s?.status === 'ready'
}

function isWarn(s?: ServiceStatus | null) {
  return s?.status === 'not_ready' || s?.status === 'degraded' || s?.status === 'disabled'
}

function statusOf(s?: ServiceStatus | null): 'ok' | 'warn' | 'down' {
  if (!s) return 'down'
  if (isOk(s)) return 'ok'
  if (isWarn(s)) return 'warn'
  return 'down'
}

function boolToStatus(v?: boolean): 'ok' | 'down' {
  return v ? 'ok' : 'down'
}

function formatTs(ts?: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(ts?: string | null) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleDateString('tr-TR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatUptime(seconds?: number) {
  if (!seconds) return null
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatNumber(value: unknown, digits = 0) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return digits > 0 ? (0).toFixed(digits) : '0'
  return digits > 0 ? number.toFixed(digits) : String(number)
}

function ExternalUrl({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      {label}
      <ExternalLink className="size-3" />
    </a>
  )
}

// ─── Status UI ────────────────────────────────────────────────────────────────

function StatusDot({ state }: { state: 'ok' | 'warn' | 'down' }) {
  return (
    <span
      className={cn(
        'inline-block size-2.5 rounded-full flex-shrink-0',
        state === 'ok' && 'bg-emerald-500',
        state === 'warn' && 'bg-amber-500',
        state === 'down' && 'bg-red-500 animate-pulse',
      )}
    />
  )
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const ok = status === 'ok' || status === 'ready'
  const warn = status === 'not_ready' || status === 'degraded' || status === 'disabled'
  const label = ok ? t('monitoring.healthy') : warn ? t('monitoring.degraded') : t('monitoring.down')
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
        ok && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
        warn && 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
        !ok && !warn && 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
      )}
    >
      {ok ? <CheckCircle2 className="size-3" /> : warn ? <AlertCircle className="size-3" /> : <XCircle className="size-3" />}
      {label}
    </span>
  )
}

// ─── Metric parser ────────────────────────────────────────────────────────────

function parsePrometheusMetrics(raw: string): { name: string; value: string; help?: string }[] {
  if (!raw || raw.includes('unreachable')) return []
  const lines = raw.split('\n')
  const helpMap: Record<string, string> = {}
  const result: { name: string; value: string; help?: string }[] = []
  for (const line of lines) {
    if (line.startsWith('# HELP')) {
      const parts = line.slice(7).split(' ')
      helpMap[parts[0]] = parts.slice(1).join(' ')
    }
    if (!line.startsWith('#') && line.trim() && line.includes(' ')) {
      const spaceIdx = line.lastIndexOf(' ')
      const name = line.slice(0, spaceIdx).trim()
      const value = line.slice(spaceIdx + 1).trim()
      if (name.includes('{') && name.includes('le=')) continue
      result.push({ name, value, help: helpMap[name.split('{')[0]] })
    }
  }
  return result.slice(0, 60)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { t } = useI18n()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [workersHealth, setWorkersHealth] = useState<ServiceStatus | null>(null)
  const [metricsRaw, setMetricsRaw] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [showMetrics, setShowMetrics] = useState(false)
  const [showDlq, setShowDlq] = useState(false)
  const [showEndpoints, setShowEndpoints] = useState(false)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const token = localStorage.getItem('access_token')
    const headers = { Authorization: `Bearer ${token ?? ''}` }

    try {
      const [snapRes, workersHealthRes, metricsRes] = await Promise.allSettled([
        fetch(`${backendUrl}/admin/system/snapshot`, { headers }),
        fetch(`${backendUrl}/admin/system/workers/health`, { headers }),
        fetch(`${backendUrl}/admin/system/workers/metrics/raw`, { headers }),
      ])
      if (snapRes.status === 'fulfilled' && snapRes.value.ok)
        setSnapshot(await snapRes.value.json())
      if (workersHealthRes.status === 'fulfilled' && workersHealthRes.value.ok)
        setWorkersHealth(await workersHealthRes.value.json())
      if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
        const data = await metricsRes.value.json()
        setMetricsRaw(data?.content ?? '')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLastRefresh(new Date())
    }
  }, [backendUrl])

  useEffect(() => {
    void fetchAll()
    const id = setInterval(() => void fetchAll(true), 30_000)
    return () => clearInterval(id)
  }, [fetchAll])

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const metrics = parsePrometheusMetrics(metricsRaw)

  // Derived service states
  const dbOk = snapshot?.backend?.checks?.database
  const backendMqOk = snapshot?.backend?.checks?.rabbitmq
  const workersMqOk = snapshot?.workers?.checks?.rabbitmq
  const workersDbOk = snapshot?.workers?.checks?.db
  const redisOk = snapshot?.workers?.checks?.redis
  const mqOk = backendMqOk && workersMqOk

  const serviceStates = [
    statusOf(snapshot?.backend),
    statusOf(snapshot?.workers),
    statusOf(snapshot?.ai),
    dbOk === undefined ? 'down' : boolToStatus(dbOk),
    redisOk === undefined ? 'down' : boolToStatus(redisOk),
    mqOk === undefined ? 'down' : boolToStatus(mqOk),
  ] as ('ok' | 'warn' | 'down')[]

  const healthyCount = serviceStates.filter((s) => s === 'ok').length
  const warnCount = serviceStates.filter((s) => s === 'warn').length
  const downCount = serviceStates.filter((s) => s === 'down').length
  const allOk = warnCount === 0 && downCount === 0

  // Queue stats from snapshot
  const queues: QueueStats[] = snapshot?.rabbitmq?.queues ?? []
  const dlqMessages: DlqMessage[] = snapshot?.rabbitmq?.dlq?.messages ?? []
  const dlqCount = snapshot?.rabbitmq?.dlq?.count ?? 0
  const totalMessages = queues.reduce((acc, q) => acc + Number(q.messages ?? 0), 0)
  const totalConsumers = queues.reduce((acc, q) => acc + Number(q.consumers ?? 0), 0)
  const outbox = snapshot?.outbox

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto overflow-x-hidden">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            {t('monitoring.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('monitoring.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              {lastRefresh.toLocaleTimeString('tr-TR')}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void fetchAll(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {/* Health summary banner */}
      <div className={cn(
        'flex items-center justify-between gap-4 rounded-lg border px-4 py-3',
        allOk
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20'
          : downCount > 0
            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
            : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20',
      )}>
        <div className="flex items-center gap-2">
          {allOk
            ? <CheckCircle2 className="size-4 text-emerald-600" />
            : downCount > 0
              ? <XCircle className="size-4 text-red-600" />
              : <AlertCircle className="size-4 text-amber-600" />}
          <span className={cn(
            'text-sm font-semibold',
            allOk ? 'text-emerald-700 dark:text-emerald-400' : downCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400',
          )}>
            {allOk
              ? t('monitoring.allHealthy')
              : [
                  healthyCount > 0 && t('monitoring.servicesHealthy', { count: healthyCount }),
                  warnCount > 0 && t('monitoring.servicesDegraded', { count: warnCount }),
                  downCount > 0 && t('monitoring.servicesDown', { count: downCount }),
                ].filter(Boolean).join(' · ')}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {snapshot?.timestamp ? formatTs(snapshot.timestamp) : '—'}
        </span>
      </div>

      {/* Service cards — 3 cols */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

        <ServiceCard
          icon={<Server className="size-4" />}
          title={t('monitoring.backendApi')}
          subtitle="NestJS · port 5000"
          state={statusOf(snapshot?.backend)}
          status={snapshot?.backend}
          checks={snapshot?.backend?.checks}
          extraLinks={snapshot?.urls && (
            <div className="flex gap-3 flex-wrap">
              <ExternalUrl label="/health" href={snapshot.urls.backendHealth} />
              <ExternalUrl label="/ready" href={snapshot.urls.backendReady} />
            </div>
          )}
        />

        <ServiceCard
          icon={<Cpu className="size-4" />}
          title={t('monitoring.pythonWorkers')}
          subtitle="FastAPI · port 8001"
          state={statusOf(snapshot?.workers)}
          status={snapshot?.workers}
          checks={snapshot?.workers?.checks}
          uptime={workersHealth?.uptime_seconds}
          extraLinks={snapshot?.urls && (
            <div className="flex gap-3 flex-wrap">
              <ExternalUrl label="/health" href={snapshot.urls.workersHealth} />
              <ExternalUrl label="/ready" href={snapshot.urls.workersReady} />
            </div>
          )}
        />

        <ServiceCard
          icon={<Bot className="size-4" />}
          title={t('monitoring.aiService')}
          subtitle="FastAPI · port 8010"
          state={statusOf(snapshot?.ai)}
          status={snapshot?.ai}
          extraLinks={snapshot?.urls && (
            <ExternalUrl label="/ai/health" href={snapshot.urls.aiHealth} />
          )}
          details={snapshot?.ai && <AiRuntimeDetails ai={snapshot.ai} />}
        />

        <ServiceCard
          icon={<Database className="size-4" />}
          title={t('monitoring.postgresql')}
          subtitle="Prisma ORM · postgres"
          state={dbOk === undefined ? 'down' : boolToStatus(dbOk)}
          inlineCheck={{ label: 'database', ok: dbOk ?? false }}
          secondaryCheck={workersDbOk !== undefined ? { label: 'workers→db', ok: workersDbOk } : undefined}
        />

        <ServiceCard
          icon={<MemoryStick className="size-4" />}
          title={t('monitoring.redis')}
          subtitle="Redis · cache / dedup"
          state={redisOk === undefined ? 'down' : boolToStatus(redisOk)}
          inlineCheck={{ label: 'redis', ok: redisOk ?? false }}
        />

        <ServiceCard
          icon={<Radio className="size-4" />}
          title={t('monitoring.rabbitmqBroker')}
          subtitle="AMQP · port 5672"
          state={mqOk === undefined ? 'down' : boolToStatus(mqOk)}
          inlineCheck={backendMqOk !== undefined ? { label: 'backend→mq', ok: backendMqOk } : undefined}
          secondaryCheck={workersMqOk !== undefined ? { label: 'workers→mq', ok: workersMqOk } : undefined}
          extraLinks={snapshot?.urls && (
            <ExternalUrl label={t('monitoring.managementUi')} href={snapshot.urls.rabbitmqMgmt} />
          )}
        />
      </div>

      {/* Queue overview stats */}
      {queues.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">{t('monitoring.queueOverview')}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              label={t('monitoring.totalQueues')}
              value={queues.length}
              icon={<Layers className="size-4" />}
            />
            <StatTile
              label={t('monitoring.totalMessages')}
              value={totalMessages}
              icon={<GitBranch className="size-4" />}
              tone={totalMessages > 100 ? 'danger' : totalMessages > 0 ? 'warn' : undefined}
            />
            <StatTile
              label={t('monitoring.activeConsumers')}
              value={totalConsumers}
              icon={<Zap className="size-4" />}
            />
            <StatTile
              label={t('monitoring.dlq')}
              value={dlqCount}
              icon={<MessageSquareX className="size-4" />}
              tone={dlqCount > 0 ? 'danger' : undefined}
            />
          </div>
        </section>
      )}

      {/* RabbitMQ queue table */}
      {queues.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">{t('monitoring.rabbitmqQueues')}</h2>
          <div className="bg-card border border-border rounded-lg overflow-x-auto shadow-sm">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">{t('monitoring.queue')}</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('monitoring.ready')}</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('monitoring.unacked')}</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('monitoring.total')}</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('monitoring.consumers')}</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('monitoring.publishRate')}</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('monitoring.deliverRate')}</th>
                </tr>
              </thead>
              <tbody>
                {queues.map((q) => (
                  <tr key={q.name} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-4 font-mono text-foreground">{q.name}</td>
                    <td className="text-right py-2 px-3 text-foreground">{formatNumber(q.messagesReady)}</td>
                    <td className={cn('text-right py-2 px-3', Number(q.messagesUnacked) > 0 ? 'text-amber-600 font-medium' : 'text-foreground')}>
                      {formatNumber(q.messagesUnacked)}
                    </td>
                    <td className={cn('text-right py-2 px-3', Number(q.messages) > 100 ? 'text-red-600 font-bold' : 'text-foreground')}>
                      {formatNumber(q.messages)}
                    </td>
                    <td className={cn('text-right py-2 px-3', Number(q.consumers) === 0 ? 'text-amber-500 font-medium' : 'text-foreground')}>
                      {formatNumber(q.consumers)}
                    </td>
                    <td className="text-right py-2 px-3 text-muted-foreground">{formatNumber(q.publishRate, 1)}</td>
                    <td className="text-right py-2 px-3 text-muted-foreground">{formatNumber(q.deliverRate, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Message pipeline — Outbox + DLQ */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">{t('monitoring.outboxPipeline')}</h2>

        {/* Outbox stats */}
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <HardDrive className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('monitoring.outbox')}</p>
              <p className="text-xs text-muted-foreground">{t('monitoring.outboxSubtitle')}</p>
            </div>
          </div>

          {outbox ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <OutboxStat label={t('monitoring.pending')} value={outbox.pending} warn={outbox.pending > 0} />
                <OutboxStat label={t('monitoring.failed')} value={outbox.failed} danger={outbox.failed > 0} />
                <OutboxStat label={t('monitoring.processed')} value={outbox.processed} />
              </div>
              {outbox.oldestPendingAt && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <Clock className="size-3" />
                  {t('monitoring.oldestPending')}: {formatDate(outbox.oldestPendingAt)}
                </p>
              )}
              {(outbox.recentFailed?.length ?? 0) > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    {t('monitoring.recentFailures')}
                  </p>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-xs min-w-[520px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">{t('monitoring.routingKey')}</th>
                          <th className="text-right py-1.5 px-3 font-medium text-muted-foreground">{t('monitoring.retryCount')}</th>
                          <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">{t('monitoring.lastError')}</th>
                          <th className="text-right py-1.5 px-3 font-medium text-muted-foreground">{t('monitoring.checkedAt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outbox.recentFailed!.map((ev) => (
                          <tr key={ev.id} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="py-1.5 px-3 font-mono text-foreground">{ev.routingKey}</td>
                            <td className="text-right py-1.5 px-3 text-red-600 font-semibold">{ev.retryCount}</td>
                            <td className="py-1.5 px-3 text-muted-foreground truncate max-w-[200px]">{ev.lastError ?? '—'}</td>
                            <td className="text-right py-1.5 px-3 text-muted-foreground">{formatDate(ev.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="size-3" />
                  {t('monitoring.noRecentFailures')}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t('monitoring.noData')}</p>
          )}
        </div>

        {/* DLQ */}
        <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors"
            onClick={() => setShowDlq((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <div className={cn('size-8 rounded-md flex items-center justify-center', dlqCount > 0 ? 'bg-red-100 text-red-600 dark:bg-red-950/30' : 'bg-muted text-muted-foreground')}>
                <MessageSquareX className="size-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">{t('monitoring.dlq')}</p>
                <p className="text-xs text-muted-foreground">
                  {dlqCount === 0
                    ? t('monitoring.dlqEmpty')
                    : t('monitoring.dlqCount', { count: dlqCount })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {dlqCount > 0 && (
                <span className="text-xs font-bold text-red-600 bg-red-100 dark:bg-red-950/30 px-2 py-0.5 rounded-full">
                  {dlqCount}
                </span>
              )}
              {showDlq ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </div>
          </button>

          {showDlq && (
            <div className="border-t border-border p-4">
              {dlqMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">{t('monitoring.dlqEmpty')}</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">{t('monitoring.routingKey')}</th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">{t('monitoring.originalQueue')}</th>
                        <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">{t('monitoring.deathReason')}</th>
                        <th className="text-right py-1.5 px-3 font-medium text-muted-foreground">{t('monitoring.checkedAt')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dlqMessages.map((msg, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-1.5 px-3 font-mono text-foreground">{msg.routingKey}</td>
                          <td className="py-1.5 px-3 font-mono text-muted-foreground">{msg.originalQueue}</td>
                          <td className="py-1.5 px-3 text-red-600">{msg.deathReason}</td>
                          <td className="text-right py-1.5 px-3 text-muted-foreground">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('tr-TR') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Prometheus metrics */}
      {metrics.length > 0 && (
        <section>
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3 hover:text-primary transition-colors"
            onClick={() => setShowMetrics((v) => !v)}
          >
            {t('monitoring.prometheusMetrics')} ({metrics.length})
            {showMetrics ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {showMetrics && (
            <div className="bg-card border border-border rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full text-xs font-mono min-w-[400px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">{t('monitoring.metric')}</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">{t('monitoring.value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-1.5 px-4 text-foreground">
                        {m.name}
                        {m.help && <span className="text-muted-foreground ml-2 font-sans text-[10px]">— {m.help}</span>}
                      </td>
                      <td className="text-right py-1.5 px-4 text-primary font-semibold">{m.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Endpoints */}
      {snapshot?.urls && (
        <section>
          <button
            type="button"
            className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3 hover:text-primary transition-colors"
            onClick={() => setShowEndpoints((v) => !v)}
          >
            {t('monitoring.endpoints')}
            {showEndpoints ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {showEndpoints && (
            <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
              <div className="grid sm:grid-cols-2 gap-1.5">
                {Object.entries(snapshot.urls).map(([key, url]) => (
                  <div key={key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground font-mono">{key}</span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate max-w-[240px] flex items-center gap-1"
                    >
                      {url}
                      <ExternalLink className="size-2.5 flex-shrink-0" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({
  icon,
  title,
  subtitle,
  state,
  status,
  checks,
  inlineCheck,
  secondaryCheck,
  uptime,
  details,
  extraLinks,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  state: 'ok' | 'warn' | 'down'
  status?: ServiceStatus | null
  checks?: Record<string, boolean>
  inlineCheck?: { label: string; ok: boolean }
  secondaryCheck?: { label: string; ok: boolean }
  uptime?: number
  details?: React.ReactNode
  extraLinks?: React.ReactNode
}) {
  const { t } = useI18n()
  const resolvedStatus = status?.status ?? (state === 'ok' ? 'ok' : state === 'warn' ? 'degraded' : 'error')

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <StatusDot state={state} />
              <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            </div>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          </div>
        </div>
        <StatusBadge status={resolvedStatus} />
      </div>

      {/* Checks from status.checks */}
      {checks && Object.keys(checks).length > 0 && (
        <div className="space-y-1">
          {Object.entries(checks).map(([k, v]) => (
            <CheckRow key={k} label={k} ok={v} />
          ))}
        </div>
      )}

      {/* Inline checks (derived from boolean fields) */}
      {inlineCheck && !checks && (
        <div className="space-y-1">
          <CheckRow label={inlineCheck.label} ok={inlineCheck.ok} />
          {secondaryCheck && <CheckRow label={secondaryCheck.label} ok={secondaryCheck.ok} />}
        </div>
      )}

      {/* Uptime */}
      {uptime !== undefined && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" />
          {t('monitoring.uptimeLabel')}: {formatUptime(uptime) ?? '—'}
        </p>
      )}

      {status?.error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
          {status.error}
        </p>
      )}

      {details}

      {extraLinks && <div className="pt-1 border-t border-border/50">{extraLinks}</div>}
    </div>
  )
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok
        ? <CheckCircle2 className="size-3.5 text-emerald-500 flex-shrink-0" />
        : <XCircle className="size-3.5 text-red-500 flex-shrink-0" />}
      <span className="text-muted-foreground capitalize">{label}</span>
    </div>
  )
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon?: React.ReactNode
  tone?: 'warn' | 'danger'
}) {
  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
      {icon && (
        <div className={cn(
          'size-8 rounded-md flex items-center justify-center flex-shrink-0',
          tone === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-950/30' :
          tone === 'warn' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/30' :
          'bg-primary/10 text-primary',
        )}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className={cn(
          'text-xl font-bold',
          tone === 'danger' ? 'text-red-600' :
          tone === 'warn' ? 'text-amber-600' :
          'text-foreground',
        )}>
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  )
}

// ─── Outbox Stat ──────────────────────────────────────────────────────────────

function OutboxStat({ label, value, warn, danger }: { label: string; value: number; warn?: boolean; danger?: boolean }) {
  return (
    <div className="bg-muted/30 rounded-md p-2.5 text-center">
      <p className={cn('text-lg font-bold', danger ? 'text-red-600' : warn ? 'text-amber-600' : 'text-foreground')}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

// ─── AI Runtime Details ───────────────────────────────────────────────────────

function AiRuntimeDetails({ ai }: { ai: ServiceStatus }) {
  const { t } = useI18n()
  const runtime = ai.runtime
  const runtimeOk = runtime?.status === 'ok'
  const runtimeUnreachable = runtime?.status === 'unreachable'
  const modelAvailable = runtime?.modelAvailable === true
  const fallbackAvailable = runtime?.fallbackModelAvailable === true

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Bot className={cn('size-3.5 flex-shrink-0', runtimeOk ? 'text-emerald-500' : runtimeUnreachable ? 'text-red-500 animate-pulse' : 'text-amber-500')} />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">{t('monitoring.qwenRuntime')}</p>
            <p className="truncate text-[11px] text-muted-foreground">{runtime?.baseUrl ?? '—'}</p>
          </div>
        </div>
        <StatusBadge status={runtime?.status ?? 'unknown'} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <RuntimeFact label="Provider" value={ai.provider ?? 'unknown'} />
        <RuntimeFact label="Latency" value={typeof runtime?.latencyMs === 'number' ? `${runtime.latencyMs} ms` : 'n/a'} />
        <RuntimeFact
          label={`Primary · ${runtime?.model ?? ai.model ?? '—'}`}
          value={modelAvailable ? 'loaded' : runtimeUnreachable ? 'unreachable' : 'not loaded'}
          tone={modelAvailable ? 'ok' : 'warn'}
        />
        <RuntimeFact
          label={`Fallback · ${runtime?.fallbackModel ?? 'llama3.2:1b'}`}
          value={fallbackAvailable ? 'loaded' : runtimeUnreachable ? 'unreachable' : 'not loaded'}
          tone={fallbackAvailable ? 'ok' : 'warn'}
        />
      </div>

      {runtimeUnreachable && (
        <div className="flex items-center gap-1.5 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
          <XCircle className="size-3.5 flex-shrink-0" />
          VM erişilemiyor — AI özellikleri devre dışı
        </div>
      )}

      {!runtimeUnreachable && !modelAvailable && fallbackAvailable && (
        <div className="flex items-center gap-1.5 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertCircle className="size-3.5 flex-shrink-0" />
          Primary model yüklü değil, fallback aktif
        </div>
      )}

      {!!runtime?.availableModels?.length && (
        <div className="flex flex-wrap gap-1">
          {runtime.availableModels.filter((m) => !m.endsWith(':cloud')).slice(0, 6).map((model) => (
            <span key={model} className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {model}
            </span>
          ))}
        </div>
      )}

      {!!runtime?.checkedEndpoints?.length && (
        <div className="space-y-1">
          {runtime.checkedEndpoints.map((ep) => (
            <div key={ep.baseUrl} className="flex items-center justify-between gap-2 rounded bg-background/80 px-2 py-1.5 text-[11px]">
              <span className="min-w-0 truncate text-muted-foreground">{ep.baseUrl}</span>
              <span className={cn('flex-shrink-0 font-medium', ep.status === 'ok' ? 'text-emerald-600' : 'text-red-600')}>
                {ep.status}{typeof ep.latencyMs === 'number' ? ` · ${ep.latencyMs} ms` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {runtime?.error && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 dark:bg-red-950/30">{runtime.error}</p>
      )}
    </div>
  )
}

function RuntimeFact({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded bg-background/80 px-2 py-1.5">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={cn('truncate font-medium', tone === 'ok' && 'text-emerald-600', tone === 'warn' && 'text-amber-600', !tone && 'text-foreground')}>
        {value}
      </p>
    </div>
  )
}
