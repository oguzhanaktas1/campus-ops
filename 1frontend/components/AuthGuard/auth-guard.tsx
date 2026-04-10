'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getToken, isTokenExpired } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const CHECK_INTERVAL_MS = 60 * 1000

const STATUS_MESSAGES: Record<string, string> = {
  SUSPENDED: 'Your account has been suspended. Please contact the administrator.',
  PENDING:   'Your account is pending approval. Please wait for activation.',
  INACTIVE:  'Your account is inactive. Please contact support.',
}

interface AuthGuardProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  // İlk yükleme tamamlandı mı? Sonraki gezinmelerde spinner gösterme.
  const hasInitialized = useRef(false)

  const evict = useCallback((message?: string) => {
    if (message) toast.error(message)
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    hasInitialized.current = false
    router.replace('/login')
  }, [router])

  const verify = useCallback(async (): Promise<boolean> => {
    const token = getToken()
    if (!token) { evict(); return false }

    // Token süresi dolmuşsa backend'e gitmeden çıkış yap
    if (isTokenExpired(token)) {
      evict('Your session has expired. Please log in again.')
      return false
    }

    let profile: any
    try {
      const res = await fetch(`${BACKEND}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) { evict('Your session has expired. Please log in again.'); return false }
      if (!res.ok) return false
      profile = await res.json()
    } catch {
      return false
    }

    const status: string = (profile?.status ?? '').toUpperCase()
    if (status && status !== 'ACTIVE') {
      evict(STATUS_MESSAGES[status] ?? `Account status: ${status}. Please contact support.`)
      return false
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const userRole: string = (
        profile?.role || profile?.primaryRoles?.[0]?.role?.name || ''
      ).toUpperCase()
      if (!userRole || !allowedRoles.includes(userRole)) {
        router.replace(userRole ? `/${userRole.toLowerCase()}/dashboard` : '/login')
        return false
      }
    }

    try { localStorage.setItem('user', JSON.stringify(profile)) } catch { /**/ }
    return true
  }, [allowedRoles, evict, router])

  useEffect(() => {
    const token   = getToken()
    const userStr = localStorage.getItem('user')

    // Token yoksa anında çıkar
    if (!token || !userStr) { evict(); return }

    // Token süresi dolmuşsa anında çıkar
    if (isTokenExpired(token)) { evict('Your session has expired. Please log in again.'); return }

    // Hızlı yerel rol kontrolü
    if (allowedRoles && allowedRoles.length > 0) {
      try {
        const user = JSON.parse(userStr)
        const userRole = (user.role || user.primaryRoles?.[0]?.role?.name || '').toUpperCase()
        if (userRole && !allowedRoles.includes(userRole)) {
          router.replace(`/${userRole.toLowerCase()}/dashboard`)
          return
        }
      } catch {
        evict(); return
      }
    }

    if (!hasInitialized.current) {
      // İlk yükleme: backend doğrulaması bitmeden içeriği gösterme (spinner)
      verify().then((ok) => {
        if (ok) {
          hasInitialized.current = true
          setIsAuthorized(true)
        }
      })
    } else {
      // Sonraki gezinmeler: içeriği hemen göster, arka planda doğrula
      verify().then((ok) => {
        if (!ok) {
          hasInitialized.current = false
          setIsAuthorized(false)
        }
      })
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Periyodik token + status kontrolü
  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      if (!isAuthorized) return
      const ok = await verify()
      if (!ok) setIsAuthorized(false)
    }, CHECK_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isAuthorized, verify])

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
