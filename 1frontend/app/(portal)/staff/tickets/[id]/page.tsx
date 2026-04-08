'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import { CommentThread } from '@/components/comment-thread'
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Ticket as TicketIcon,
  User,
  Monitor,
  MapPin,
  CheckCircle2,
  XCircle,
  RotateCcw,
  UserCheck,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { cn } from '@/lib/utils'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const TICKET_STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 border-blue-200',
  TRIAGED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  WAITING_USER: 'bg-orange-50 text-orange-700 border-orange-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-muted text-muted-foreground border-border',
  REOPENED: 'bg-red-50 text-red-700 border-red-200',
}

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

export default function StaffTicketDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [staffMembers, setStaffMembers] = useState<any[]>([])

  // Triage state
  const [triageState, setTriageState] = useState({
    assignedItUserId: '',
    newStatus: '',
    note: '',
  })
  const [isSavingTriage, setIsSavingTriage] = useState(false)

  // Resolve state
  const [resolveState, setResolveState] = useState({ resolutionSummary: '', note: '' })
  const [isResolving, setIsResolving] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isReopening, setIsReopening] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const [ticketRes, staffRes] = await Promise.all([
        fetch(`${BACKEND}/it-tickets/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
        fetch(`${BACKEND}/it-tickets/staff-members`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
      ])
      if (ticketRes.ok) {
        const d = await ticketRes.json()
        setData(d)
        setTriageState({
          assignedItUserId: d.ticket?.assignedTo?.id ?? '',
          newStatus: d.ticket?.ticketStatus ?? '',
          note: '',
        })
        setResolveState({
          resolutionSummary: d.ticket?.resolutionSummary ?? '',
          note: '',
        })
      }
      if (staffRes.ok) setStaffMembers(await staffRes.json())
    } catch {
      toast.error('Failed to load ticket.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { void loadData() }, [loadData])

  const handleAddComment = async (text: string) => {
    try {
      const res = await fetch(`${BACKEND}/requests/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ commentText: text, isInternal: false }),
      })
      if (res.ok) {
        const c = await res.json()
        setData((prev: any) => ({
          ...prev,
          comments: [...(prev.comments ?? []), {
            id: c.id,
            author: c.user?.profile?.fullName ?? 'You',
            authorRole: 'staff',
            content: c.commentText,
            isInternal: c.isInternal,
            createdAt: c.createdAt,
          }],
        }))
      }
    } catch { /* ignore */ }
  }

  const handleTriage = async () => {
    setIsSavingTriage(true)
    try {
      const body: any = {}
      if (triageState.assignedItUserId) body.assignedItUserId = triageState.assignedItUserId
      if (triageState.newStatus) body.newStatus = triageState.newStatus
      if (triageState.note.trim()) body.note = triageState.note

      const res = await fetch(`${BACKEND}/it-tickets/${id}/triage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Ticket triaged successfully.')
        await loadData()
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to triage.')
      }
    } catch { toast.error('Network error.') }
    finally { setIsSavingTriage(false) }
  }

  const handleResolve = async () => {
    setIsResolving(true)
    try {
      const res = await fetch(`${BACKEND}/it-tickets/${id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          resolutionSummary: resolveState.resolutionSummary || undefined,
          note: resolveState.note || undefined,
        }),
      })
      if (res.ok) {
        toast.success('Ticket resolved.')
        await loadData()
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to resolve.')
      }
    } catch { toast.error('Network error.') }
    finally { setIsResolving(false) }
  }

  const handleClose = async () => {
    setIsClosing(true)
    try {
      const res = await fetch(`${BACKEND}/it-tickets/${id}/close`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) { toast.success('Ticket closed.'); await loadData() }
      else toast.error('Failed to close ticket.')
    } catch { toast.error('Network error.') }
    finally { setIsClosing(false) }
  }

  const handleReopen = async () => {
    setIsReopening(true)
    try {
      const res = await fetch(`${BACKEND}/it-tickets/${id}/reopen`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) { toast.success('Ticket reopened.'); await loadData() }
      else toast.error('Failed to reopen ticket.')
    } catch { toast.error('Network error.') }
    finally { setIsReopening(false) }
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex flex-col items-center py-16 text-center">
          <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Ticket not found</p>
          <Link href="/staff/tickets" className="mt-3">
            <Button variant="outline" size="sm">Back to tickets</Button>
          </Link>
        </div>
      </div>
    )
  }

  const t = data.ticket
  const isClosed = t?.ticketStatus === 'CLOSED' || t?.ticketStatus === 'RESOLVED'
  const isReopened = t?.ticketStatus === 'REOPENED'

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto pb-20">
      <div className="flex items-center gap-3">
        <Link href="/staff/tickets">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" /> Back
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <TicketIcon className="size-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{data.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.requestNo} · Submitted {formatDate(data.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-[11px] font-bold px-2.5 py-1 rounded border',
            TICKET_STATUS_CLASS[t?.ticketStatus] ?? TICKET_STATUS_CLASS['OPEN'],
          )}>
            {t?.ticketStatus?.replace(/_/g, ' ')}
          </span>
          <PriorityBadge priority={data.priority} />
          <StatusBadge status={data.status} />
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Left — details + comments */}
        <div className="lg:col-span-3 space-y-5">
          {/* Requester */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <User className="size-4 text-muted-foreground" /> Requester
            </p>
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                {data.requester?.fullName?.charAt(0) ?? 'R'}
              </div>
              <div>
                <p className="text-sm font-medium">{data.requester?.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {[data.requester?.faculty, data.requester?.department].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          </div>

          {/* Ticket details */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Monitor className="size-4 text-muted-foreground" /> Ticket Details
            </p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Category" value={t?.category} />
              {t?.subcategory && <InfoRow label="Subcategory" value={t.subcategory} />}
              {t?.affectedSystem && <InfoRow label="Affected System" value={t.affectedSystem} />}
              {t?.assetId && <InfoRow label="Asset ID" value={t.assetId} />}
              {t?.locationText && (
                <div className="col-span-2 flex items-start gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <InfoRow label="Location" value={t.locationText} />
                </div>
              )}
              {t?.incidentStartedAt && (
                <InfoRow label="Incident Started" value={formatDate(t.incidentStartedAt)} />
              )}
              {t?.reopenedCount > 0 && (
                <InfoRow label="Reopened" value={`${t.reopenedCount}x`} />
              )}
            </div>
            {t?.resolutionSummary && (
              <div className="pt-3 border-t border-border">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Resolution</p>
                <p className="text-sm text-foreground">{t.resolutionSummary}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {data.description && (
            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-sm font-semibold mb-2">Description</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.description}</p>
            </div>
          )}

          {/* SLA info */}
          {t?.slaPolicy && (
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              <div className="size-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-4 text-purple-700 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">SLA Policy</p>
                <p className="text-sm font-medium">{t.slaPolicy.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.slaPolicy.firstResponseMinutes != null && `First response: ${t.slaPolicy.firstResponseMinutes}min`}
                  {t.slaPolicy.resolutionMinutes != null && ` · Resolution: ${t.slaPolicy.resolutionMinutes}min`}
                </p>
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-card border border-border rounded-lg p-5">
            <p className="text-sm font-semibold mb-4">Comments</p>
            <CommentThread
              comments={data.comments ?? []}
              onAddComment={handleAddComment}
            />
          </div>

          {/* Timeline */}
          {data.statusHistory?.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-sm font-semibold mb-4">Status History</p>
              <RequestTimeline events={data.statusHistory} />
            </div>
          )}
        </div>

        {/* Right — actions panel */}
        <div className="lg:col-span-2 space-y-5">
          {/* Current assignment */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-muted-foreground" /> Assigned To
            </p>
            {t?.assignedTo ? (
              <div className="flex items-center gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div className="size-7 rounded-full bg-emerald-200 dark:bg-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  {t.assignedTo.fullName?.charAt(0) ?? 'S'}
                </div>
                <p className="text-sm font-medium">{t.assignedTo.fullName}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Unassigned</p>
            )}
          </div>

          {/* Triage panel */}
          {!isClosed && (
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <p className="text-sm font-semibold text-foreground">Triage &amp; Assign</p>

              <div className="space-y-1.5">
                <Label>Assign to Staff</Label>
                <Select
                  value={triageState.assignedItUserId}
                  onValueChange={(v) => setTriageState((p) => ({ ...p, assignedItUserId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select staff member..." /></SelectTrigger>
                  <SelectContent>
                    {staffMembers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Update Status</Label>
                <Select
                  value={triageState.newStatus}
                  onValueChange={(v) => setTriageState((p) => ({ ...p, newStatus: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Keep current..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRIAGED">Triaged</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="WAITING_USER">Waiting on User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Internal Note</Label>
                <Textarea
                  placeholder="Add an internal note..."
                  className="resize-none min-h-[70px]"
                  value={triageState.note}
                  onChange={(e) => setTriageState((p) => ({ ...p, note: e.target.value }))}
                  disabled={isSavingTriage}
                />
              </div>

              <Button className="w-full gap-2" onClick={handleTriage} disabled={isSavingTriage}>
                {isSavingTriage ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Triage
              </Button>
            </div>
          )}

          {/* Resolve panel */}
          {!isClosed && t?.ticketStatus !== 'RESOLVED' && (
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <p className="text-sm font-semibold text-foreground">Resolve Ticket</p>
              <div className="space-y-1.5">
                <Label>Resolution Summary</Label>
                <Textarea
                  placeholder="Describe what was done to resolve this ticket..."
                  className="resize-none min-h-[80px]"
                  value={resolveState.resolutionSummary}
                  onChange={(e) => setResolveState((p) => ({ ...p, resolutionSummary: e.target.value }))}
                  disabled={isResolving}
                />
              </div>
              <Button
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleResolve}
                disabled={isResolving}
              >
                {isResolving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Mark as Resolved
              </Button>
            </div>
          )}

          {/* Close / Reopen */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Actions</p>
            {!isClosed && t?.ticketStatus !== 'CLOSED' && (
              <Button
                variant="outline"
                className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
                onClick={handleClose}
                disabled={isClosing}
              >
                {isClosing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                Close Ticket
              </Button>
            )}
            {(isClosed || isReopened || t?.ticketStatus === 'RESOLVED' || t?.ticketStatus === 'CLOSED') && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleReopen}
                disabled={isReopening}
              >
                {isReopening ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Reopen Ticket
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
