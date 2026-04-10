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

function resolveSupplementalKey(raw: any) {
  const key = String(raw.requestType?.key ?? raw.type ?? '').toUpperCase()
  if (key.includes('EQUIPMENT')) return 'equipment'
  if (key.includes('TICKET') || key.includes('IT_SUPPORT')) return 'ticket'
  if (key.includes('INTERNSHIP')) return 'internship'
  return null
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
        const base = await fetchJson(
          `${backendUrl}/${portal}/requests/${requestId}`,
          token,
        )

        let domainData: Record<string, unknown> | null = null
        const supplementalKey = resolveSupplementalKey(base)

        if (supplementalKey === 'equipment') {
          const equipment = await fetchJson(
            `${backendUrl}/equipment-requests/${requestId}`,
            token,
          )
          domainData = equipment.equipment ?? null
        } else if (supplementalKey === 'ticket') {
          const ticket = await fetchJson(
            `${backendUrl}/it-tickets/${requestId}`,
            token,
          )
          domainData = ticket.ticket ?? null
        } else if (supplementalKey === 'internship') {
          const internship = await fetchJson(
            `${backendUrl}/internships/${requestId}`,
            token,
          )
          domainData = internship.internshipRequest ?? null
        }

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
