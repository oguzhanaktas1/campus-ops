'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Bell, Loader2, CheckCheck, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { formatStudentTimeAgo } from '@/lib/student-i18n-utils'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20

const typeColors: Record<string, string> = {
  IN_APP: 'bg-blue-500',
  SYSTEM: 'bg-amber-500',
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const router = useRouter()
  const { t } = useI18n()

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${BACKEND}/student/notifications`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const d = await res.json()
        setNotifications(Array.isArray(d) ? d : (d.notifications ?? []))
      }
    } catch {
      toast.error(t('messages.loadNotificationsFail'))
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
      const res = await fetch(`${BACKEND}/student/notifications`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ids: selectedIds }),
      })
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => !selectedIds.includes(n.id)))
        setSelectedIds([])
        setPage(1)
        toast.success(t('messages.notificationsDeleted', { count: selectedIds.length }))
      } else {
        throw new Error('Failed')
      }
    } catch {
      toast.error(t('messages.deleteNotificationsFail'))
    }
  }

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.isRead) {
        await fetch(`${BACKEND}/student/notifications/${notif.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, isRead: true } : n))
      }
      if (notif.actionUrl) router.push(notif.actionUrl)
    } catch {
      console.error('Failed to handle notification click')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch(`${BACKEND}/student/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        toast.success(t('messages.allNotificationsRead'))
      }
    } catch {
      toast.error(t('messages.markAllReadFail'))
    }
  }

  if (isLoading) return (
    <div className="h-[60vh] flex items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.notificationsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.notificationsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2 shadow-sm animate-in fade-in zoom-in duration-200">
              <Trash2 className="size-4" /> {t('common.delete')} ({selectedIds.length})
            </Button>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2">
              <CheckCheck className="size-4" /> {t('messages.allNotificationsRead')}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
            <Bell className="size-10 mb-3" />
            <p className="text-sm font-medium">{t('pages.allCaughtUpTitle')}</p>
            <p className="text-xs">{t('pages.noNotifications')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/20">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-sm font-medium text-muted-foreground cursor-pointer select-none" onClick={toggleSelectAll}>
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, notifications.length)} / {notifications.length}
              </span>
            </div>
            <div className="divide-y divide-border">
              {paged.map((n) => (
                <div key={n.id} className={cn('w-full flex items-stretch transition-colors', !n.isRead ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50')}>
                  <div className="pl-5 py-4 flex items-start justify-center cursor-default">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(n.id)}
                      onChange={() => toggleSelection(n.id)}
                      className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mt-0.5"
                    />
                  </div>
                  <div onClick={() => handleNotificationClick(n)} className="flex-1 flex gap-3 pr-5 py-4 cursor-pointer min-w-0">
                    <div className={cn('size-2.5 rounded-full flex-shrink-0 mt-1.5', typeColors[n.type] || 'bg-primary')} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-bold', !n.isRead ? 'text-foreground' : 'text-muted-foreground')}>
                        {n.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed whitespace-pre-wrap">{n.message}</p>
                      <p className="text-xs text-muted-foreground/70 mt-1 uppercase tracking-wider font-medium">{formatStudentTimeAgo(n.createdAt, t)}</p>
                    </div>
                    {!n.isRead && <div className="size-2 rounded-full bg-primary flex-shrink-0 mt-2 animate-pulse" />}
                  </div>
                </div>
              ))}
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
