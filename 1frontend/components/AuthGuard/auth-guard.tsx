'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const CHECK_INTERVAL_MS = 60 * 1000 // 1 dakika

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Oturumu tamamen temizle ve login'e at
  const evict = useCallback((message?: string) => {
    if (message) toast.error(message)
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    router.replace('/login')
  }, [router])

  // Backend'e gidip token + status kontrolü yap
  const verify = useCallback(async (): Promise<boolean> => {
    const token = getToken()
    if (!token) {
      evict()
      return false
    }

    let profile: any
    try {
      const res = await fetch(`${BACKEND}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.status === 401) {
        evict('Your session has expired. Please log in again.')
        return false
      }

      if (!res.ok) {
        // 5xx veya diğer hatalar → çıkış yapma, sadece false dön
        return false
      }

      profile = await res.json()
    } catch {
      // Ağ hatası — sunucu ulaşılamaz, oturumu sonlandırma
      return false
    }

    // Status kontrolü
    const status: string = (profile?.status ?? '').toUpperCase()
    if (status && status !== 'ACTIVE') {
      const msg = STATUS_MESSAGES[status] ?? `Account status: ${status}. Please contact support.`
      evict(msg)
      return false
    }

    // Rol kontrolü
    if (allowedRoles && allowedRoles.length > 0) {
      const userRole: string = (
        profile?.role ||
        profile?.primaryRoles?.[0]?.role?.name ||
        ''
      ).toUpperCase()

      if (!userRole || !allowedRoles.includes(userRole)) {
        const redirectPath = userRole ? `/${userRole.toLowerCase()}/dashboard` : '/login'
        router.replace(redirectPath)
        return false
      }
    }

    // localStorage'daki user kaydını taze tut
    try {
      localStorage.setItem('user', JSON.stringify(profile))
    } catch {/* quota hatası — önemsiz */}

    return true
  }, [allowedRoles, evict, router])

  // Rota değişince tam kontrol
  useEffect(() => {
    setIsAuthorized(false)

    // localStorage'da token/user yoksa anında at — backend'i bekleme
    const token = getToken()
    const userStr = localStorage.getItem('user')
    if (!token || !userStr) {
      evict()
      return
    }

    // Hızlı yerel rol kontrolü (ağ gecikmesini bypass et)
    if (allowedRoles && allowedRoles.length > 0) {
      try {
        const user = JSON.parse(userStr)
        const userRole = (user.role || user.primaryRoles?.[0]?.role?.name || '').toUpperCase()
        if (userRole && !allowedRoles.includes(userRole)) {
          router.replace(`/${userRole.toLowerCase()}/dashboard`)
          return
        }
      } catch {
        evict()
        return
      }
    }

    // Tam backend doğrulaması
    verify().then((ok) => {
      if (ok) setIsAuthorized(true)
    })
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // 1 dakikada bir periyodik token + status kontrolü
  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      if (!isAuthorized) return
      const ok = await verify()
      if (!ok) setIsAuthorized(false)
    }, CHECK_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
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
