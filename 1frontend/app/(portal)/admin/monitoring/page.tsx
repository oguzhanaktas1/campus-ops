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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ServiceStatus {
  status: 'ok' | 'ready' | 'not_ready' | 'unreachable' | 'error' | string
  service?: string
  error?: string
  checks?: Record<string, boolean>
  timestamp?: string
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

interface OutboxStats {
  pending: number
  failed: number
  processed: number
}

interface Snapshot {
  timestamp: string
  backend: ServiceStatus
  workers: ServiceStatus
  rabbitmq: any
  outbox: OutboxStats
  urls: {
    backendHealth: string
    backendReady: string
    workersHealth: string
    workersReady: string
    metrics: string
    rabbitmqMgmt: string
    prometheus: string
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOk(s: ServiceStatus) {
  return s.status === 'ok' || s.status === 'ready'
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'inline-block size-2.5 rounded-full flex-shrink-0',
        ok ? 'bg-emerald-500' : 'bg-red-500 animate-pulse',
      )}
    />
  )
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'ok' || status === 'ready'
  const warn = status === 'not_ready'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
        ok
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
          : warn
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
            : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
      )}
    >
      {ok ? <CheckCircle2 className="size-3" /> : warn ? <AlertCircle className="size-3" /> : <XCircle className="size-3" />}
      {status}
    </span>
  )
}

function formatTs(ts?: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
      // skip very long names or histogram buckets
      if (name.includes('{') && name.includes('le=')) continue
      result.push({ name, value, help: helpMap[name.split('{')[0]] })
    }
  }

  return result.slice(0, 40)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [queues, setQueues] = useState<QueueStats[]>([])
  const [metricsRaw, setMetricsRaw] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [showMetrics, setShowMetrics] = useState(false)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const token = localStorage.getItem('access_token')
    const headers = { Authorization: `Bearer ${token ?? ''}` }

    try {
      const [snapRes, queuesRes, metricsRes] = await Promise.allSettled([
        fetch(`${backendUrl}/admin/system/snapshot`, { headers }),
        fetch(`${backendUrl}/admin/system/rabbitmq/queues`, { headers }),
        fetch(`${backendUrl}/admin/system/workers/metrics/raw`, { headers }),
      ])

      if (snapRes.status === 'fulfilled' && snapRes.value.ok) {
        setSnapshot(await snapRes.value.json())
      }
      if (queuesRes.status === 'fulfilled' && queuesRes.value.ok) {
        setQueues(await queuesRes.value.json())
      }
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            System Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Backend · Worker · RabbitMQ · Prometheus — her 30 saniyede otomatik yenilenir.
          </p>
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
            Yenile
          </Button>
        </div>
      </div>

      {/* Service Cards */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Backend Health */}
        <ServiceCard
          icon={<Server className="size-4" />}
          title="Backend"
          subtitle="NestJS · port 5000"
          status={snapshot?.backend}
          extraLinks={
            snapshot?.urls && (
              <div className="flex gap-3 flex-wrap">
                <ExternalUrl label="/health" href={snapshot.urls.backendHealth} />
                <ExternalUrl label="/ready" href={snapshot.urls.backendReady} />
              </div>
            )
          }
        />

        {/* Python Workers */}
        <ServiceCard
          icon={<Cpu className="size-4" />}
          title="Python Workers"
          subtitle="FastAPI · port 8001"
          status={snapshot?.workers}
          extraLinks={
            snapshot?.urls && (
              <div className="flex gap-3 flex-wrap">
                <ExternalUrl label="/health" href={snapshot.urls.workersHealth} />
                <ExternalUrl label="/ready" href={snapshot.urls.workersReady} />
              </div>
            )
          }
        />

        {/* RabbitMQ */}
        <ServiceCard
          icon={<Radio className="size-4" />}
          title="RabbitMQ"
          subtitle="AMQP broker · Management UI"
          status={
            snapshot?.rabbitmq
              ? { status: snapshot.rabbitmq.error ? 'error' : 'ok', ...snapshot.rabbitmq }
              : undefined
          }
          extraLinks={
            snapshot?.urls && (
              <ExternalUrl label="Management UI" href={snapshot.urls.rabbitmqMgmt} />
            )
          }
        />

        {/* Outbox */}
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
              <Database className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Outbox</p>
              <p className="text-xs text-muted-foreground">Transactional message queue</p>
            </div>
          </div>
          {snapshot?.outbox ? (
            <div className="grid grid-cols-3 gap-2">
              <OutboxStat label="Pending" value={snapshot.outbox.pending} warn={snapshot.outbox.pending > 0} />
              <OutboxStat label="Failed" value={snapshot.outbox.failed} danger={snapshot.outbox.failed > 0} />
              <OutboxStat label="Processed" value={snapshot.outbox.processed} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Veri yok</p>
          )}
        </div>
      </div>

      {/* RabbitMQ Queues */}
      {queues.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">RabbitMQ Queues</h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-2 px-4 font-medium text-muted-foreground">Queue</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ready</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Unacked</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Consumers</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Pub/s</th>
                </tr>
              </thead>
              <tbody>
                {queues.map((q) => (
                  <tr key={q.name} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2 px-4 font-mono text-foreground">{q.name}</td>
                    <td className="text-right py-2 px-3 text-foreground">{q.messagesReady}</td>
                    <td className={cn('text-right py-2 px-3', q.messagesUnacked > 0 ? 'text-amber-600 font-medium' : 'text-foreground')}>
                      {q.messagesUnacked}
                    </td>
                    <td className={cn('text-right py-2 px-3', q.messages > 100 ? 'text-red-600 font-bold' : 'text-foreground')}>
                      {q.messages}
                    </td>
                    <td className="text-right py-2 px-3 text-foreground">{q.consumers}</td>
                    <td className="text-right py-2 px-3 text-muted-foreground">{q.publishRate.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Prometheus Metrics */}
      {metrics.length > 0 && (
        <section>
          <button
            className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3 hover:text-primary transition-colors"
            onClick={() => setShowMetrics((v) => !v)}
          >
            Prometheus Metrics ({metrics.length})
            {showMetrics ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>

          {showMetrics && (
            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-2 px-4 font-medium text-muted-foreground">Metric</th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">Value</th>
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

      {/* Direct URLs box */}
      {snapshot?.urls && (
        <section className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monitoring Endpoints (backend proxy)</p>
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
        </section>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ServiceCard({
  icon,
  title,
  subtitle,
  status,
  extraLinks,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  status?: ServiceStatus
  extraLinks?: React.ReactNode
}) {
  const ok = status ? isOk(status) : false
  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <StatusDot ok={ok} />
              <p className="text-sm font-semibold text-foreground">{title}</p>
            </div>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {status && <StatusBadge status={status.status} />}
      </div>

      {status?.checks && (
        <div className="space-y-1">
          {Object.entries(status.checks).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              {v ? (
                <CheckCircle2 className="size-3.5 text-emerald-500 flex-shrink-0" />
              ) : (
                <XCircle className="size-3.5 text-red-500 flex-shrink-0" />
              )}
              <span className="text-muted-foreground capitalize">{k}</span>
            </div>
          ))}
        </div>
      )}

      {status?.error && (
        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded px-2 py-1">
          {status.error}
        </p>
      )}

      {status?.timestamp && (
        <p className="text-[10px] text-muted-foreground">Checked at {formatTs(status.timestamp)}</p>
      )}

      {extraLinks && <div className="pt-1 border-t border-border/50">{extraLinks}</div>}
    </div>
  )
}

function OutboxStat({
  label,
  value,
  warn,
  danger,
}: {
  label: string
  value: number
  warn?: boolean
  danger?: boolean
}) {
  return (
    <div className="bg-muted/30 rounded-md p-2.5 text-center">
      <p
        className={cn(
          'text-lg font-bold',
          danger ? 'text-red-600' : warn ? 'text-amber-600' : 'text-foreground',
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}
