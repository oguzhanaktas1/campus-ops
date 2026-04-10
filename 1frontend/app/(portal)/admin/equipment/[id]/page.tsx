'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import {
  ArrowLeft, Loader2, AlertTriangle, Package, User, Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmt(d: any) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

const STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED']
const STOCK_OPTIONS = [
  { value: 'IN_STOCK', label: 'In Stock' },
  { value: 'LOW_STOCK', label: 'Low Stock' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
  { value: 'PROCUREMENT_REQ', label: 'Needs Procurement' },
]

export default function AdminEquipmentDetailPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({ newStatus: '', stockCheckStatus: '', estimatedCost: '', note: '' })

  useEffect(() => {
    if (!id) return
    fetch(`${BACKEND}/equipment-requests/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setData(d)
        if (d) setForm({ newStatus: d.status ?? '', stockCheckStatus: d.equipment?.stockCheckStatus ?? '', estimatedCost: d.equipment?.estimatedCost ? String(d.equipment.estimatedCost) : '', note: '' })
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [id])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${BACKEND}/equipment-requests/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          newStatus: form.newStatus !== data.status ? form.newStatus : undefined,
          stockCheckStatus: form.stockCheckStatus || undefined,
          estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
          reviewNote: form.note || undefined,
        }),
      })
      if (res.ok) {
        toast.success('Updated.')
        setData((prev: any) => ({ ...prev, status: form.newStatus }))
        setForm((p) => ({ ...p, note: '' }))
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed.')
      }
    } catch { toast.error('Network error.') }
    finally { setIsSaving(false) }
  }

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!data) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col items-center py-16">
      <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">Equipment request not found</p>
      <Link href="/admin/equipment"><Button variant="outline" size="sm" className="mt-3">Back</Button></Link>
    </div>
  )

  const eq = data.equipment

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto pb-20">
      <Link href="/admin/equipment"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="size-4" /> Back</Button></Link>

      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Package className="size-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{data.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{data.requestNo} · Submitted {fmt(data.createdAt)}</p>
          </div>
        </div>
        <StatusBadge status={data.status} />
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          {data.requester && (
            <div className="bg-card border border-border rounded-lg p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><User className="size-4 text-muted-foreground" /> Requester</p>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                  {data.requester?.fullName?.charAt(0) ?? 'R'}
                </div>
                <div>
                  <p className="text-sm font-medium">{data.requester?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{[data.requester?.faculty, data.requester?.department].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="text-sm font-semibold flex items-center gap-2"><Package className="size-4 text-muted-foreground" /> Equipment Details</p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Equipment" value={eq?.equipmentName} />
              <InfoRow label="Category" value={eq?.equipmentCategory} />
              <InfoRow label="Quantity" value={eq?.quantity?.toString()} />
              <InfoRow label="Purpose" value={eq?.purpose} />
              <InfoRow label="Needed From" value={fmt(eq?.neededFrom)} />
              <InfoRow label="Needed Until" value={fmt(eq?.neededUntil)} />
            </div>
            {eq?.urgencyReason && <div><p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Urgency</p><p className="text-sm text-muted-foreground">{eq.urgencyReason}</p></div>}
          </div>

          {data.description && (
            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-sm font-semibold mb-2">Description</p>
              <p className="text-sm text-muted-foreground">{data.description}</p>
            </div>
          )}

          {data.statusHistory?.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-sm font-semibold mb-4">Status History</p>
              <RequestTimeline events={data.statusHistory} />
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="text-sm font-semibold">Admin Controls</p>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.newStatus} onValueChange={(v) => setForm((p) => ({ ...p, newStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Stock Status</Label>
              <Select value={form.stockCheckStatus} onValueChange={(v) => setForm((p) => ({ ...p, stockCheckStatus: v }))}>
                <SelectTrigger><SelectValue placeholder="Not checked" /></SelectTrigger>
                <SelectContent>
                  {STOCK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Cost ($)</Label>
              <Input type="number" min={0} step={0.01} value={form.estimatedCost} onChange={(e) => setForm((p) => ({ ...p, estimatedCost: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Admin Note (optional)</Label>
              <Textarea className="resize-none min-h-[80px]" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} disabled={isSaving} />
            </div>
            <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
