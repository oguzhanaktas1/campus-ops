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
import { triggerSessionExpired } from '@/lib/session-expiry'

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

  const evict = useCallback(
    (
      options?: { sessionExpired?: boolean; statusMessage?: string },
    ) => {
      if (options?.sessionExpired) {
        // Centralized session-expired flow: persistent TR/EN toast + redirect.
        triggerSessionExpired('unauthorized')
      } else if (options?.statusMessage) {
        toast.error(options.statusMessage)
        clearAuth()
        router.replace('/login')
      } else {
        clearAuth()
        router.replace('/login')
      }
      hasInitialized.current = false
      setIsAuthorized(false)
    },
    [router],
  )

  const verify = useCallback(async (): Promise<boolean> => {
    let profile: any
    try {
      profile = await fetchProfile()
    } catch {
      evict({ sessionExpired: true })
      return false
    }

    const status = String(profile?.status ?? '').toUpperCase()
    if (status && status !== 'ACTIVE') {
      evict({
        statusMessage:
          STATUS_MESSAGES[status] ??
          `Account status: ${status}. Please contact support.`,
      })
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
      localStorage.setItem('user', JSON.stringify(profile))
    } catch {}
    return true
  }, [allowedRoles, evict, router])

  useEffect(() => {
    const storedUser = getStoredUser()
    if (!storedUser) {
      // No local session at all — just send them to login, no expiry toast
      // needed (they were never signed in on this tab).
      clearAuth()
      router.replace('/login')
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
