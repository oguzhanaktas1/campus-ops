'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Loader2, Bell, CheckCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

function timeAgo(ts: string) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function FacultyNotificationsPage() {
  const { t } = useI18n()
  const [notifications, setNotifications] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const fetchNotifications = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/notifications`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      })
      if (res.ok) { const d = await res.json(); setNotifications(Array.isArray(d) ? d : (d.notifications ?? [])); }
    } catch (err) {
      toast.error(t('common.loading'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === notifications.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(notifications.map(n => n.id))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

      const res = await fetch(`${backendUrl}/notifications`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ ids: selectedIds })
      })

      if (res.ok) {
        setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)))
        setSelectedIds([])
        toast.success(t('notifications.deleted', { count: selectedIds.length }))
      } else {
        throw new Error(t('notifications.deleteFail'))
      }
    } catch (err) {
      toast.error(t('notifications.deleteFail'))
    }
  }

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.isRead) {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        await fetch(`${backendUrl}/notifications/${notif.id}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${getToken()}` }
        })

        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n))
      }

      if (notif.actionUrl) {
        router.push(notif.actionUrl)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` }
      })

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        toast.success(t('notifications.allRead'))
      }
    } catch (err) {
      toast.error(t('notifications.markAllReadFail'))
    }
  }

  if (isLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>

  const unreadCount = notifications.filter(n => !n.isRead).length
  const isAllSelected = notifications.length > 0 && selectedIds.length === notifications.length

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="size-6 text-primary" /> {t('notifications.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('notifications.subtitle', { count: unreadCount })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2 shadow-sm animate-in fade-in zoom-in duration-200">
              <Trash2 className="size-4" /> Delete ({selectedIds.length})
            </Button>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2 shrink-0 shadow-sm">
              <CheckCheck className="size-4" /> {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">

        {notifications.length > 0 && (
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
          </div>
        )}

        <div className="divide-y divide-border">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                'w-full flex items-stretch transition-colors',
                !n.isRead ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
              )}
            >
              <div className="pl-5 py-4 flex items-start justify-center cursor-default">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(n.id)}
                  onChange={() => toggleSelection(n.id)}
                  className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mt-0.5"
                />
              </div>

              <div
                onClick={() => handleNotificationClick(n)}
                className="flex-1 flex gap-4 pr-5 py-4 cursor-pointer min-w-0"
              >
                <div className="mt-1 shrink-0">
                  <div className={cn(
                    "size-2.5 rounded-full",
                    !n.isRead ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.6)] animate-pulse" : "bg-muted-foreground/30"
                  )} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p className={cn('text-sm font-semibold truncate', !n.isRead ? 'text-foreground' : 'text-muted-foreground')}>
                      {n.title}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap mt-0.5 uppercase tracking-wider">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  <p className={cn('text-sm mt-1 leading-relaxed', !n.isRead ? 'text-foreground/90' : 'text-muted-foreground')}>
                    {n.message}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
              <Bell className="size-10 mb-3" />
              <p className="text-sm font-medium">{t('notifications.noNotifications')}</p>
              <p className="text-xs">{t('notifications.noNotifications')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
