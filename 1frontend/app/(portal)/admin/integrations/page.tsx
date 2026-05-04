'use client'

import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Plug,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Loader2,
  Plus,
  X,
  ToggleLeft,
  ToggleRight,
  Zap,
} from 'lucide-react'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

interface Integration {
  id: string
  key: string
  name: string
  provider: string
  isActive: boolean
  updatedAt: string
  createdAt: string
}

function formatDate(d: string | null) {
  if (!d) return 'Never'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PROVIDER_ICONS: Record<string, string> = {
  n8n: '⚡',
  slack: '💬',
  webhook: '🔗',
  email: '✉️',
  sms: '📱',
  github: '🐙',
  jira: '🎯',
  other: '🔌',
}

function ProviderIcon({ provider }: { provider: string }) {
  const emoji = PROVIDER_ICONS[provider.toLowerCase()] ?? PROVIDER_ICONS.other
  return <span className="text-lg leading-none">{emoji}</span>
}

interface CreateModalProps {
  onClose: () => void
  onCreated: (integration: Integration) => void
  backendUrl: string
  token: string
}

function CreateIntegrationModal({ onClose, onCreated, backendUrl, token }: CreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState({ name: '', provider: 'webhook', key: '', webhookUrl: '' })
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.provider.trim()) return
    setIsSaving(true)
    try {
      const res = await fetch(`${backendUrl}/admin/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          provider: form.provider.trim().toLowerCase(),
          key: form.key.trim() || form.name.trim().toUpperCase().replace(/\s+/g, '_'),
          webhookUrl: form.webhookUrl.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).message || 'Failed to create integration')
      }
      const created = await res.json()
      toast.success(`Integration "${created.name}" created.`)
      onCreated(created)
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create integration.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Plug className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t('integrations.newIntegration')}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('common.name')} *</label>
            <Input
              placeholder={t('integrations.namePlaceholder')}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('integrations.provider')} *</label>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.provider}
              onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
            >
              {['webhook', 'n8n', 'slack', 'email', 'sms', 'github', 'jira', 'other'].map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('integrations.key')} <span className="normal-case text-[11px] text-muted-foreground">({t('integrations.autoGeneratedIfEmpty')})</span>
            </label>
            <Input
              placeholder={t('integrations.keyPlaceholder')}
              value={form.key}
              onChange={e => setForm(f => ({ ...f, key: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('integrations.webhookUrl')} <span className="normal-case text-[11px] text-muted-foreground">({t('common.optional')})</span>
            </label>
            <Input
              type="url"
              placeholder="https://hooks.example.com/..."
              value={form.webhookUrl}
              onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={isSaving || !form.name.trim()}>
              {isSaving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Plus className="size-3.5 mr-1.5" />}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminIntegrationsPage() {
  const { t } = useI18n()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
  const token = getToken() ?? ''

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/admin/integrations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setIntegrations(await res.json())
    } catch {
      toast.error(t('integrations.loadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl, token])

  useEffect(() => { void fetchIntegrations() }, [fetchIntegrations])

  const handleSync = async (id: string, name: string) => {
    setSyncing(id)
    try {
      const res = await fetch(`${backendUrl}/admin/integrations/${id}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        toast.success(t('integrations.syncSuccess', { name, ms: data.responseTime }))
      } else {
        toast.error(t('integrations.syncFail', { name, error: data.error ?? `HTTP ${data.statusCode}` }))
      }
      // Refresh to get updated updatedAt
      await fetchIntegrations()
    } catch {
      toast.error(t('integrations.syncRequestFail'))
    } finally {
      setSyncing(null)
    }
  }

  const handleToggle = async (id: string, currentlyActive: boolean) => {
    setToggling(id)
    try {
      const res = await fetch(`${backendUrl}/admin/integrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !currentlyActive }),
      })
      if (!res.ok) throw new Error()
      setIntegrations(prev =>
        prev.map(i => i.id === id ? { ...i, isActive: !currentlyActive } : i)
      )
      toast.success(!currentlyActive ? t('integrations.enabledToast') : t('integrations.disabledToast'))
    } catch {
      toast.error(t('integrations.updateFail'))
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('integrations.deleteConfirm', { name }))) return
    setDeleting(id)
    try {
      const res = await fetch(`${backendUrl}/admin/integrations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setIntegrations(prev => prev.filter(i => i.id !== id))
      toast.success(t('integrations.deleteSuccess', { name }))
    } catch {
      toast.error(t('integrations.deleteFail'))
    } finally {
      setDeleting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const active = integrations.filter(i => i.isActive).length
  const inactive = integrations.filter(i => !i.isActive).length

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 pb-20">
      {showCreate && (
        <CreateIntegrationModal
          backendUrl={backendUrl}
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={created => setIntegrations(prev => [created, ...prev])}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('integrations.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('integrations.subtitle')}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="size-3.5" />
          {t('integrations.addIntegration')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: integrations.length, color: '' },
          { label: 'Active', value: active, color: 'text-emerald-600' },
          { label: 'Inactive', value: inactive, color: inactive > 0 ? 'text-amber-600' : '' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 text-center shadow-sm">
            <p className={cn('text-2xl font-bold text-foreground', color)}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {integrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-20 text-center">
          <Plug className="mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">{t('integrations.noIntegrations')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('integrations.emptyHint')}</p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="size-3.5" /> {t('integrations.addIntegration')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {integrations.map((int) => {
            const isSyncing = syncing === int.id
            const isToggling = toggling === int.id
            const isDeleting = deleting === int.id
            const isBusy = isSyncing || isToggling || isDeleting
            return (
              <div
                key={int.id}
                className={cn(
                  'rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 transition-opacity',
                  isBusy && 'opacity-70'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ProviderIcon provider={int.provider} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{int.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{int.provider}</p>
                      <p className="text-[11px] text-muted-foreground">Updated {formatDate(int.updatedAt)}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium',
                    int.isActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                      : 'border-border bg-muted text-muted-foreground'
                  )}>
                    {int.isActive ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                    {int.isActive ? t('common.status') : t('common.status')}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 flex-1 gap-1 text-xs"
                    onClick={() => void handleSync(int.id, int.name)}
                    disabled={isBusy}
                  >
                    {isSyncing
                      ? <Loader2 className="size-3 animate-spin" />
                      : <Zap className="size-3" />}
                    {isSyncing ? t('integrations.syncing') : t('integrations.syncNow')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => void handleToggle(int.id, int.isActive)}
                    disabled={isBusy}
                    title={int.isActive ? t('common.disable') : t('common.enable')}
                  >
                    {isToggling
                      ? <Loader2 className="size-3 animate-spin" />
                      : int.isActive
                        ? <ToggleRight className="size-3.5 text-emerald-600" />
                        : <ToggleLeft className="size-3.5" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs text-red-600 hover:text-red-700 hover:border-red-300"
                    onClick={() => void handleDelete(int.id, int.name)}
                    disabled={isBusy}
                    title={t('common.delete')}
                  >
                    {isDeleting
                      ? <Loader2 className="size-3 animate-spin" />
                      : <Trash2 className="size-3" />}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => void fetchIntegrations()}>
          <RefreshCw className="size-3.5" /> {t('common.refresh')}
        </Button>
      </div>
    </div>
  )
}
