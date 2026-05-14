'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, Loader2, Box, Search, ChevronRight, ChevronLeft, DoorOpen, FlaskConical, Wrench, Car, LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

interface Resource {
  id: string
  name: string
  code: string
  resourceType: 'ROOM' | 'LAB' | 'EQUIPMENT' | 'VEHICLE' | 'OTHER'
  description?: string
  capacity?: number
  isActive: boolean
}

interface PagedResult {
  data: Resource[]
  total: number
  page: number
  totalPages: number
}

const PAGE_SIZE = 20
const RESOURCE_TYPES = ['ROOM', 'LAB', 'EQUIPMENT', 'VEHICLE', 'OTHER'] as const

const TYPE_BADGE: Record<string, string> = {
  ROOM:      'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  LAB:       'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
  EQUIPMENT: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  VEHICLE:   'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  OTHER:     'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700',
}


const TYPE_ICON: Record<string, React.ElementType> = {
  ROOM:      DoorOpen,
  LAB:       FlaskConical,
  EQUIPMENT: Wrench,
  VEHICLE:   Car,
  OTHER:     Box,
}

const EMPTY_FORM = {
  name: '',
  code: '',
  resourceType: 'ROOM' as Resource['resourceType'],
  description: '',
  capacity: '',
  isActive: true,
}

export default function AdminResourcesPage() {
  const { t } = useI18n()
  const [result, setResult] = useState<PagedResult>({ data: [], total: 0, page: 1, totalPages: 1 })
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({})
  const [statsLoading, setStatsLoading] = useState(true)

  const [showDialog, setShowDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<Resource | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout>>()
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const token = getToken()
      const allKeys = ['all', ...RESOURCE_TYPES]
      const results = await Promise.all(
        allKeys.map(type => {
          const params = new URLSearchParams({ page: '1', limit: '1' })
          if (type !== 'all') params.set('type', type)
          return fetch(`${backendUrl}/admin/resources?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => r.json())
        })
      )
      const counts: Record<string, number> = {}
      allKeys.forEach((key, i) => { counts[key] = results[i].total ?? 0 })
      setTypeCounts(counts)
    } catch {
      // stats are non-critical
    } finally {
      setStatsLoading(false)
    }
  }, [backendUrl])

  const load = useCallback(async (pg: number, q: string, type: string) => {
    setIsLoading(true)
    try {
      const token = getToken()
      const params = new URLSearchParams({ page: String(pg), limit: String(PAGE_SIZE) })
      if (q)            params.set('search', q)
      if (type !== 'all') params.set('type', type)
      const res = await fetch(`${backendUrl}/admin/resources?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      setResult(await res.json())
    } catch {
      toast.error(t('resources.saveFail'))
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl])

  useEffect(() => {
    load(1, '', 'all')
    loadStats()
  }, [load, loadStats])

  const handleSearch = (val: string) => {
    setSearch(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setPage(1)
      load(1, val, typeFilter)
    }, 400)
  }

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type)
    setPage(1)
    load(1, search, type)
  }

  const handlePageChange = (pg: number) => {
    setPage(pg)
    load(pg, search, typeFilter)
  }

  const openAdd = () => {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM })
    setShowDialog(true)
  }

  const openEdit = (r: Resource) => {
    setEditTarget(r)
    setForm({
      name: r.name,
      code: r.code,
      resourceType: r.resourceType,
      description: r.description || '',
      capacity: r.capacity?.toString() || '',
      isActive: r.isActive,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t('resources.saveFail'))
      return
    }
    setIsSaving(true)
    try {
      const token = getToken()
      const payload = { ...form, capacity: form.capacity ? parseInt(form.capacity) : undefined }
      const url    = editTarget ? `${backendUrl}/admin/resources/${editTarget.id}` : `${backendUrl}/admin/resources`
      const method = editTarget ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(t('resources.saveSuccess'))
      setShowDialog(false)
      load(page, search, typeFilter)
      loadStats()
    } catch {
      toast.error(t('resources.saveFail'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const token = getToken()
      const res = await fetch(`${backendUrl}/admin/resources/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      toast.success(t('resources.deleteSuccess'))
      // mevcut sayfada başka kayıt kalmadıysa önceki sayfaya dön
      const newTotal = result.total - 1
      const newTotalPages = Math.ceil(newTotal / PAGE_SIZE)
      const targetPage = page > newTotalPages && newTotalPages > 0 ? newTotalPages : page
      if (targetPage !== page) setPage(targetPage)
      load(targetPage, search, typeFilter)
      loadStats()
    } catch {
      toast.error(t('resources.deleteFail'))
    } finally {
      setDeletingId(null)
    }
  }

  const { data: resources, total, totalPages } = result
  const start = (page - 1) * PAGE_SIZE + 1
  const end   = Math.min(page * PAGE_SIZE, total)

  if (isLoading && resources.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">{t('resources.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      {/* Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-foreground">
              {editTarget ? t('resources.editResource') : t('resources.addResource')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('resources.name')} *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('resources.namePlaceholder')} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('resources.code')} *</label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder={t('resources.codePlaceholder')} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('resources.colType')}</label>
                <select
                  value={form.resourceType}
                  onChange={e => setForm(f => ({ ...f, resourceType: e.target.value as Resource['resourceType'] }))}
                  className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                  {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('resources.colCapacity')}</label>
                <Input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder={t('resources.capacityPlaceholder')} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t('common.description')}</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('resources.optionalDescription')} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded" />
                <label htmlFor="isActive" className="text-sm text-foreground">{t('common.active')}</label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={isSaving}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('resources.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('resources.subtitle', { count: total })}</p>
        </div>
        <Button onClick={openAdd} className="gap-2 self-start shrink-0">
          <Plus className="size-4" /> {t('resources.addResource')}
        </Button>
      </div>

      {/* Stats — total + per-type counts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total card */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-1 bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <LayoutGrid className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{t('common.total')}</p>
            <p className="text-2xl font-bold text-foreground leading-none mt-0.5">
              {statsLoading ? <span className="inline-block w-8 h-6 bg-muted animate-pulse rounded" /> : (typeCounts['all'] ?? 0)}
            </p>
          </div>
        </div>
        {/* Per-type cards */}
        {RESOURCE_TYPES.map(type => {
          const Icon = TYPE_ICON[type]
          const count = typeCounts[type] ?? 0
          const isActive = typeFilter === type
          return (
            <button
              key={type}
              onClick={() => handleTypeFilter(isActive ? 'all' : type)}
              className={cn(
                'bg-card border rounded-xl px-3 py-3 flex items-center gap-2.5 shadow-sm transition-all text-left',
                isActive
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:shadow-md'
              )}
            >
              <div className={cn('size-8 rounded-lg flex items-center justify-center shrink-0', TYPE_BADGE[type])}>
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate">{type}</p>
                <p className="text-xl font-bold text-foreground leading-none mt-0.5">
                  {statsLoading ? <span className="inline-block w-6 h-5 bg-muted animate-pulse rounded" /> : count}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t('resources.searchPlaceholder')}
              className="pl-9"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          {/* Result count badge */}
          <div className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
            typeFilter !== 'all' || search
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted/50 border-border text-muted-foreground'
          )}>
            {isLoading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <span className="font-bold text-base leading-none">{total}</span>
            }
            <span className="text-xs">
              {typeFilter !== 'all' ? `${typeFilter.charAt(0) + typeFilter.slice(1).toLowerCase()} resources` : search ? 'results' : 'resources total'}
            </span>
            {(typeFilter !== 'all' || search) && (
              <button
                onClick={() => {
                  setSearch('')
                  setTypeFilter('all')
                  setPage(1)
                  load(1, '', 'all')
                }}
                className="ml-1 text-muted-foreground hover:text-foreground text-xs font-normal"
              >
                ✕ clear
              </button>
            )}
          </div>
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleTypeFilter('all')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all',
              typeFilter === 'all'
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground'
            )}
          >
            <LayoutGrid className="size-3" />
            {t('common.all')}
            {!statsLoading && <span className="ml-0.5 opacity-70">({typeCounts['all'] ?? 0})</span>}
          </button>
          {RESOURCE_TYPES.map(type => {
            const Icon = TYPE_ICON[type]
            const isActive = typeFilter === type
            const chipActive: Record<string, string> = {
              ROOM:      'bg-blue-600 text-white border-blue-600',
              LAB:       'bg-purple-600 text-white border-purple-600',
              EQUIPMENT: 'bg-amber-500 text-white border-amber-500',
              VEHICLE:   'bg-emerald-600 text-white border-emerald-600',
              OTHER:     'bg-slate-600 text-white border-slate-600',
            }
            const chipIdle: Record<string, string> = {
              ROOM:      'hover:border-blue-400 hover:text-blue-600',
              LAB:       'hover:border-purple-400 hover:text-purple-600',
              EQUIPMENT: 'hover:border-amber-400 hover:text-amber-600',
              VEHICLE:   'hover:border-emerald-400 hover:text-emerald-600',
              OTHER:     'hover:border-slate-400 hover:text-slate-600',
            }
            return (
              <button
                key={type}
                onClick={() => handleTypeFilter(isActive ? 'all' : type)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all',
                  isActive
                    ? chipActive[type]
                    : cn('bg-background text-muted-foreground border-border', chipIdle[type])
                )}
              >
                <Icon className="size-3" />
                {type.charAt(0) + type.slice(1).toLowerCase()}
                {!statsLoading && (
                  <span className="ml-0.5 opacity-70">({typeCounts[type] ?? 0})</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-4 border-b border-border">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('resources.colName')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">{t('resources.colLocation')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('resources.colType')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">{t('resources.colCapacity')}</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">{t('resources.colStatus')}</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {resources.map(r => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Box className="size-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">{r.name}</p>
                        {r.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{r.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{r.code}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', TYPE_BADGE[r.resourceType])}>
                      {r.resourceType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-sm text-muted-foreground">{r.capacity ?? '—'}</td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className={cn(
                      'text-xs font-semibold px-2.5 py-1 rounded-full border',
                      r.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                        : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700'
                    )}>
                      {r.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/resources/${r.id}`}>
                        <Button variant="ghost" size="icon" className="size-8"><ChevronRight className="size-3.5" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(r)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                      >
                        {deletingId === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && resources.length === 0 && (
            <div className="text-center py-16">
              <Box className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">{t('resources.noResources')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="relative flex items-center justify-center text-sm">
          <p className="absolute left-0 text-muted-foreground">{t('resources.pageOf', { page, total: totalPages })}</p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm" className="gap-1"
              disabled={page <= 1 || isLoading}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="size-4" /> {t('common.prev')}
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = totalPages <= 7
                ? i + 1
                : page <= 4
                  ? i + 1
                  : page >= totalPages - 3
                    ? totalPages - 6 + i
                    : page - 3 + i
              if (pg < 1 || pg > totalPages) return null
              return (
                <Button
                  key={pg}
                  variant={pg === page ? 'default' : 'outline'}
                  size="sm" className="w-9"
                  disabled={isLoading}
                  onClick={() => handlePageChange(pg)}
                >
                  {pg}
                </Button>
              )
            })}
            <Button
              variant="outline" size="sm" className="gap-1"
              disabled={page >= totalPages || isLoading}
              onClick={() => handlePageChange(page + 1)}
            >
              {t('common.next')} <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
