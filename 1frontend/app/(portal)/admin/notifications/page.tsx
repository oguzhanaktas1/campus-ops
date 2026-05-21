'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Bell, Info, CheckCircle2, AlertTriangle, XCircle, Loader2, CheckCheck, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20

const typeConfig: Record<string, any> = {
  info:    { icon: Info,          className: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  success: { icon: CheckCircle2,  className: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  warning: { icon: AlertTriangle, className: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  error:   { icon: XCircle,       className: 'text-destructive bg-destructive/10' },
  IN_APP:  { icon: Bell,          className: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
}

function formatRelative(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000 / 60
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export default function AdminNotificationsPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${BACKEND}/notifications`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const d = await res.json()
        setNotifications(Array.isArray(d) ? d : (d.notifications ?? []))
      }
    } catch {
      toast.error(t('notifications.loadFail'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchNotifications() }, [])

  const totalPages = Math.ceil(notifications.length / PAGE_SIZE)
  const paged = notifications.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const isAllSelected = paged.length > 0 && paged.every((n) => selectedIds.includes(n.id))

  const toggleSelection = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])

  const toggleSelectAll = () =>
    setSelectedIds(isAllSelected
      ? selectedIds.filter((id) => !paged.some((n) => n.id === id))
      : [...new Set([...selectedIds, ...paged.map((n) => n.id)])]
    )

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    try {
      const res = await fetch(`${BACKEND}/notifications`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ids: selectedIds }),
      })
      if (!res.ok) throw new Error()
      setNotifications((prev) => prev.filter((n) => !selectedIds.includes(n.id)))
      setSelectedIds([])
      setPage(1)
      toast.success(t('notifications.deleteSuccess', { count: selectedIds.length }))
    } catch {
      toast.error(t('notifications.deleteFail'))
    }
  }

  const handleMarkRead = async (id: string, actionUrl?: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
    try {
      await fetch(`${BACKEND}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
    } catch {
      console.error('Failed to mark notification as read')
    }
    if (actionUrl) router.push(actionUrl)
  }

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    try {
      const res = await fetch(`${BACKEND}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) toast.success(t('notifications.markAllSuccess'))
    } catch {
      toast.error(t('notifications.markAllFail'))
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('notifications.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('notifications.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2">
              <Trash2 className="size-4" /> {t('notifications.deleteSelected', { count: selectedIds.length })}
            </Button>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2 text-xs">
              <CheckCheck className="size-4" /> {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center opacity-50">
            <Bell className="size-8 mb-3" />
            <p className="text-sm font-medium">{t('notifications.noNotifications')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('notifications.emptyHint')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/20">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="size-4 rounded border-gray-300 cursor-pointer"
              />
              <span className="text-sm font-medium text-muted-foreground cursor-pointer select-none" onClick={toggleSelectAll}>
                {isAllSelected ? t('notifications.deselectAll') : t('notifications.selectAll')}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, notifications.length)} / {notifications.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {paged.map((n) => {
                const cfg = typeConfig[n.type?.toLowerCase()] ?? typeConfig['IN_APP'] ?? typeConfig['info']
                const Icon = cfg.icon
                return (
                  <div key={n.id} className={cn('w-full flex items-stretch transition-colors', !n.isRead ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50')}>
                    <div className="pl-5 py-4 flex items-start cursor-default">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(n.id)}
                        onChange={() => toggleSelection(n.id)}
                        className="size-4 rounded border-gray-300 cursor-pointer mt-0.5"
                      />
                    </div>
                    <button
                      onClick={() => handleMarkRead(n.id, n.actionUrl)}
                      className="flex-1 flex items-start gap-3 px-4 py-4 text-left"
                    >
                      <div className={cn('size-8 rounded-full flex items-center justify-center shrink-0', cfg.className)}>
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm text-foreground', !n.isRead && 'font-semibold')}>{n.title}</p>
                          {!n.isRead && <span className="size-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatRelative(n.createdAt)}</p>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <Button variant="outline" size="icon" className="size-8"
            disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === '...' ? (
              <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground select-none">…</span>
            ) : (
              <Button key={p} variant={page === p ? 'default' : 'outline'}
                size="icon" className="size-8 text-xs"
                onClick={() => setPage(p as number)}>
                {p}
              </Button>
            )
          )}
          <Button variant="outline" size="icon" className="size-8"
            disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
