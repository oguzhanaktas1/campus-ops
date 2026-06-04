'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  onSessionExpired,
  resetSessionExpiry,
  triggerSessionExpired,
} from '@/lib/session-expiry'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const SESSION_SENTINEL = 'cookie-session'

// 1 hour of no user interaction signs the user out.
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000

// Activity events that count as "user is still here".
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
  'click',
  'focus',
] as const

// Paths that should NOT be guarded — visiting them doesn't require a session
// and we don't want to redirect away from them on expiry.
const PUBLIC_PATH_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/',
]

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return true
  if (pathname === '/') return true
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => prefix !== '/' && pathname.startsWith(prefix),
  )
}

function isBackendRequest(input: RequestInfo | URL) {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

  return url.startsWith(BACKEND)
}

function isAuthEndpoint(input: RequestInfo | URL) {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

  // Login / register / refresh / password-reset endpoints return 401 by design
  // when credentials are wrong — they shouldn't trigger the global expiry flow.
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/reset-password')
  )
}

export function AuthFetchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // ── 1. Patch window.fetch to send cookies + intercept 401 globally ───────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).__campusflowFetchPatched) return

    const originalFetch = window.fetch.bind(window)
    ;(window as any).__campusflowFetchPatched = true

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!isBackendRequest(input)) {
        return originalFetch(input, init)
      }

      const nextInit: RequestInit = {
        ...init,
        credentials: 'include',
      }

      const request = input instanceof Request ? input : null
      const headers = new Headers(init?.headers ?? request?.headers ?? undefined)
      const authHeader = headers.get('Authorization')

      if (authHeader === `Bearer ${SESSION_SENTINEL}`) {
        headers.delete('Authorization')
      }

      nextInit.headers = headers

      const response = await originalFetch(input, nextInit)

      // Global 401 interceptor: any backend call returning 401 on a non-auth
      // endpoint means our session is gone — trigger the expiry flow once.
      if (response.status === 401 && !isAuthEndpoint(input)) {
        triggerSessionExpired('unauthorized')
      }

      return response
    }
  }, [])

  // ── 2. Listen for session-expired events and navigate the user away ──────
  useEffect(() => {
    return onSessionExpired(() => {
      // Don't redirect if user is already on a public page.
      if (isPublicPath(window.location.pathname)) return
      router.replace('/login')
    })
  }, [router])

  // ── 3. Clear the session-expiry guard when entering the login page so a
  //      future session can correctly trigger the flow again.
  useEffect(() => {
    if (pathname && pathname.startsWith('/login')) {
      resetSessionExpiry()
    }
  }, [pathname])

  // ── 4. Inactivity tracker: 1 hour of no input → session expired. Disabled
  //      on public pages so just sitting on /login forever doesn't trigger
  //      the toast.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isPublicPath(pathname)) return

    let timer: ReturnType<typeof setTimeout> | null = null

    const reset = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        triggerSessionExpired('inactivity')
      }, INACTIVITY_TIMEOUT_MS)
    }

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, reset, { passive: true }),
    )
    // Also reset when the tab regains focus (user returned from another tab).
    const onVisible = () => {
      if (document.visibilityState === 'visible') reset()
    }
    document.addEventListener('visibilitychange', onVisible)

    reset()

    return () => {
      if (timer) clearTimeout(timer)
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, reset))
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pathname])

  return <>{children}</>
}
