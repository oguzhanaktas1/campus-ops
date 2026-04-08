'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Bell, Info, CheckCircle2, AlertTriangle, XCircle, Loader2, CheckCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const typeConfig: Record<string, any> = {
  info:    { icon: Info,         className: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  success: { icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  warning: { icon: AlertTriangle,className: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  error:   { icon: XCircle,      className: 'text-destructive bg-destructive/10' },
  IN_APP:  { icon: Bell,         className: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' },
}

function formatRelative(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000 / 60
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

export default function AdminNotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
      toast.error('Failed to load notifications.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchNotifications() }, [])

  const toggleSelection = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])

  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.length === notifications.length ? [] : notifications.map((n) => n.id))

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
      toast.success(`${selectedIds.length} notifications deleted`)
    } catch {
      toast.error('Failed to delete notifications')
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
      if (res.ok) toast.success('All notifications marked as read.')
    } catch {
      toast.error('Failed to mark all as read.')
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length
  const isAllSelected = notifications.length > 0 && selectedIds.length === notifications.length

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} className="gap-2">
              <Trash2 className="size-4" /> Delete ({selectedIds.length})
            </Button>
          )}
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2 text-xs">
              <CheckCheck className="size-4" /> Mark all read
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
            <p className="text-sm font-medium">No notifications</p>
            <p className="text-xs text-muted-foreground mt-1">Admin alerts and updates will appear here.</p>
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
                {isAllSelected ? 'Deselect All' : 'Select All'}
              </span>
            </div>
            <div className="divide-y divide-border">
              {notifications.map((n) => {
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
    </div>
  )
}
