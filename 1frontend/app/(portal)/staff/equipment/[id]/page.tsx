'use client'

import { useEffect, useState } from 'react'
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
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Package,
  User,
  ClipboardList,
  CheckCircle2,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const STOCK_OPTIONS = [
  { value: 'IN_STOCK',        label: 'In Stock' },
  { value: 'LOW_STOCK',       label: 'Low Stock' },
  { value: 'OUT_OF_STOCK',    label: 'Out of Stock' },
  { value: 'PROCUREMENT_REQ', label: 'Needs Procurement' },
]

function formatDate(d: string | Date | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

export default function StaffEquipmentDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [review, setReview] = useState({
    stockCheckStatus: '',
    procurementRequired: false,
    estimatedCost: '',
    reviewNote: '',
  })

  useEffect(() => {
    if (!id) return
    fetch(`${BACKEND}/equipment-requests/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setData(d)
        if (d?.equipment) {
          setReview({
            stockCheckStatus: d.equipment.stockCheckStatus ?? '',
            procurementRequired: d.equipment.procurementRequired ?? false,
            estimatedCost: d.equipment.estimatedCost ? String(d.equipment.estimatedCost) : '',
            reviewNote: '',
          })
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [id])

  const handleSaveReview = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${BACKEND}/equipment-requests/${id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          stockCheckStatus: review.stockCheckStatus || undefined,
          procurementRequired: review.procurementRequired,
          estimatedCost: review.estimatedCost ? Number(review.estimatedCost) : undefined,
          reviewNote: review.reviewNote || undefined,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setData((prev: any) => ({
          ...prev,
          equipment: { ...prev.equipment, ...updated },
        }))
        setReview((prev) => ({ ...prev, reviewNote: '' }))
        toast.success('Review updated.')
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to save review.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setIsSaving(false)
    }
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
          <p className="text-sm font-medium text-foreground">Equipment request not found</p>
          <Link href="/staff/equipment" className="mt-3">
            <Button variant="outline" size="sm">Back to equipment</Button>
          </Link>
        </div>
      </div>
    )
  }

  const eq = data.equipment

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-3">
        <Link href="/staff/equipment">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" /> Back
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Package className="size-5 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{data.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{data.requestNo} · Submitted {formatDate(data.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={data.priority} />
          <StatusBadge status={data.status} />
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Left column — details */}
        <div className="lg:col-span-3 space-y-5">
          {/* Requester */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
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

          {/* Equipment details */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" /> Equipment Details
            </p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Equipment Name" value={eq?.equipmentName} />
              <InfoRow label="Category" value={eq?.equipmentCategory} />
              <InfoRow label="Quantity" value={eq?.quantity ? String(eq.quantity) : null} />
              <InfoRow label="Purpose" value={eq?.purpose} />
              <InfoRow label="Needed From" value={formatDate(eq?.neededFrom)} />
              <InfoRow label="Needed Until" value={formatDate(eq?.neededUntil)} />
              {eq?.urgencyReason && (
                <div className="col-span-2">
                  <InfoRow label="Urgency Reason" value={eq.urgencyReason} />
                </div>
              )}
              {eq?.labResource && (
                <InfoRow label="Lab Resource" value={eq.labResource.name} />
              )}
            </div>
          </div>

          {/* Description */}
          {data.description && (
            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-sm font-semibold text-foreground mb-2">Description</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.description}</p>
            </div>
          )}

          {/* Comments */}
          {data.comments?.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5 space-y-3">
              <p className="text-sm font-semibold text-foreground">Comments</p>
              {data.comments.map((c: any) => (
                <div key={c.id} className="border-l-2 border-border pl-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium">{c.author}</p>
                    {c.isInternal && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Internal</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{c.content}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(c.createdAt)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          {data.statusHistory?.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Status History</p>
              <RequestTimeline events={data.statusHistory} />
            </div>
          )}
        </div>

        {/* Right column — review panel */}
        <div className="lg:col-span-2 space-y-5">
          {/* Current stock state */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Current Review State</p>
            <div className="space-y-1">
              <InfoRow label="Stock Status" value={eq?.stockCheckStatus ?? 'Not checked'} />
              <InfoRow label="Procurement" value={eq?.procurementRequired ? 'Required' : 'Not required'} />
              {eq?.estimatedCost && (
                <InfoRow label="Estimated Cost" value={`$${Number(eq.estimatedCost).toFixed(2)}`} />
              )}
            </div>
          </div>

          {/* Review update form */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-muted-foreground" /> Update Review
            </p>

            <div className="space-y-1.5">
              <Label>Stock Check Status</Label>
              <Select
                value={review.stockCheckStatus}
                onValueChange={(v) => setReview({ ...review, stockCheckStatus: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {STOCK_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={review.procurementRequired}
                onClick={() => setReview({ ...review, procurementRequired: !review.procurementRequired })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${review.procurementRequired ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${review.procurementRequired ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <Label
                className="cursor-pointer"
                onClick={() => setReview({ ...review, procurementRequired: !review.procurementRequired })}
              >
                Procurement Required
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label>Estimated Cost ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={review.estimatedCost}
                onChange={(e) => setReview({ ...review, estimatedCost: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Internal Note (optional)</Label>
              <Textarea
                placeholder="Add an internal review note..."
                className="resize-none min-h-[80px]"
                value={review.reviewNote}
                onChange={(e) => setReview({ ...review, reviewNote: e.target.value })}
                disabled={isSaving}
              />
            </div>

            <Button className="w-full gap-2" onClick={handleSaveReview} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Review
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
