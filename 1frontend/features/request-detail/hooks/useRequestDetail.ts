'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { mapRequestDetailToViewModel } from '@/features/request-detail/mappers/mapRequestDetailToViewModel'
import type {
  RequestDetailViewModel,
  RequestPortal,
} from '@/features/request-detail/types'
import { useRealtime } from '@/lib/providers/realtime-provider'

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
  const { socket } = useRealtime()
  // Used to trigger a silent background refetch (e.g. after workflow step change)
  const [refreshTick, setRefreshTick] = useState(0)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  const fetchDetail = useCallback(
    async (silent = false) => {
      const token = getToken()
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
      if (!token || !requestId) {
        if (!silent) setIsLoading(false)
        return
      }
      if (!silent) setIsLoading(true)
      try {
        const base = await fetchJson(
          `${backendUrl}/${portal}/requests/${requestId}`,
          token,
        )
        const inlineDomain = base.domainData ?? null
        const domainData: Record<string, unknown> | null = inlineDomain?.data ?? null
        if (isMountedRef.current) {
          setDetail(mapRequestDetailToViewModel(portal, base, domainData))
        }
      } catch {
        if (!silent && isMountedRef.current) {
          toast.error('Failed to load request detail')
          setDetail(null)
        }
      } finally {
        if (!silent && isMountedRef.current) setIsLoading(false)
      }
    },
    [portal, requestId],
  )

  // Initial fetch + refetch on refreshTick
  useEffect(() => {
    void fetchDetail(refreshTick > 0)
  }, [fetchDetail, refreshTick])

  // WebSocket: join request room and listen for live updates
  useEffect(() => {
    if (!requestId || !socket) return

    const joinRoom = () => socket.emit('request.join', { requestId })
    joinRoom()

    const onStatusChanged = (payload: any) => {
      const data = payload?.data ?? payload
      setDetail((prev) => prev ? { ...prev, status: data.status ?? prev.status } : prev)
    }

    const onCommentCreated = (payload: any) => {
      const raw = payload?.data?.comment ?? payload
      if (!raw?.id) return
      const comment = {
        id: String(raw.id),
        authorId: raw.user?.id ?? raw.authorId ?? null,
        author:
          raw.user?.profile?.fullName ??
          raw.user?.email ??
          raw.author?.fullName ??
          raw.author ??
          'Unknown',
        authorRole:
          raw.authorRole ??
          raw.user?.primaryRoles?.[0]?.role?.name?.toLowerCase() ??
          'unknown',
        content: raw.content ?? raw.commentText ?? '',
        createdAt: String(raw.createdAt ?? new Date().toISOString()),
      }
      setDetail((prev) => {
        if (!prev) return prev
        const alreadyExists = prev.comments?.some((c: any) => c.id === comment.id)
        if (alreadyExists) return prev
        return { ...prev, comments: [...(prev.comments ?? []), comment] }
      })
    }

    const onWorkflowStepChanged = () => {
      setRefreshTick((t) => t + 1)
    }

    // 'connected' is the server's ack emitted after handleConnection finishes auth+room setup.
    // Using it instead of 'connect' avoids the race where client.data.user is not yet set.
    socket.on('connected', joinRoom)
    socket.on('request.status.changed', onStatusChanged)
    socket.on('request.comment.created', onCommentCreated)
    socket.on('workflow.step.changed', onWorkflowStepChanged)

    return () => {
      socket.emit('request.leave', { requestId })
      socket.off('connected', joinRoom)
      socket.off('request.status.changed', onStatusChanged)
      socket.off('request.comment.created', onCommentCreated)
      socket.off('workflow.step.changed', onWorkflowStepChanged)
    }
  }, [requestId, socket])

  return { detail, isLoading, setDetail }
}
