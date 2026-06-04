'use client'

/**
 * NotificationToastProvider
 *
 * Listens to the realtime socket for `notification.created` events and shows
 * a bottom-right in-app toast for every new notification while the user is
 * actively on the site. The toast carries a "Bildirime Git" action button
 * that navigates to either:
 *   - the notification's `actionUrl` if the backend provided one (e.g. a
 *     direct link to the originating request), or
 *   - `/{role}/notifications`, the notifications page for the portal the
 *     user is currently inside (detected from the URL pathname).
 *
 * Mount this provider INSIDE `RealtimeProvider` in each portal layout so the
 * socket context is available. It renders no UI of its own.
 */

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useRealtime } from '@/lib/providers/realtime-provider'
import { useOptionalI18n } from '@/lib/i18n'

type PortalRole = 'student' | 'faculty' | 'staff' | 'admin' | 'organizer'

const PORTAL_PREFIXES: PortalRole[] = ['student', 'faculty', 'staff', 'admin', 'organizer']

function detectPortalFromPathname(pathname: string | null): PortalRole | null {
  if (!pathname) return null
  const first = pathname.split('/').filter(Boolean)[0] as PortalRole | undefined
  return first && PORTAL_PREFIXES.includes(first) ? first : null
}

interface NotificationPayload {
  id?: string
  title?: string
  message?: string
  actionUrl?: string | null
  type?: string
  priority?: string
}

export function NotificationToastProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useRealtime()
  const router = useRouter()
  const pathname = usePathname()
  const i18n = useOptionalI18n()

  const tt = (key: string, fallback: string): string => {
    if (!i18n) return fallback
    const v = i18n.t(key)
    return v === key ? fallback : v
  }

  // Keep latest pathname / i18n in refs so the socket handler reads fresh values
  // without re-subscribing on every navigation.
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const ttRef = useRef(tt)
  ttRef.current = tt

  useEffect(() => {
    if (!socket) return

    const handler = (payload: NotificationPayload | { data?: NotificationPayload }) => {
      // Backend may send the notification directly or wrapped in { data }.
      const notif: NotificationPayload =
        (payload && typeof payload === 'object' && 'data' in payload && payload.data)
          ? (payload.data as NotificationPayload)
          : (payload as NotificationPayload)

      if (!notif || !notif.title) return

      const currentPath = pathnameRef.current
      // Suppress the toast when the user is already on the notifications page —
      // the toast would be redundant with the live list.
      if (currentPath && currentPath.endsWith('/notifications')) return

      const role = detectPortalFromPathname(currentPath)
      const notificationsHref = role ? `/${role}/notifications` : null
      const navigateHref = notif.actionUrl || notificationsHref || null

      toast(notif.title, {
        description: notif.message,
        duration: 6000,
        action: navigateHref
          ? {
              label: ttRef.current('notifications.goToNotification', 'Bildirime Git'),
              onClick: () => {
                router.push(navigateHref)
              },
            }
          : undefined,
      })
    }

    socket.on('notification.created', handler)
    return () => {
      socket.off('notification.created', handler)
    }
  }, [socket, router])

  return <>{children}</>
}
