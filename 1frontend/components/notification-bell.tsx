'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useOptionalT } from '@/lib/optional-t'
import { useRealtime } from '@/lib/providers/realtime-provider'

function timeAgo(ts: string, tt: (key: string, fallback: string, params?: Record<string, string | number>) => string) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return tt('time.justNow', 'just now')
  if (diff < 3600) return tt('time.minutesAgoShort', '{{count}}m ago', { count: Math.floor(diff / 60) })
  if (diff < 86400) return tt('time.hoursAgoShort', '{{count}}h ago', { count: Math.floor(diff / 3600) })
  return tt('time.daysAgoShort', '{{count}}d ago', { count: Math.floor(diff / 86400) })
}

const typeColors: Record<string, string> = {
  IN_APP: 'bg-blue-500',
  SYSTEM: 'bg-amber-500',
  EMAIL: 'bg-emerald-500',
}

interface NotificationBellProps {
  role?: 'student' | 'faculty' | 'staff' | 'admin' | string
}

export function NotificationBell({ role = 'student' }: NotificationBellProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const tt = useOptionalT()
  const { socket } = useRealtime()
  
  // 🔥 DİNAMİK ENDPOINT MANTIĞI 🔥
  // Gelen role göre otomatik url oluşturur: /staff/notifications, /admin/notifications vb.
  const getBaseUrl = () => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
    return `${backendUrl}/${role}/notifications`
  }

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) return

      const res = await fetch(getBaseUrl(), {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch (err) {
      console.error('Bildirimler çekilemedi:', err)
    }
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [role])

  useEffect(() => {
    if (!socket) return
    // Toast for the same event is handled globally by NotificationToastProvider —
    // here we only update the bell's local list so the unread count and dropdown
    // reflect the new notification in real time.
    const handler = (payload: any) => {
      const notif = payload?.data ?? payload
      setNotifications(prev => [{ ...notif, isRead: false }, ...prev])
    }
    // Re-fetch on reconnect to catch any missed notifications
    const onReconnect = () => { void fetchNotifications() }
    socket.on('notification.created', handler)
    socket.on('connected', onReconnect)
    return () => {
      socket.off('notification.created', handler)
      socket.off('connected', onReconnect)
    }
  }, [socket])

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation() 
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = (e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation()
    if (selectedIds.length === notifications.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(notifications.map(n => n.id))
    }
  }

  const handleDeleteSelected = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (selectedIds.length === 0) return

    try {
      const token = localStorage.getItem('access_token')
      
      const res = await fetch(getBaseUrl(), {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ ids: selectedIds })
      })
      
      if (res.ok) {
        setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)))
        setSelectedIds([])
      }
    } catch (err) {
      console.error('Silme hatası:', err)
    }
  }

  const handleMarkRead = async (notif: any) => {
    if (!notif.isRead) {
      try {
        const token = localStorage.getItem('access_token')
        await fetch(`${getBaseUrl()}/${notif.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })

        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n))
      } catch (err) {
        console.error('Okundu işaretlenirken hata:', err)
      }
    }

    if (notif.actionUrl) {
      router.push(notif.actionUrl)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${getBaseUrl()}/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      }
    } catch (err) {
      console.error('Tümü okundu işaretlenirken hata:', err)
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length
  const isAllSelected = notifications.length > 0 && selectedIds.length === notifications.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8" aria-label={tt('nav.notifications', 'Notifications')}>
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 size-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold">{tt('nav.notifications', 'Notifications')}</span>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 ? (
              <Button variant="destructive" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={handleDeleteSelected}>
                <Trash2 className="size-3" /> {tt('common.delete', 'Delete')} ({selectedIds.length})
              </Button>
            ) : (
              unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-auto py-0.5" onClick={handleMarkAllRead}>
                  {tt('common.markAllRead', 'Mark all read')}
                </Button>
              )
            )}
          </div>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={() => {}} 
              onClick={toggleSelectAll}
              className="size-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <span className="text-xs font-medium text-muted-foreground cursor-pointer select-none" onClick={toggleSelectAll}>
              {isAllSelected ? tt('common.deselectAll', 'Deselect All') : tt('common.selectAll', 'Select All')}
            </span>
          </div>
        )}

        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{tt('notifications.empty', 'No notifications')}</p>
          ) : (
            notifications.slice(0, 8).map((n) => (
              <div
                key={n.id}
                className={cn(
                  'w-full flex items-stretch transition-colors border-b border-border/50 last:border-0',
                  !n.isRead ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50'
                )}
              >
                <div className="pl-4 py-3 flex items-start justify-center cursor-default">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(n.id)}
                    onChange={() => {}} 
                    onClick={(e) => toggleSelection(e, n.id)}
                    className="size-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mt-1"
                  />
                </div>

                <button
                  className="flex-1 text-left flex gap-3 pr-4 pl-2 py-3 min-w-0"
                  onClick={() => handleMarkRead(n)}
                >
                  <div className={cn('size-2 rounded-full flex-shrink-0 mt-1.5', typeColors[n.type] || 'bg-primary')} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', !n.isRead ? 'text-foreground font-bold' : 'text-muted-foreground')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wider font-medium">
                      {timeAgo(n.createdAt, tt)}
                    </p>
                  </div>
                </button>
              </div>
            ))
          )}
        </ScrollArea>
        {notifications.length > 8 && (
          <div className="p-2 border-t border-border bg-muted/20">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs" 
              onClick={() => router.push(`/${role}/notifications`)}
            >
              {tt('notifications.viewAll', 'View all notifications')}
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
