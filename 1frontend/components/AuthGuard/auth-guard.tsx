'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  clearAuth,
  extractRoles,
  fetchProfile,
  getStoredUser,
  resolvePortalPath,
} from '@/lib/auth'

const CHECK_INTERVAL_MS = 60 * 1000

const STATUS_MESSAGES: Record<string, string> = {
  SUSPENDED: 'Your account has been suspended. Please contact the administrator.',
  PENDING: 'Your account is pending approval. Please wait for activation.',
  INACTIVE: 'Your account is inactive. Please contact support.',
}

interface AuthGuardProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasInitialized = useRef(false)

  const evict = useCallback((message?: string) => {
    if (message) toast.error(message)
    clearAuth()
    hasInitialized.current = false
    router.replace('/login')
  }, [router])

  const verify = useCallback(async (): Promise<boolean> => {
    let profile: any
    try {
      profile = await fetchProfile()
    } catch {
      evict('Your session has expired. Please log in again.')
      return false
    }

    const status = String(profile?.status ?? '').toUpperCase()
    if (status && status !== 'ACTIVE') {
      evict(STATUS_MESSAGES[status] ?? `Account status: ${status}. Please contact support.`)
      return false
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const userRoles = extractRoles(profile)
      const hasAllowedRole = userRoles.some((role) => allowedRoles.includes(role))
      if (!hasAllowedRole) {
        router.replace(userRoles.length > 0 ? resolvePortalPath(profile) : '/login')
        return false
      }
    }

    try {
      localStorage.setItem('access_token', 'cookie-session')
      localStorage.setItem('user', JSON.stringify(profile))
    } catch {}
    return true
  }, [allowedRoles, evict, router])

  useEffect(() => {
    const storedUser = getStoredUser()
    if (!storedUser) {
      evict()
      return
    }

    if (allowedRoles && allowedRoles.length > 0) {
      const userRoles = extractRoles(storedUser)
      const hasAllowedRole = userRoles.some((role) => allowedRoles.includes(role))
      if (userRoles.length > 0 && !hasAllowedRole) {
        router.replace(resolvePortalPath(storedUser))
        return
      }
    }

    if (!hasInitialized.current) {
      verify().then((ok) => {
        if (ok) {
          hasInitialized.current = true
          setIsAuthorized(true)
        }
      })
    } else {
      setIsAuthorized(true)
      verify().then((ok) => {
        if (!ok) {
          hasInitialized.current = false
          setIsAuthorized(false)
        }
      })
    }
  }, [allowedRoles, evict, pathname, router, verify])

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
