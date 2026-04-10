'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/status-badge'
import { RequestTimeline } from '@/components/request-timeline'
import {
  ArrowLeft, Loader2, AlertTriangle, Briefcase,
  User, Building2, Calendar, Save,
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

const ACTIONABLE_STATUSES = ['APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'CANCELLED']

export default function AdminInternshipDetailPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`${BACKEND}/internships/${id}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setData(d)
        if (d) {
          setNewStatus(ACTIONABLE_STATUSES.includes(d.status) ? d.status : 'APPROVED')
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [id])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`${BACKEND}/internships/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status: newStatus, note: note.trim() || undefined }),
      })
      if (res.ok) {
        toast.success('Status updated.')
        setData((prev: any) => ({ ...prev, status: newStatus }))
        setNote('')
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to update.')
      }
    } catch { toast.error('Network error.') }
    finally { setIsSaving(false) }
  }

  if (isLoading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!data) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col items-center py-16">
      <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium">Internship not found</p>
      <Link href="/admin/internships"><Button variant="outline" size="sm" className="mt-3">Back</Button></Link>
    </div>
  )

  const ir = data.internshipRequest ?? data

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto pb-20">
      <Link href="/admin/internships"><Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="size-4" /> Back</Button></Link>

      <div className="bg-card border border-border rounded-lg p-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Briefcase className="size-5 text-amber-700 dark:text-amber-300" />
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
          {data.student && (
            <div className="bg-card border border-border rounded-lg p-5 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2"><User className="size-4 text-muted-foreground" /> Student</p>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                  {data.student?.fullName?.charAt(0) ?? 'S'}
                </div>
                <div>
                  <p className="text-sm font-medium">{data.student?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{[data.student?.studentNumber, data.student?.department].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="text-sm font-semibold flex items-center gap-2"><Building2 className="size-4 text-muted-foreground" /> Company</p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Company" value={ir.companyName} />
              <InfoRow label="Sector" value={ir.companySector} />
              <InfoRow label="Contact" value={ir.companyContactName} />
              <InfoRow label="Email" value={ir.companyContactEmail} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <p className="text-sm font-semibold flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /> Details</p>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Type" value={ir.internshipType} />
              <InfoRow label="Work Mode" value={ir.workMode} />
              <InfoRow label="Start" value={fmt(ir.startDate)} />
              <InfoRow label="End" value={fmt(ir.endDate)} />
              <InfoRow label="Duration" value={ir.durationDays ? `${ir.durationDays} days` : null} />
              <InfoRow label="Insurance" value={ir.insuranceRequired ? 'Required' : 'Not Required'} />
            </div>
          </div>

          {ir.advisor && (
            <div className="bg-card border border-border rounded-lg p-5">
              <p className="text-sm font-semibold mb-2">Assigned Advisor</p>
              <p className="text-sm">{ir.advisor.fullName}</p>
              <p className="text-xs text-muted-foreground">{ir.advisor.email}</p>
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
            <p className="text-sm font-semibold">Manage Status</p>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIONABLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Admin Note (optional)</Label>
              <Textarea className="resize-none min-h-[80px]" placeholder="Add an internal note..." value={note} onChange={(e) => setNote(e.target.value)} disabled={isSaving} />
            </div>
            <Button className="w-full gap-2" onClick={handleSave} disabled={isSaving || !ACTIONABLE_STATUSES.includes(newStatus) || newStatus === data.status}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
