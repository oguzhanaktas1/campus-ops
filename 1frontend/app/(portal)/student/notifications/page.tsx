'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Bell, Loader2, CheckCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { formatStudentTimeAgo } from '@/lib/student-i18n-utils'

const typeColors: Record<string, string> = {
  IN_APP: 'bg-blue-500',
  SYSTEM: 'bg-amber-500',
}

export default function StudentNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([]) // 🔥 Seçili bildirimlerin state'i
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { t } = useI18n()

  const fetchNotifications = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/student/notifications`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      })
      if (res.ok) { const d = await res.json(); setNotifications(Array.isArray(d) ? d : (d.notifications ?? [])); }
    } catch (err) {
      toast.error(t('messages.loadNotificationsFail'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  // 🔥 CHECKBOX SEÇİM MANTIĞI 🔥
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // 🔥 TÜMÜNÜ SEÇ / BIRAK MANTIĞI 🔥
  const toggleSelectAll = () => {
    if (selectedIds.length === notifications.length) {
      setSelectedIds([]) // Hepsi seçiliyse bırak
    } else {
      setSelectedIds(notifications.map(n => n.id)) // Değilse hepsini seç
    }
  }

  // 🔥 SEÇİLİ OLANLARI SİLME (BACKEND'E İSTEK) 🔥
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

      const res = await fetch(`${backendUrl}/student/notifications`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ ids: selectedIds })
      })
      
      if (res.ok) {
        // Silinenleri ekrandan uçur ve seçimi temizle
        setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)))
        setSelectedIds([])
        toast.success(t('messages.notificationsDeleted', { count: selectedIds.length }))
      } else {
        throw new Error('Failed')
      }
    } catch (err) {
      toast.error(t('messages.deleteNotificationsFail'))
    }
  }

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.isRead) {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        await fetch(`${backendUrl}/student/notifications/${notif.id}/read`, {
          method: 'POST',
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
      const res = await fetch(`${backendUrl}/student/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` }
      })
      
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        toast.success(t('messages.allNotificationsRead'))
      }
    } catch (err) {
      toast.error(t('messages.markAllReadFail'))
    }
  }

  if (isLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>

  const unreadCount = notifications.filter(n => !n.isRead).length
  const isAllSelected = notifications.length > 0 && selectedIds.length === notifications.length

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
             {t('pages.notificationsTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.notificationsSubtitle')}</p>
        </div>
        
        {/* 🔥 ÜST AKSİYON BUTONLARI 🔥 */}
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
        
        {/* 🔥 TÜMÜNÜ SEÇ BAR'I 🔥 */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/20">
            <input 
              type="checkbox" 
              checked={isAllSelected}
              onChange={toggleSelectAll}
              className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <span className="text-sm font-medium text-muted-foreground cursor-pointer select-none" onClick={toggleSelectAll}>
              {isAllSelected ? (t('common.all') === 'All' ? 'Deselect All' : 'Secimi Kaldir') : (t('common.all') === 'All' ? 'Select All' : 'Tumunu Sec')}
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
              {/* 🔥 KUTUCUK ALANI (Tıklama yayılmasını engelliyoruz) 🔥 */}
              <div className="pl-5 py-4 flex items-start justify-center cursor-default">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(n.id)}
                  onChange={() => toggleSelection(n.id)}
                  className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer mt-0.5"
                />
              </div>

              {/* BİLDİRİMİN İÇERİĞİ VE TIKLANABİLİR ALANI */}
              <div 
                onClick={() => handleNotificationClick(n)}
                className="flex-1 flex gap-3 pr-5 py-4 cursor-pointer min-w-0"
              >
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

          {notifications.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
              <Bell className="size-10 mb-3" />
              <p className="text-sm font-medium">{t('pages.allCaughtUpTitle')}</p>
              <p className="text-xs">{t('pages.noNotifications')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
