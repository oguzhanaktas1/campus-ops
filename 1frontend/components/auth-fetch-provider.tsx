'use client'

import { useEffect } from 'react'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const SESSION_SENTINEL = 'cookie-session'

function isBackendRequest(input: RequestInfo | URL) {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

  return url.startsWith(BACKEND)
}

export function AuthFetchProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).__campusopsFetchPatched) return

    const originalFetch = window.fetch.bind(window)
    ;(window as any).__campusopsFetchPatched = true

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
      return originalFetch(input, nextInit)
    }
  }, [])

  return <>{children}</>
}
