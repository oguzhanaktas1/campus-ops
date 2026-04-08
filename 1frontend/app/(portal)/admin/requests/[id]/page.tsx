'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { ArrowLeft, Loader2, User, Calendar, FileText, Clock, AlertTriangle, Package } from 'lucide-react'
import { toast } from 'sonner'

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminRequestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [request, setRequest] = useState<any>(null)
  const [equipmentDetail, setEquipmentDetail] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRequest = async () => {
      const token = localStorage.getItem('access_token')
      if (!token || !id) return

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      try {
        const res = await fetch(`${backendUrl}/admin/requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setRequest(data)

          const typeKey = data.requestType?.key || data.type || ''
          if (typeKey === 'EQUIPMENT') {
            const eqRes = await fetch(`${backendUrl}/equipment-requests/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (eqRes.ok) {
              const eqData = await eqRes.json()
              setEquipmentDetail(eqData.equipment ?? null)
            }
          }
        } else {
          toast.error('Request not found.')
        }
      } catch {
        toast.error('Failed to load request.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchRequest()
  }, [id])

  const handleForceClose = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
    try {
      const res = await fetch(`${backendUrl}/admin/requests/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success('Request closed.')
        router.push('/admin/requests')
      } else {
        toast.error('Failed to close request.')
      }
    } catch {
      toast.error('Network error.')
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!request) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex flex-col items-center py-16 text-center">
          <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Request not found</p>
          <Link href="/admin/requests" className="mt-3">
            <Button variant="outline" size="sm">Back to requests</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/admin/requests">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">{request.title}</h1>
          <p className="text-sm text-muted-foreground">{request.requestNumber}</p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* Meta info */}
      <div className="bg-card border border-border rounded-lg p-5 grid sm:grid-cols-2 gap-4">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Submitted by</p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <User className="size-3.5 text-muted-foreground" />
            {request.requester?.profile?.fullName || request.requester?.email || '—'}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Request Type</p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <FileText className="size-3.5 text-muted-foreground" />
            {request.requestType?.name || request.type || '—'}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Created At</p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            {formatDate(request.createdAt)}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Priority</p>
          <p className="text-sm font-medium capitalize">{request.priority?.toLowerCase() || '—'}</p>
        </div>
        {request.dueAt && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Due Date</p>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              {formatDate(request.dueAt)}
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      {request.description && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-2">Description</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.description}</p>
        </div>
      )}

      {/* Equipment detail */}
      {equipmentDetail && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Package className="size-4 text-muted-foreground" /> Equipment Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              { label: 'Equipment Name', value: equipmentDetail.equipmentName },
              { label: 'Category', value: equipmentDetail.equipmentCategory },
              { label: 'Quantity', value: equipmentDetail.quantity != null ? String(equipmentDetail.quantity) : null },
              { label: 'Purpose', value: equipmentDetail.purpose },
              { label: 'Needed From', value: equipmentDetail.neededFrom ? formatDate(equipmentDetail.neededFrom) : null },
              { label: 'Needed Until', value: equipmentDetail.neededUntil ? formatDate(equipmentDetail.neededUntil) : null },
              { label: 'Stock Status', value: equipmentDetail.stockCheckStatus ? equipmentDetail.stockCheckStatus.replace(/_/g, ' ') : null },
              { label: 'Procurement Required', value: equipmentDetail.procurementRequired != null ? (equipmentDetail.procurementRequired ? 'Yes' : 'No') : null },
              { label: 'Estimated Cost', value: equipmentDetail.estimatedCost != null ? `$${Number(equipmentDetail.estimatedCost).toFixed(2)}` : null },
            ].map(({ label, value }) =>
              value ? (
                <div key={label} className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-medium">{value}</p>
                </div>
              ) : null
            )}
            {equipmentDetail.urgencyReason && (
              <div className="sm:col-span-2 space-y-0.5">
                <p className="text-xs text-muted-foreground">Urgency Reason</p>
                <p className="font-medium">{equipmentDetail.urgencyReason}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status history */}
      {request.statusHistory?.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Status History</h2>
          <div className="space-y-2">
            {request.statusHistory.map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <div className="size-2 rounded-full bg-primary flex-shrink-0" />
                <span className="font-medium capitalize">{h.status?.toLowerCase()}</span>
                <span className="text-muted-foreground text-xs">{formatDate(h.createdAt)}</span>
                {h.note && <span className="text-muted-foreground text-xs">— {h.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleForceClose}
          className="gap-1.5"
        >
          Force Close
        </Button>
      </div>
    </div>
  )
}
