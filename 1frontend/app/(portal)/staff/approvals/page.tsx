'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  Loader2,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

type ActionType = 'approve' | 'reject' | 'revision' | null

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function StaffApprovalsPage() {
  const [pending, setPending] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState<Record<string, ActionType>>({})

  const fetchInbox = async () => {
    try {
      const res = await fetch(`${BACKEND}/requests/inbox`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) {
        const data: any[] = await res.json()
        setPending(data)
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id)
      } else {
        toast.error('Failed to load pending requests.')
      }
    } catch {
      toast.error('Failed to load pending requests.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void fetchInbox() }, [])

  const selected = pending.find((r) => r.id === selectedId)

  const handleAction = async (action: NonNullable<ActionType>) => {
    if (!selectedId) return

    if ((action === 'reject' || action === 'revision') && !comment.trim()) {
      toast.error(`A comment is required to ${action} this request.`)
      return
    }

    setIsProcessing(true)
    try {
      const res = await fetch(`${BACKEND}/requests/${selectedId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      })

      if (res.ok) {
        toast.success(`Request ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revision requested'} successfully.`)
        setDone((prev) => ({ ...prev, [selectedId]: action }))
        setComment('')
        setTimeout(() => {
          setPending((prev) => prev.filter((p) => p.id !== selectedId))
          const next = pending.find((r) => r.id !== selectedId && !done[r.id])
          setSelectedId(next?.id ?? null)
        }, 1500)
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to process request.')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Left: pending list */}
      <div className="lg:w-80 flex-shrink-0 border-r border-border overflow-y-auto bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Pending Actions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pending.filter((p) => !done[p.id]).length} requires action
          </p>
        </div>
        <div className="divide-y divide-border">
          {pending.map((req) => {
            const doneAction = done[req.id]
            return (
              <button
                key={req.id}
                onClick={() => setSelectedId(req.id)}
                className={cn(
                  'w-full text-left px-4 py-3.5 flex items-start gap-2 hover:bg-muted/30 transition-colors',
                  selectedId === req.id && 'bg-primary/5 border-r-2 border-r-primary',
                  doneAction && 'opacity-50 pointer-events-none',
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{req.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {req.requester?.fullName ?? '—'} · {formatDate(req.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{req.requestType?.name}</p>
                  {doneAction && (
                    <span className={cn(
                      'inline-flex items-center gap-1 text-[10px] font-bold mt-1 uppercase tracking-wider',
                      doneAction === 'approve' && 'text-emerald-600',
                      doneAction === 'reject' && 'text-destructive',
                      doneAction === 'revision' && 'text-amber-600',
                    )}>
                      {doneAction === 'approve' && <CheckCircle2 className="size-3" />}
                      {doneAction === 'reject' && <XCircle className="size-3" />}
                      {doneAction === 'revision' && <RotateCcw className="size-3" />}
                      {doneAction}D
                    </span>
                  )}
                </div>
                <ChevronRight className="size-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              </button>
            )
          })}
          {pending.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="size-10 text-emerald-500/20 mb-3" />
              <p className="text-sm font-medium text-foreground">All Caught Up!</p>
              <p className="text-xs text-muted-foreground mt-1">No requests pending your action.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: detail + actions */}
      <div className="flex-1 overflow-y-auto p-6 bg-muted/5">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a request to review
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            <div>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{selected.title}</h1>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                    <span className="font-medium text-primary">{selected.requester?.fullName ?? '—'}</span>
                    <span>·</span> {formatDate(selected.createdAt)}
                    <span>·</span> {selected.requestType?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={selected.priority} />
                  <StatusBadge
                    status={
                      done[selected.id]
                        ? done[selected.id] === 'approve'
                          ? 'APPROVED'
                          : done[selected.id] === 'reject'
                          ? 'REJECTED'
                          : 'REVISION_REQUESTED'
                        : selected.status
                    }
                  />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
              <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="size-4 text-muted-foreground" /> Request Description
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {selected.description || 'No description provided.'}
              </p>
            </div>

            {/* Action area */}
            {done[selected.id] ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 p-6 rounded-lg text-center">
                <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Action Recorded</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-1">
                  This request has been processed and is now locked.
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-foreground">Decision</p>
                  {!comment.trim() && (
                    <p className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded">
                      Comment required for Reject / Revision
                    </p>
                  )}
                </div>
                <Textarea
                  placeholder="Provide reasoning or feedback (required for Reject/Revision)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="resize-none min-h-[100px]"
                  disabled={isProcessing}
                />
                <div className="flex gap-3 flex-wrap">
                  <Button
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-none"
                    disabled={isProcessing}
                    onClick={() => handleAction('approve')}
                  >
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="gap-2 flex-1 sm:flex-none"
                    disabled={isProcessing}
                    onClick={() => handleAction('reject')}
                  >
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 flex-1 sm:flex-none border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                    disabled={isProcessing}
                    onClick={() => handleAction('revision')}
                  >
                    {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                    Request Revision
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
