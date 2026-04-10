'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const DOC_TYPES = [
  { value: 'TRANSCRIPT', label: 'Transcript' },
  { value: 'ENROLLMENT_CERTIFICATE', label: 'Enrollment Certificate' },
  { value: 'STUDENT_CERTIFICATE', label: 'Student Certificate' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'OTHER', label: 'Other' },
]
const DELIVERY_METHODS = [
  { value: 'PICKUP', label: 'Pickup from Office' },
  { value: 'EMAIL', label: 'Send via Email' },
  { value: 'MAIL', label: 'Postal Mail' },
]
const APPOINTMENT_TYPES = ['ACADEMIC', 'ADVISING', 'CONSULTATION', 'OFFICE_HOURS', 'OTHER']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PROCUREMENT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const PROCUREMENT_CATEGORIES = [
  'Laboratory Equipment',
  'Office Supply',
  'Software / License',
  'Service Purchase',
  'Furniture',
  'Technical Equipment',
  'Other',
]
const ACCESS_TYPES = ['System / Portal', 'Lab Access', 'Network Resource', 'Software License', 'Campus Area', 'Other']
const EVENT_TYPES = ['Conference', 'Workshop', 'Club Activity', 'Social Event', 'Sports', 'Cultural', 'Academic', 'Other']
const EQUIPMENT_CATEGORIES = [
  'Projector',
  'Laptop / Computer',
  'Camera / Video',
  'Audio Equipment',
  'Drawing Tablet',
  'Measurement Instrument',
  'Other',
]
const INTERNSHIP_TYPES = ['MANDATORY', 'VOLUNTARY', 'SUMMER']
const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID']

type Props = {
  requestId: string
  request: any
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function toDateTimeLocalInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const adjusted = new Date(date.getTime() - offset * 60000)
  return adjusted.toISOString().slice(0, 16)
}

async function updateRequest(requestId: string, payload: Record<string, unknown>) {
  const res = await fetch(`${BACKEND}/student/requests/${requestId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message ?? 'Failed to update request.')
  }
  return data
}

function Header({ requestId, title, description }: { requestId: string; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={`/student/requests/${requestId}`}>
        <Button variant="ghost" size="icon" className="size-8">
          <ArrowLeft className="size-4" />
        </Button>
      </Link>
      <div>
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function Footer({ requestId, isSubmitting, submitLabel }: { requestId: string; isSubmitting: boolean; submitLabel: string }) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-border">
      <Button type="submit" disabled={isSubmitting} className="gap-2">
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
      <Link href={`/student/requests/${requestId}`}>
        <Button type="button" variant="outline">
          Cancel
        </Button>
      </Link>
    </div>
  )
}

function DocumentRevisionForm({ requestId, request }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    documentType: request.formData?.documentType ?? 'TRANSCRIPT',
    language: request.formData?.language ?? 'English',
    copiesCount: String(request.formData?.copiesCount ?? 1),
    deliveryMethod: request.formData?.deliveryMethod ?? 'PICKUP',
    deliveryAddress: request.formData?.deliveryAddress ?? '',
    description: request.formData?.description ?? '',
  })

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await updateRequest(requestId, {
        documentType: form.documentType,
        language: form.language,
        copiesCount: Number(form.copiesCount),
        deliveryMethod: form.deliveryMethod,
        deliveryAddress: form.deliveryAddress || null,
        description: form.description || null,
      })
      toast.success('Request updated and resubmitted.')
      router.push(`/student/requests/${requestId}`)
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to update request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Header requestId={requestId} title="Revise Document Request" description="Update your document request and resubmit it." />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Document Type *</label>
              <select value={form.documentType} onChange={(e) => set('documentType', e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {DOC_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Language</label>
              <select value={form.language} onChange={(e) => set('language', e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="English">English</option>
                <option value="Turkish">Turkish</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Number of Copies</label>
              <input type="number" min={1} max={10} value={form.copiesCount} onChange={(e) => set('copiesCount', e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Delivery Method *</label>
            <div className="grid grid-cols-3 gap-2">
              {DELIVERY_METHODS.map((method) => (
                <button key={method.value} type="button" onClick={() => set('deliveryMethod', method.value)} className={`px-3 py-2 rounded-md border text-sm font-medium ${form.deliveryMethod === method.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
                  {method.label}
                </button>
              ))}
            </div>
          </div>
          {(form.deliveryMethod === 'EMAIL' || form.deliveryMethod === 'MAIL') && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{form.deliveryMethod === 'EMAIL' ? 'Email Address' : 'Postal Address'} *</label>
              <input type={form.deliveryMethod === 'EMAIL' ? 'email' : 'text'} value={form.deliveryAddress} onChange={(e) => set('deliveryAddress', e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          )}
        </div>
        <div className="px-5 py-4 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Additional Notes</label>
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
        </div>
        <div className="px-5 py-4">
          <Footer requestId={requestId} isSubmitting={isSubmitting} submitLabel="Resubmit Request" />
        </div>
      </form>
    </div>
  )
}

function AccessRevisionForm({ requestId, request }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    accessType: request.formData?.accessType ?? 'System / Portal',
    targetResource: request.formData?.targetResource ?? '',
    requestedRoleOrPermission: request.formData?.requestedRoleOrPermission ?? '',
    justification: request.formData?.justification ?? '',
    startAt: toDateInput(request.formData?.startAt),
    endAt: toDateInput(request.formData?.endAt),
  })

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await updateRequest(requestId, {
        accessType: form.accessType,
        targetResource: form.targetResource.trim(),
        requestedRoleOrPermission: form.requestedRoleOrPermission.trim() || null,
        justification: form.justification.trim(),
        startAt: form.startAt || null,
        endAt: form.endAt || null,
      })
      toast.success('Request updated and resubmitted.')
      router.push(`/student/requests/${requestId}`)
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to update request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto pb-20 space-y-6">
      <Header requestId={requestId} title="Revise Access Request" description="Update the access request and resubmit it." />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Access Type</Label>
            <select value={form.accessType} onChange={(e) => set('accessType', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              {ACCESS_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Target Resource / System *</Label>
            <Input value={form.targetResource} onChange={(e) => set('targetResource', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Requested Role / Permission</Label>
          <Input value={form.requestedRoleOrPermission} onChange={(e) => set('requestedRoleOrPermission', e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Access Start Date</Label>
            <Input type="date" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Access End Date</Label>
            <Input type="date" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Justification *</Label>
          <textarea rows={4} value={form.justification} onChange={(e) => set('justification', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" />
        </div>
        <Footer requestId={requestId} isSubmitting={isSubmitting} submitLabel="Resubmit Access Request" />
      </form>
    </div>
  )
}

function ReservationRevisionForm({ requestId, request }: Props) {
  const router = useRouter()
  const [resources, setResources] = useState<any[]>([])
  const [isLoadingResources, setIsLoadingResources] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    resourceId: request.formData?.resourceId ?? '',
    eventName: request.formData?.eventName ?? '',
    reservationPurpose: request.formData?.reservationPurpose ?? '',
    attendeeCount: String(request.formData?.attendeeCount ?? 1),
    startAt: toDateTimeLocalInput(request.formData?.startAt),
    endAt: toDateTimeLocalInput(request.formData?.endAt),
    requiresSecurityApproval: Boolean(request.formData?.requiresSecurityApproval),
    requiresTechnicalSupport: Boolean(request.formData?.requiresTechnicalSupport),
    setupNotes: request.formData?.setupNotes ?? '',
    description: request.formData?.description ?? '',
  })

  const fetchResources = useCallback(async () => {
    try {
      const [roomRes, labRes] = await Promise.all([
        fetch(`${BACKEND}/resources?resourceType=ROOM`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${BACKEND}/resources?resourceType=LAB`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ])
      const rooms = roomRes.ok ? await roomRes.json() : []
      const labs = labRes.ok ? await labRes.json() : []
      setResources([...rooms, ...labs])
    } catch {
      setResources([])
    } finally {
      setIsLoadingResources(false)
    }
  }, [])

  useEffect(() => {
    void fetchResources()
  }, [fetchResources])

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (new Date(form.startAt) >= new Date(form.endAt)) {
      toast.error('End time must be after start time.')
      return
    }
    setIsSubmitting(true)
    try {
      await updateRequest(requestId, {
        resourceId: form.resourceId,
        eventName: form.eventName.trim(),
        reservationPurpose: form.reservationPurpose.trim(),
        attendeeCount: Number(form.attendeeCount),
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        requiresSecurityApproval: form.requiresSecurityApproval,
        requiresTechnicalSupport: form.requiresTechnicalSupport,
        setupNotes: form.setupNotes.trim() || null,
        description: form.description.trim() || null,
      })
      toast.success('Request updated and resubmitted.')
      router.push(`/student/requests/${requestId}`)
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to update request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <Header requestId={requestId} title="Revise Reservation Request" description="Update the reservation details and resubmit it." />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-5 shadow-sm">
        <div className="space-y-1.5">
          <Label>Resource *</Label>
          {isLoadingResources ? (
            <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading resources...
            </div>
          ) : (
            <Select value={form.resourceId} onValueChange={(value) => set('resourceId', value)}>
              <SelectTrigger><SelectValue placeholder="Select a room or resource..." /></SelectTrigger>
              <SelectContent>
                {resources.map((resource) => (
                  <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Event Name *</Label>
            <Input value={form.eventName} onChange={(e) => set('eventName', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Expected Attendees *</Label>
            <Input type="number" min={1} value={form.attendeeCount} onChange={(e) => set('attendeeCount', e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Start *</Label>
            <Input type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>End *</Label>
            <Input type="datetime-local" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Purpose *</Label>
          <Textarea value={form.reservationPurpose} onChange={(e) => set('reservationPurpose', e.target.value)} required className="resize-none min-h-[80px]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer p-3 border border-border rounded-lg">
            <input type="checkbox" checked={form.requiresSecurityApproval} onChange={(e) => set('requiresSecurityApproval', e.target.checked)} />
            <span className="text-sm">Requires Security Approval</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer p-3 border border-border rounded-lg">
            <input type="checkbox" checked={form.requiresTechnicalSupport} onChange={(e) => set('requiresTechnicalSupport', e.target.checked)} />
            <span className="text-sm">Requires Technical Support</span>
          </label>
        </div>
        <div className="space-y-1.5">
          <Label>Setup Notes</Label>
          <Input value={form.setupNotes} onChange={(e) => set('setupNotes', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Additional Description</Label>
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="resize-none min-h-[80px]" />
        </div>
        <Footer requestId={requestId} isSubmitting={isSubmitting} submitLabel="Resubmit Reservation" />
      </form>
    </div>
  )
}

function AppointmentRevisionForm({ requestId, request }: Props) {
  const router = useRouter()
  const [facultyUsers, setFacultyUsers] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    targetUserId: request.formData?.targetUserId ?? '',
    appointmentType: request.formData?.appointmentType ?? '',
    topic: request.formData?.topic ?? '',
    details: request.formData?.details ?? '',
    preferredStartAt: toDateTimeLocalInput(request.formData?.preferredStartAt),
    preferredEndAt: toDateTimeLocalInput(request.formData?.preferredEndAt),
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND}/appointment-requests/faculty-users`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setFacultyUsers(await res.json())
      } finally {
        setIsLoadingUsers(false)
      }
    }
    void load()
  }, [])

  const fetchAvailability = useCallback(async (userId: string) => {
    if (!userId) {
      setAvailability([])
      return
    }
    try {
      const res = await fetch(`${BACKEND}/availability/${userId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setAvailability(res.ok ? await res.json() : [])
    } catch {
      setAvailability([])
    }
  }, [])

  useEffect(() => {
    void fetchAvailability(form.targetUserId)
  }, [fetchAvailability, form.targetUserId])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await updateRequest(requestId, {
        targetUserId: form.targetUserId,
        appointmentType: form.appointmentType,
        topic: form.topic.trim(),
        details: form.details.trim() || null,
        preferredStartAt: form.preferredStartAt ? new Date(form.preferredStartAt).toISOString() : null,
        preferredEndAt: form.preferredEndAt ? new Date(form.preferredEndAt).toISOString() : null,
      })
      toast.success('Request updated and resubmitted.')
      router.push(`/student/requests/${requestId}`)
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to update request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <Header requestId={requestId} title="Revise Appointment Request" description="Update the appointment request and resubmit it." />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-5 shadow-sm">
        <div className="space-y-1.5">
          <Label>Person *</Label>
          {isLoadingUsers ? (
            <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading...
            </div>
          ) : (
            <Select value={form.targetUserId} onValueChange={(value) => setForm((prev) => ({ ...prev, targetUserId: value }))}>
              <SelectTrigger><SelectValue placeholder="Select faculty or staff..." /></SelectTrigger>
              <SelectContent>
                {facultyUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.fullName} - {user.role}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {availability.length > 0 && (
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Availability</p>
            <div className="flex flex-wrap gap-2">
              {availability.filter((slot) => slot.isActive).map((slot: any) => (
                <span key={slot.id} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  {DAY_NAMES[slot.dayOfWeek]} {slot.startTime}-{slot.endTime}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Select value={form.appointmentType} onValueChange={(value) => setForm((prev) => ({ ...prev, appointmentType: value }))}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Topic *</Label>
            <Input value={form.topic} onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))} required />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Preferred Start</Label>
            <Input type="datetime-local" value={form.preferredStartAt} onChange={(e) => setForm((prev) => ({ ...prev, preferredStartAt: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred End</Label>
            <Input type="datetime-local" value={form.preferredEndAt} onChange={(e) => setForm((prev) => ({ ...prev, preferredEndAt: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Details</Label>
          <Textarea value={form.details} onChange={(e) => setForm((prev) => ({ ...prev, details: e.target.value }))} className="resize-none min-h-[80px]" />
        </div>
        <Footer requestId={requestId} isSubmitting={isSubmitting} submitLabel="Resubmit Appointment" />
      </form>
    </div>
  )
}

function ProcurementRevisionForm({ requestId, request }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    itemName: request.formData?.itemName ?? '',
    itemCategory: request.formData?.itemCategory ?? 'Laboratory Equipment',
    quantity: String(request.formData?.quantity ?? 1),
    unitPriceEstimate: request.formData?.unitPriceEstimate != null ? String(request.formData.unitPriceEstimate) : '',
    vendorPreference: request.formData?.vendorPreference ?? '',
    justification: request.formData?.justification ?? '',
    budgetCode: request.formData?.budgetCode ?? '',
    priority: request.formData?.priority ?? 'MEDIUM',
  })

  const setValue = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await updateRequest(requestId, {
        itemName: form.itemName.trim(),
        itemCategory: form.itemCategory,
        quantity: Number(form.quantity),
        unitPriceEstimate: form.unitPriceEstimate.trim() ? Number(form.unitPriceEstimate) : null,
        vendorPreference: form.vendorPreference.trim() || null,
        justification: form.justification.trim(),
        budgetCode: form.budgetCode.trim() || null,
        priority: form.priority,
      })
      toast.success('Request updated and resubmitted.')
      router.push(`/student/requests/${requestId}`)
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to update request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-20">
      <Header requestId={requestId} title="Revise Procurement Request" description="Update the procurement details and resubmit it." />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Item Name *</Label>
            <Input value={form.itemName} onChange={(e) => setValue('itemName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <select value={form.itemCategory} onChange={(e) => setValue('itemCategory', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              {PROCUREMENT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority *</Label>
            <select value={form.priority} onChange={(e) => setValue('priority', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              {PROCUREMENT_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity *</Label>
            <Input type="number" min="1" value={form.quantity} onChange={(e) => setValue('quantity', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Unit Price Estimate</Label>
            <Input type="number" min="0" step="0.01" value={form.unitPriceEstimate} onChange={(e) => setValue('unitPriceEstimate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vendor Preference</Label>
            <Input value={form.vendorPreference} onChange={(e) => setValue('vendorPreference', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Budget Code</Label>
            <Input value={form.budgetCode} onChange={(e) => setValue('budgetCode', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Justification *</Label>
          <textarea rows={5} value={form.justification} onChange={(e) => setValue('justification', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" />
        </div>
        <Footer requestId={requestId} isSubmitting={isSubmitting} submitLabel="Resubmit Procurement" />
      </form>
    </div>
  )
}

function EventRevisionForm({ requestId, request }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    eventName: request.formData?.eventName ?? '',
    eventType: request.formData?.eventType ?? 'Club Activity',
    description: request.formData?.description ?? '',
    expectedAttendance: String(request.formData?.expectedAttendance ?? ''),
    locationPreference: request.formData?.locationPreference ?? '',
    startAt: toDateTimeLocalInput(request.formData?.startAt),
    endAt: toDateTimeLocalInput(request.formData?.endAt),
    needsBudget: Boolean(request.formData?.needsBudget),
    estimatedBudget: request.formData?.estimatedBudget != null ? String(request.formData.estimatedBudget) : '',
    needsPosterApproval: Boolean(request.formData?.needsPosterApproval),
    needsSecuritySupport: Boolean(request.formData?.needsSecuritySupport),
    needsTechnicalSupport: Boolean(request.formData?.needsTechnicalSupport),
  })

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await updateRequest(requestId, {
        eventName: form.eventName.trim(),
        eventType: form.eventType,
        description: form.description.trim(),
        expectedAttendance: Number(form.expectedAttendance),
        locationPreference: form.locationPreference.trim() || null,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        needsBudget: form.needsBudget,
        estimatedBudget: form.needsBudget && form.estimatedBudget ? Number(form.estimatedBudget) : null,
        needsPosterApproval: form.needsPosterApproval,
        needsSecuritySupport: form.needsSecuritySupport,
        needsTechnicalSupport: form.needsTechnicalSupport,
      })
      toast.success('Request updated and resubmitted.')
      router.push(`/student/requests/${requestId}`)
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to update request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto pb-20 space-y-6">
      <Header requestId={requestId} title="Revise Event Request" description="Update the event details and resubmit it." />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="space-y-1.5">
          <Label>Event Name *</Label>
          <Input value={form.eventName} onChange={(e) => set('eventName', e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <select value={form.eventType} onChange={(e) => set('eventType', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              {EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Expected Attendance *</Label>
            <Input type="number" min="1" value={form.expectedAttendance} onChange={(e) => set('expectedAttendance', e.target.value)} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Start Date & Time *</Label>
            <Input type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>End Date & Time *</Label>
            <Input type="datetime-local" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Preferred Location</Label>
          <Input value={form.locationPreference} onChange={(e) => set('locationPreference', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Description *</Label>
          <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" />
        </div>
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <div className="space-y-2">
            {[
              { key: 'needsBudget', label: 'Budget Required' },
              { key: 'needsPosterApproval', label: 'Poster / Announcement Approval' },
              { key: 'needsSecuritySupport', label: 'Security Support' },
              { key: 'needsTechnicalSupport', label: 'Technical Support (AV, IT)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(form as any)[key]} onChange={(e) => set(key, e.target.checked)} className="rounded" />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          {form.needsBudget && (
            <div className="space-y-1.5 mt-2">
              <Label>Estimated Budget</Label>
              <Input type="number" min="0" step="0.01" value={form.estimatedBudget} onChange={(e) => set('estimatedBudget', e.target.value)} />
            </div>
          )}
        </div>
        <Footer requestId={requestId} isSubmitting={isSubmitting} submitLabel="Resubmit Event Request" />
      </form>
    </div>
  )
}

function EquipmentRevisionForm({ requestId, request }: Props) {
  const router = useRouter()
  const [resources, setResources] = useState<any[]>([])
  const [isLoadingResources, setIsLoadingResources] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    labResourceId: request.formData?.labResourceId ?? '',
    equipmentName: request.formData?.equipmentName ?? '',
    equipmentCategory: request.formData?.equipmentCategory ?? 'Projector',
    quantity: String(request.formData?.quantity ?? 1),
    purpose: request.formData?.purpose ?? '',
    neededFrom: toDateInput(request.formData?.neededFrom),
    neededUntil: toDateInput(request.formData?.neededUntil),
    urgencyReason: request.formData?.urgencyReason ?? '',
  })

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/resources?resourceType=EQUIPMENT`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setResources(res.ok ? await res.json() : [])
    } catch {
      setResources([])
    } finally {
      setIsLoadingResources(false)
    }
  }, [])

  useEffect(() => {
    void fetchResources()
  }, [fetchResources])

  const handleResourceSelect = (resourceId: string) => {
    const resource = resources.find((item) => item.id === resourceId)
    setForm((prev) => ({ ...prev, labResourceId: resourceId, equipmentName: resource?.name ?? prev.equipmentName }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await updateRequest(requestId, {
        labResourceId: form.labResourceId || null,
        equipmentName: form.equipmentName.trim(),
        equipmentCategory: form.equipmentCategory,
        quantity: Number(form.quantity),
        purpose: form.purpose.trim(),
        neededFrom: form.neededFrom || null,
        neededUntil: form.neededUntil || null,
        urgencyReason: form.urgencyReason.trim() || null,
      })
      toast.success('Request updated and resubmitted.')
      router.push(`/student/requests/${requestId}`)
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to update request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <Header requestId={requestId} title="Revise Equipment Request" description="Update the equipment request and resubmit it." />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="space-y-1.5">
          <Label>Select from Equipment Catalog</Label>
          {isLoadingResources ? (
            <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading equipment...
            </div>
          ) : (
            <select value={form.labResourceId} onChange={(e) => handleResourceSelect(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              <option value="">Select equipment from catalog</option>
              {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
            </select>
          )}
        </div>
        {!form.labResourceId && (
          <div className="space-y-1.5">
            <Label>Equipment Name / Description *</Label>
            <Input value={form.equipmentName} onChange={(e) => setForm((prev) => ({ ...prev, equipmentName: e.target.value }))} />
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <select value={form.equipmentCategory} onChange={(e) => setForm((prev) => ({ ...prev, equipmentCategory: e.target.value }))} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              {EQUIPMENT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity *</Label>
            <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Needed From</Label>
            <Input type="date" value={form.neededFrom} onChange={(e) => setForm((prev) => ({ ...prev, neededFrom: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Return By</Label>
            <Input type="date" value={form.neededUntil} onChange={(e) => setForm((prev) => ({ ...prev, neededUntil: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Purpose *</Label>
          <textarea rows={3} value={form.purpose} onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" />
        </div>
        <div className="space-y-1.5">
          <Label>Urgency Reason</Label>
          <Input value={form.urgencyReason} onChange={(e) => setForm((prev) => ({ ...prev, urgencyReason: e.target.value }))} />
        </div>
        <Footer requestId={requestId} isSubmitting={isSubmitting} submitLabel="Resubmit Equipment Request" />
      </form>
    </div>
  )
}

function InternshipRevisionForm({ requestId, request }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    companyName: request.formData?.companyName ?? '',
    companySector: request.formData?.companySector ?? '',
    companyContactName: request.formData?.companyContactName ?? '',
    companyContactEmail: request.formData?.companyContactEmail ?? '',
    internshipType: request.formData?.internshipType ?? 'MANDATORY',
    workMode: request.formData?.workMode ?? 'ONSITE',
    startDate: toDateInput(request.formData?.startDate),
    endDate: toDateInput(request.formData?.endDate),
    durationDays: String(request.formData?.durationDays ?? ''),
    insuranceRequired: Boolean(request.formData?.insuranceRequired),
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await updateRequest(requestId, {
        companyName: form.companyName.trim(),
        companySector: form.companySector.trim() || null,
        companyContactName: form.companyContactName.trim() || null,
        companyContactEmail: form.companyContactEmail.trim() || null,
        internshipType: form.internshipType,
        workMode: form.workMode,
        startDate: form.startDate,
        endDate: form.endDate,
        durationDays: Number(form.durationDays) || 0,
        insuranceRequired: form.insuranceRequired,
      })
      toast.success('Request updated and resubmitted.')
      router.push(`/student/requests/${requestId}`)
    } catch (error: any) {
      toast.error(error.message ?? 'Failed to update request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', required = false) => (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      <Input type={type} value={form[key] as string} onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))} required={required} />
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl p-6 pb-20 space-y-6">
      <Header requestId={requestId} title="Revise Internship Application" description="Update the internship application and resubmit it." />
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Company Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('Company Name', 'companyName', 'text', true)}
            {field('Industry / Sector', 'companySector')}
            {field('Contact Person', 'companyContactName')}
            {field('Contact Email', 'companyContactEmail', 'email')}
          </div>
        </div>
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Internship Details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.internshipType} onValueChange={(value) => setForm((prev) => ({ ...prev, internshipType: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERNSHIP_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Work Mode *</Label>
              <Select value={form.workMode} onValueChange={(value) => setForm((prev) => ({ ...prev, workMode: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORK_MODES.map((mode) => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {field('Start Date', 'startDate', 'date', true)}
            {field('End Date', 'endDate', 'date', true)}
            {field('Duration (days)', 'durationDays', 'number')}
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.insuranceRequired} onChange={(e) => setForm((prev) => ({ ...prev, insuranceRequired: e.target.checked }))} />
              <Label>Insurance Required</Label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Link href={`/student/requests/${requestId}`}>
            <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Resubmit Application
          </Button>
        </div>
      </form>
    </div>
  )
}

function UnsupportedRevisionForm({ requestId, request }: Props) {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Header requestId={requestId} title="Revise Request" description="This request type does not have a specialized revision form yet." />
      <div className="rounded-lg border border-border bg-card p-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          Request type: <span className="font-medium text-foreground">{request.typeName ?? request.type}</span>
        </p>
        <Link href={`/student/requests/${requestId}`}>
          <Button variant="outline">Back to Detail</Button>
        </Link>
      </div>
    </div>
  )
}

export function RequestRevisionForm({ requestId, request }: Props) {
  const key = useMemo(() => request?.type, [request?.type])

  switch (key) {
    case 'DOCUMENT_REQUEST':
      return <DocumentRevisionForm requestId={requestId} request={request} />
    case 'ROOM_RESERVATION':
      return <ReservationRevisionForm requestId={requestId} request={request} />
    case 'APPOINTMENT':
      return <AppointmentRevisionForm requestId={requestId} request={request} />
    case 'PROCUREMENT_REQUEST':
      return <ProcurementRevisionForm requestId={requestId} request={request} />
    case 'ACCESS_REQUEST':
      return <AccessRevisionForm requestId={requestId} request={request} />
    case 'EVENT_REQUEST':
      return <EventRevisionForm requestId={requestId} request={request} />
    case 'EQUIPMENT':
      return <EquipmentRevisionForm requestId={requestId} request={request} />
    case 'INTERNSHIP_REQUEST':
      return <InternshipRevisionForm requestId={requestId} request={request} />
    default:
      return <UnsupportedRevisionForm requestId={requestId} request={request} />
  }
}
