'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, ShoppingCart, ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED:   'bg-blue-50 text-blue-700 border-blue-200',
  IN_REVIEW:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  APPROVED:    'bg-green-50 text-green-700 border-green-200',
  REJECTED:    'bg-red-50 text-red-700 border-red-200',
  IN_PROGRESS: 'bg-purple-50 text-purple-700 border-purple-200',
  COMPLETED:   'bg-gray-50 text-gray-500 border-gray-200',
}

type Action = 'approve' | 'reject' | 'in_progress' | null

export default function StaffProcurementDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [action, setAction] = useState<Action>(null)
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/procurement/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        setData(await res.json())
      } catch {
        toast.error('Failed to load procurement request.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handleAction = async (status: string) => {
    setIsSaving(true)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/procurement/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status, note }),
      })
      if (!res.ok) throw new Error()
      toast.success('Status updated.')
      setData((prev: any) => prev ? { ...prev, status } : prev)
      setAction(null)
      setNote('')
    } catch {
      toast.error('Failed to update status.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )
  if (!data) return null

  const pr = data.procurementRequest

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => router.back()}><ArrowLeft className="size-4" /></Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ShoppingCart className="size-5 text-primary" /> Procurement Request</h1>
          <p className="text-sm text-muted-foreground">{data.requestNo}</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <span className={cn('text-sm font-semibold px-3 py-1 rounded-full border', STATUS_BADGE[data.status] ?? STATUS_BADGE.SUBMITTED)}>
          {data.status?.replace(/_/g, ' ')}
        </span>
        <span className="text-xs text-muted-foreground">{new Date(data.createdAt).toLocaleString()}</span>
      </div>

      {/* Details */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold">Item Details</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground">Item Name</p><p className="font-medium mt-0.5">{pr?.itemName ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Category</p><p className="font-medium mt-0.5">{pr?.itemCategory ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Quantity</p><p className="font-medium mt-0.5">{pr?.quantity ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Unit Price Estimate</p><p className="font-medium mt-0.5">{pr?.unitPriceEstimate ? `$${Number(pr.unitPriceEstimate).toFixed(2)}` : '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Total Estimate</p><p className="font-medium mt-0.5">{pr?.totalEstimate ? `$${Number(pr.totalEstimate).toFixed(2)}` : '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Vendor Preference</p><p className="font-medium mt-0.5">{pr?.vendorPreference ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Budget Code</p><p className="font-medium mt-0.5">{pr?.budgetCode ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Requester</p><p className="font-medium mt-0.5">{data.requester?.profile?.fullName ?? '—'}</p></div>
        </div>
        {pr?.justification && (
          <div><p className="text-xs text-muted-foreground">Justification</p><p className="text-sm mt-0.5 leading-relaxed">{pr.justification}</p></div>
        )}
      </div>

      {/* Status history */}
      {data.statusHistory?.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold mb-3">History</h2>
          <div className="space-y-2">
            {data.statusHistory.map((h: any, i: number) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <Clock className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <span className="font-medium">{h.newStatus?.replace(/_/g, ' ')}</span>
                  {h.changeReason && <span className="text-muted-foreground ml-1">— {h.changeReason}</span>}
                  <span className="text-muted-foreground ml-1">({new Date(h.createdAt).toLocaleString()})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {['SUBMITTED', 'IN_REVIEW'].includes(data.status) && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold">Actions</h2>
          {action ? (
            <div className="space-y-3">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (optional)..."
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
              <div className="flex gap-2">
                {action === 'approve' && (
                  <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => handleAction('APPROVED')} disabled={isSaving}>
                    {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />} Approve
                  </Button>
                )}
                {action === 'reject' && (
                  <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => handleAction('REJECTED')} disabled={isSaving}>
                    {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />} Reject
                  </Button>
                )}
                {action === 'in_progress' && (
                  <Button size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700" onClick={() => handleAction('IN_PROGRESS')} disabled={isSaving}>
                    {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />} Mark In Progress
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setAction(null); setNote('') }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setAction('in_progress')}>Mark In Review</Button>
              <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white" onClick={() => setAction('approve')}>
                <CheckCircle className="size-3.5" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setAction('reject')}>
                <XCircle className="size-3.5 mr-1" /> Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
