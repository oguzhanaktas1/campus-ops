'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { mapRequestDetailToViewModel } from '@/features/request-detail/mappers/mapRequestDetailToViewModel'
import type {
  RequestDetailViewModel,
  RequestPortal,
} from '@/features/request-detail/types'

async function fetchJson(url: string, token: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json()
}

export function useRequestDetail(requestId: string, portal: RequestPortal) {
  const [detail, setDetail] = useState<RequestDetailViewModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    const run = async () => {
      const token = getToken()
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

      if (!token || !requestId) {
        setIsLoading(false)
        return
      }

      try {
        // Single fetch — backend now includes domain data (equipment/ticket/internship) inline.
        // No supplemental round-trip needed.
        const base = await fetchJson(
          `${backendUrl}/${portal}/requests/${requestId}`,
          token,
        )

        // domainData is provided inline by the backend as { type, data }
        const inlineDomain = base.domainData ?? null
        const domainData: Record<string, unknown> | null = inlineDomain?.data ?? null

        if (!isCancelled) {
          setDetail(mapRequestDetailToViewModel(portal, base, domainData))
        }
      } catch {
        if (!isCancelled) {
          toast.error('Failed to load request detail')
          setDetail(null)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [portal, requestId])

  return { detail, isLoading, setDetail }
}
