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
import { useOptionalT } from '@/lib/optional-t'

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
const IT_CATEGORIES = [
  'Hardware',
  'Software',
  'Network / Connectivity',
  'Account / Access',
  'Printer / Peripheral',
  'Email / Collaboration',
  'Security',
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
  portal?: string
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

async function updateRequest(endpoint: string, payload: Record<string, unknown>) {
  const res = await fetch(`${BACKEND}/${endpoint}`, {
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

function Header({ backPath, title, description }: { backPath: string; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3">
      <Link href={backPath}>
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

function Footer({ backPath, isSubmitting, submitLabel, cancelLabel }: { backPath: string; isSubmitting: boolean; submitLabel: string; cancelLabel: string }) {
  return (
    <div className="flex items-center gap-3 pt-4 border-t border-border">
      <Button type="submit" disabled={isSubmitting} className="gap-2">
        {isSubmitting && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
      <Link href={backPath}>
        <Button type="button" variant="outline">
          {cancelLabel}
        </Button>
      </Link>
    </div>
  )
}

function DocumentRevisionForm({ requestId, request, portal = 'student' }: Props) {
  const tt = useOptionalT()
  const router = useRouter()
  const backPath = `/${portal}/requests/${requestId}`
  const [isSubmitting, setIsSubmitting] = useState(false)
  const DOC_TYPES = [
    { value: 'TRANSCRIPT', label: tt('forms.docTranscript', 'Transcript') },
    { value: 'ENROLLMENT_CERTIFICATE', label: tt('forms.docEnrollmentCert', 'Enrollment Certificate') },
    { value: 'STUDENT_CERTIFICATE', label: tt('forms.docStudentCert', 'Student Certificate') },
    { value: 'DIPLOMA', label: tt('forms.docDiploma', 'Diploma') },
    { value: 'OTHER', label: tt('forms.docOther', 'Other') },
  ]
  const DELIVERY_METHODS = [
    { value: 'PICKUP', label: tt('forms.deliveryPickup', 'Pickup from Office') },
    { value: 'EMAIL', label: tt('forms.deliveryEmail', 'Send via Email') },
    { value: 'MAIL', label: tt('forms.deliveryMail', 'Postal Mail') },
  ]
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
      await updateRequest(`${portal}/requests/${requestId}`, {
        documentType: form.documentType,
        language: form.language,
        copiesCount: Number(form.copiesCount),
        deliveryMethod: form.deliveryMethod,
        deliveryAddress: form.deliveryAddress || null,
        description: form.description || null,
      })
      toast.success(tt('forms.revUpdated', 'Request updated and resubmitted.'))
      router.push(backPath)
    } catch (error: any) {
      toast.error(error.message ?? tt('forms.revUpdateFail', 'Failed to update request.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Header backPath={backPath} title={tt('forms.revDocTitle', 'Revise Document Request')} description={tt('forms.revDocDesc', 'Update your document request and resubmit it.')} />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{tt('forms.documentType', 'Document Type')} *</label>
              <select value={form.documentType} onChange={(e) => set('documentType', e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {DOC_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{tt('forms.language', 'Language')}</label>
              <select value={form.language} onChange={(e) => set('language', e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="English">{tt('forms.langEnglish', 'English')}</option>
                <option value="Turkish">{tt('forms.langTurkish', 'Turkish')}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{tt('forms.copies', 'Number of Copies')}</label>
              <input type="number" min={1} max={10} value={form.copiesCount} onChange={(e) => set('copiesCount', e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{tt('forms.deliveryMethod', 'Delivery Method')} *</label>
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
              <label className="text-xs font-medium text-muted-foreground">{form.deliveryMethod === 'EMAIL' ? tt('forms.emailAddress', 'Email Address') : tt('forms.postalAddress', 'Postal Address')} *</label>
              <input type={form.deliveryMethod === 'EMAIL' ? 'email' : 'text'} value={form.deliveryAddress} onChange={(e) => set('deliveryAddress', e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
          )}
        </div>
        <div className="px-5 py-4 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{tt('forms.additionalNotes', 'Additional Notes')}</label>
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" />
        </div>
        <div className="px-5 py-4">
          <Footer backPath={backPath} isSubmitting={isSubmitting} submitLabel={tt('forms.revSubmitDoc', 'Resubmit Request')} cancelLabel={tt('forms.cancel', 'Cancel')} />
        </div>
      </form>
    </div>
  )
}

function AccessRevisionForm({ requestId, request, portal = 'student' }: Props) {
  const tt = useOptionalT()
  const router = useRouter()
  const backPath = `/${portal}/requests/${requestId}`
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
      await updateRequest(`${portal}/requests/${requestId}`, {
        accessType: form.accessType,
        targetResource: form.targetResource.trim(),
        requestedRoleOrPermission: form.requestedRoleOrPermission.trim() || null,
        justification: form.justification.trim(),
        startAt: form.startAt || null,
        endAt: form.endAt || null,
      })
      toast.success(tt('forms.revUpdated', 'Request updated and resubmitted.'))
      router.push(backPath)
    } catch (error: any) {
      toast.error(error.message ?? tt('forms.revUpdateFail', 'Failed to update request.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto pb-20 space-y-6">
      <Header backPath={backPath} title={tt('forms.revAccessTitle', 'Revise Access Request')} description={tt('forms.revAccessDesc', 'Update the access request and resubmit it.')} />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{tt('forms.accessType', 'Access Type')}</Label>
            <select value={form.accessType} onChange={(e) => set('accessType', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              {ACCESS_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.targetResource', 'Target Resource / System')} *</Label>
            <Input value={form.targetResource} onChange={(e) => set('targetResource', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.requestedPermission', 'Requested Role / Permission')}</Label>
          <Input value={form.requestedRoleOrPermission} onChange={(e) => set('requestedRoleOrPermission', e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{tt('forms.accessStartDateOptional', 'Access Start Date')}</Label>
            <Input type="date" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.accessEndDateOptional', 'Access End Date')}</Label>
            <Input type="date" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.justification', 'Justification')} *</Label>
          <textarea rows={4} value={form.justification} onChange={(e) => set('justification', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" />
        </div>
        <Footer backPath={backPath} isSubmitting={isSubmitting} submitLabel={tt('forms.revSubmitAccess', 'Resubmit Access Request')} cancelLabel={tt('forms.cancel', 'Cancel')} />
      </form>
    </div>
  )
}

function ReservationRevisionForm({ requestId, request, portal = 'student' }: Props) {
  const tt = useOptionalT()
  const router = useRouter()
  const backPath = `/${portal}/requests/${requestId}`
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
      toast.error(tt('forms.revEndAfterStart', 'End time must be after start time.'))
      return
    }
    setIsSubmitting(true)
    try {
      await updateRequest(`${portal}/requests/${requestId}`, {
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
      toast.success(tt('forms.revUpdated', 'Request updated and resubmitted.'))
      router.push(backPath)
    } catch (error: any) {
      toast.error(error.message ?? tt('forms.revUpdateFail', 'Failed to update request.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <Header backPath={backPath} title={tt('forms.revReservTitle', 'Revise Reservation Request')} description={tt('forms.revReservDesc', 'Update the reservation details and resubmit it.')} />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-5 shadow-sm">
        <div className="space-y-1.5">
          <Label>{tt('forms.resource', 'Resource')} *</Label>
          {isLoadingResources ? (
            <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {tt('forms.loadingResources', 'Loading resources...')}
            </div>
          ) : (
            <Select value={form.resourceId} onValueChange={(value) => set('resourceId', value)}>
              <SelectTrigger><SelectValue placeholder={tt('forms.resourcePlaceholder', 'Select a room or resource...')} /></SelectTrigger>
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
            <Label>{tt('forms.eventName', 'Event Name')} *</Label>
            <Input value={form.eventName} onChange={(e) => set('eventName', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.expectedAttendees', 'Expected Attendees')} *</Label>
            <Input type="number" min={1} value={form.attendeeCount} onChange={(e) => set('attendeeCount', e.target.value)} required />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{tt('forms.start', 'Start')} *</Label>
            <Input type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.end', 'End')} *</Label>
            <Input type="datetime-local" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.purpose', 'Purpose')} *</Label>
          <Textarea value={form.reservationPurpose} onChange={(e) => set('reservationPurpose', e.target.value)} required className="resize-none min-h-[80px]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2.5 cursor-pointer p-3 border border-border rounded-lg">
            <input type="checkbox" checked={form.requiresSecurityApproval} onChange={(e) => set('requiresSecurityApproval', e.target.checked)} />
            <span className="text-sm">{tt('forms.requiresSecurityApproval', 'Requires Security Approval')}</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer p-3 border border-border rounded-lg">
            <input type="checkbox" checked={form.requiresTechnicalSupport} onChange={(e) => set('requiresTechnicalSupport', e.target.checked)} />
            <span className="text-sm">{tt('forms.requiresTechnicalSupport', 'Requires Technical Support')}</span>
          </label>
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.setupNotesOptional', 'Setup Notes')}</Label>
          <Input value={form.setupNotes} onChange={(e) => set('setupNotes', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.description', 'Additional Description')}</Label>
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} className="resize-none min-h-[80px]" />
        </div>
        <Footer backPath={backPath} isSubmitting={isSubmitting} submitLabel={tt('forms.revSubmitReserv', 'Resubmit Reservation')} cancelLabel={tt('forms.cancel', 'Cancel')} />
      </form>
    </div>
  )
}

function AppointmentRevisionForm({ requestId, request, portal = 'student' }: Props) {
  const tt = useOptionalT()
  const router = useRouter()
  const backPath = `/${portal}/requests/${requestId}`
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
      await updateRequest(`${portal}/requests/${requestId}`, {
        targetUserId: form.targetUserId,
        appointmentType: form.appointmentType,
        topic: form.topic.trim(),
        details: form.details.trim() || null,
        preferredStartAt: form.preferredStartAt ? new Date(form.preferredStartAt).toISOString() : null,
        preferredEndAt: form.preferredEndAt ? new Date(form.preferredEndAt).toISOString() : null,
      })
      toast.success(tt('forms.revUpdated', 'Request updated and resubmitted.'))
      router.push(backPath)
    } catch (error: any) {
      toast.error(error.message ?? tt('forms.revUpdateFail', 'Failed to update request.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <Header backPath={backPath} title={tt('forms.revApptTitle', 'Revise Appointment Request')} description={tt('forms.revApptDesc', 'Update the appointment request and resubmit it.')} />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-5 shadow-sm">
        <div className="space-y-1.5">
          <Label>{tt('forms.person', 'Person')} *</Label>
          {isLoadingUsers ? (
            <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {tt('forms.loading', 'Loading...')}
            </div>
          ) : (
            <Select value={form.targetUserId} onValueChange={(value) => setForm((prev) => ({ ...prev, targetUserId: value }))}>
              <SelectTrigger><SelectValue placeholder={tt('forms.personPlaceholder', 'Select faculty or staff...')} /></SelectTrigger>
              <SelectContent>
                {facultyUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.fullName} - {user.role}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        {availability.length > 0 && (
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">{tt('forms.availability', 'Availability')}</p>
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
            <Label>{tt('forms.type', 'Type')} *</Label>
            <Select value={form.appointmentType} onValueChange={(value) => setForm((prev) => ({ ...prev, appointmentType: value }))}>
              <SelectTrigger><SelectValue placeholder={tt('forms.typePlaceholder', 'Select type...')} /></SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.topic', 'Topic')} *</Label>
            <Input value={form.topic} onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))} required />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{tt('forms.preferredStart', 'Preferred Start')}</Label>
            <Input type="datetime-local" value={form.preferredStartAt} onChange={(e) => setForm((prev) => ({ ...prev, preferredStartAt: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.preferredEnd', 'Preferred End')}</Label>
            <Input type="datetime-local" value={form.preferredEndAt} onChange={(e) => setForm((prev) => ({ ...prev, preferredEndAt: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.detailsOptional', 'Details')}</Label>
          <Textarea value={form.details} onChange={(e) => setForm((prev) => ({ ...prev, details: e.target.value }))} className="resize-none min-h-[80px]" />
        </div>
        <Footer backPath={backPath} isSubmitting={isSubmitting} submitLabel={tt('forms.revSubmitAppt', 'Resubmit Appointment')} cancelLabel={tt('forms.cancel', 'Cancel')} />
      </form>
    </div>
  )
}

function ProcurementRevisionForm({ requestId, request, portal = 'student' }: Props) {
  const tt = useOptionalT()
  const router = useRouter()
  const backPath = `/${portal}/requests/${requestId}`
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
      await updateRequest(`${portal}/requests/${requestId}`, {
        itemName: form.itemName.trim(),
        itemCategory: form.itemCategory,
        quantity: Number(form.quantity),
        unitPriceEstimate: form.unitPriceEstimate.trim() ? Number(form.unitPriceEstimate) : null,
        vendorPreference: form.vendorPreference.trim() || null,
        justification: form.justification.trim(),
        budgetCode: form.budgetCode.trim() || null,
        priority: form.priority,
      })
      toast.success(tt('forms.revUpdated', 'Request updated and resubmitted.'))
      router.push(backPath)
    } catch (error: any) {
      toast.error(error.message ?? tt('forms.revUpdateFail', 'Failed to update request.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-20">
      <Header backPath={backPath} title={tt('forms.revProcTitle', 'Revise Procurement Request')} description={tt('forms.revProcDesc', 'Update the procurement details and resubmit it.')} />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{tt('forms.itemName', 'Item Name')} *</Label>
            <Input value={form.itemName} onChange={(e) => setValue('itemName', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.category', 'Category')}</Label>
            <select value={form.itemCategory} onChange={(e) => setValue('itemCategory', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              {PROCUREMENT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{tt('common.priority', 'Priority')} *</Label>
            <select value={form.priority} onChange={(e) => setValue('priority', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              {PROCUREMENT_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.quantity', 'Quantity')} *</Label>
            <Input type="number" min="1" value={form.quantity} onChange={(e) => setValue('quantity', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.unitPriceEstimate', 'Unit Price Estimate')}</Label>
            <Input type="number" min="0" step="0.01" value={form.unitPriceEstimate} onChange={(e) => setValue('unitPriceEstimate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.vendorPreference', 'Vendor Preference')}</Label>
            <Input value={form.vendorPreference} onChange={(e) => setValue('vendorPreference', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.budgetCode', 'Budget Code')}</Label>
            <Input value={form.budgetCode} onChange={(e) => setValue('budgetCode', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.justification', 'Justification')} *</Label>
          <textarea rows={5} value={form.justification} onChange={(e) => setValue('justification', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" />
        </div>
        <Footer backPath={backPath} isSubmitting={isSubmitting} submitLabel={tt('forms.revSubmitProc', 'Resubmit Procurement')} cancelLabel={tt('forms.cancel', 'Cancel')} />
      </form>
    </div>
  )
}

function EventRevisionForm({ requestId, request, portal = 'student' }: Props) {
  const tt = useOptionalT()
  const router = useRouter()
  const backPath = `/${portal}/requests/${requestId}`
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
      await updateRequest(`${portal}/requests/${requestId}`, {
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
      toast.success(tt('forms.revUpdated', 'Request updated and resubmitted.'))
      router.push(backPath)
    } catch (error: any) {
      toast.error(error.message ?? tt('forms.revUpdateFail', 'Failed to update request.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto pb-20 space-y-6">
      <Header backPath={backPath} title={tt('forms.revEventTitle', 'Revise Event Request')} description={tt('forms.revEventDesc', 'Update the event details and resubmit it.')} />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="space-y-1.5">
          <Label>{tt('forms.eventName', 'Event Name')} *</Label>
          <Input value={form.eventName} onChange={(e) => set('eventName', e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{tt('forms.eventType', 'Event Type')}</Label>
            <select value={form.eventType} onChange={(e) => set('eventType', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              {EVENT_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.expectedAttendance', 'Expected Attendance')} *</Label>
            <Input type="number" min="1" value={form.expectedAttendance} onChange={(e) => set('expectedAttendance', e.target.value)} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{tt('forms.startDateTime', 'Start Date & Time')} *</Label>
            <Input type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.endDateTime', 'End Date & Time')} *</Label>
            <Input type="datetime-local" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.preferredLocation', 'Preferred Location')}</Label>
          <Input value={form.locationPreference} onChange={(e) => set('locationPreference', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.description', 'Description')} *</Label>
          <textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" />
        </div>
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <div className="space-y-2">
            {[
              { key: 'needsBudget', label: tt('forms.budgetRequired', 'Budget Required') },
              { key: 'needsPosterApproval', label: tt('forms.posterApproval', 'Poster / Announcement Approval') },
              { key: 'needsSecuritySupport', label: tt('forms.securitySupport', 'Security Support') },
              { key: 'needsTechnicalSupport', label: tt('forms.technicalSupport', 'Technical Support (AV, IT)') },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(form as any)[key]} onChange={(e) => set(key, e.target.checked)} className="rounded" />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          {form.needsBudget && (
            <div className="space-y-1.5 mt-2">
              <Label>{tt('forms.estimatedBudget', 'Estimated Budget')}</Label>
              <Input type="number" min="0" step="0.01" value={form.estimatedBudget} onChange={(e) => set('estimatedBudget', e.target.value)} />
            </div>
          )}
        </div>
        <Footer backPath={backPath} isSubmitting={isSubmitting} submitLabel={tt('forms.revSubmitEvent', 'Resubmit Event Request')} cancelLabel={tt('forms.cancel', 'Cancel')} />
      </form>
    </div>
  )
}

function EquipmentRevisionForm({ requestId, request, portal = 'student' }: Props) {
  const tt = useOptionalT()
  const router = useRouter()
  const backPath = `/${portal}/requests/${requestId}`
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
      await updateRequest(`${portal}/requests/${requestId}`, {
        labResourceId: form.labResourceId || null,
        equipmentName: form.equipmentName.trim(),
        equipmentCategory: form.equipmentCategory,
        quantity: Number(form.quantity),
        purpose: form.purpose.trim(),
        neededFrom: form.neededFrom || null,
        neededUntil: form.neededUntil || null,
        urgencyReason: form.urgencyReason.trim() || null,
      })
      toast.success(tt('forms.revUpdated', 'Request updated and resubmitted.'))
      router.push(backPath)
    } catch (error: any) {
      toast.error(error.message ?? tt('forms.revUpdateFail', 'Failed to update request.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <Header backPath={backPath} title={tt('forms.revEquipTitle', 'Revise Equipment Request')} description={tt('forms.revEquipDesc', 'Update the equipment request and resubmit it.')} />
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="space-y-1.5">
          <Label>{tt('forms.equipmentCatalogOptional', 'Select from Equipment Catalog')}</Label>
          {isLoadingResources ? (
            <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {tt('forms.loadingEquipment', 'Loading equipment...')}
            </div>
          ) : (
            <select value={form.labResourceId} onChange={(e) => handleResourceSelect(e.target.value)} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              <option value="">{tt('forms.selectEquipmentCatalog', 'Select equipment from catalog')}</option>
              {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
            </select>
          )}
        </div>
        {!form.labResourceId && (
          <div className="space-y-1.5">
            <Label>{tt('forms.equipmentName', 'Equipment Name / Description')} *</Label>
            <Input value={form.equipmentName} onChange={(e) => setForm((prev) => ({ ...prev, equipmentName: e.target.value }))} />
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{tt('forms.category', 'Category')}</Label>
            <select value={form.equipmentCategory} onChange={(e) => setForm((prev) => ({ ...prev, equipmentCategory: e.target.value }))} className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm">
              {EQUIPMENT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.quantity', 'Quantity')} *</Label>
            <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{tt('forms.neededFromOptional', 'Needed From')}</Label>
            <Input type="date" value={form.neededFrom} onChange={(e) => setForm((prev) => ({ ...prev, neededFrom: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{tt('forms.returnByOptional', 'Return By')}</Label>
            <Input type="date" value={form.neededUntil} onChange={(e) => setForm((prev) => ({ ...prev, neededUntil: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.purpose', 'Purpose')} *</Label>
          <textarea rows={3} value={form.purpose} onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))} className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none" />
        </div>
        <div className="space-y-1.5">
          <Label>{tt('forms.urgencyReasonOptional', 'Urgency Reason')}</Label>
          <Input value={form.urgencyReason} onChange={(e) => setForm((prev) => ({ ...prev, urgencyReason: e.target.value }))} />
        </div>
        <Footer backPath={backPath} isSubmitting={isSubmitting} submitLabel={tt('forms.revSubmitEquip', 'Resubmit Equipment Request')} cancelLabel={tt('forms.cancel', 'Cancel')} />
      </form>
    </div>
  )
}

function InternshipRevisionForm({ requestId, request, portal = 'student' }: Props) {
  const tt = useOptionalT()
  const router = useRouter()
  const backPath = `/${portal}/requests/${requestId}`
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
      await updateRequest(`${portal}/requests/${requestId}`, {
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
      toast.success(tt('forms.revUpdated', 'Request updated and resubmitted.'))
      router.push(backPath)
    } catch (error: any) {
      toast.error(error.message ?? tt('forms.revUpdateFail', 'Failed to update request.'))
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
      <Header backPath={backPath} title={tt('forms.revInternTitle', 'Revise Internship Application')} description={tt('forms.revInternDesc', 'Update the internship application and resubmit it.')} />
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">{tt('forms.companyInfo', 'Company Information')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field(tt('forms.companyName', 'Company Name'), 'companyName', 'text', true)}
            {field(tt('forms.industrySector', 'Industry / Sector'), 'companySector')}
            {field(tt('forms.contactPerson', 'Contact Person'), 'companyContactName')}
            {field(tt('forms.contactEmail', 'Contact Email'), 'companyContactEmail', 'email')}
          </div>
        </div>
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">{tt('forms.internshipDetails', 'Internship Details')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{tt('forms.type', 'Type')} *</Label>
              <Select value={form.internshipType} onValueChange={(value) => setForm((prev) => ({ ...prev, internshipType: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERNSHIP_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tt('forms.workMode', 'Work Mode')} *</Label>
              <Select value={form.workMode} onValueChange={(value) => setForm((prev) => ({ ...prev, workMode: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORK_MODES.map((mode) => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {field(tt('forms.startDate', 'Start Date'), 'startDate', 'date', true)}
            {field(tt('forms.endDate', 'End Date'), 'endDate', 'date', true)}
            {field(tt('forms.durationDays', 'Duration (days)'), 'durationDays', 'number')}
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.insuranceRequired} onChange={(e) => setForm((prev) => ({ ...prev, insuranceRequired: e.target.checked }))} />
              <Label>{tt('forms.insuranceRequired', 'Insurance Required')}</Label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Link href={backPath}>
            <Button type="button" variant="outline" disabled={isSubmitting}>{tt('forms.cancel', 'Cancel')}</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {tt('forms.revSubmitIntern', 'Resubmit Application')}
          </Button>
        </div>
      </form>
    </div>
  )
}

function ItTicketRevisionForm({ requestId, request, portal = 'faculty' }: Props) {
  const tt = useOptionalT()
  const router = useRouter()
  const backPath = `/${portal}/requests/${requestId}`
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: request.title ?? '',
    category: request.formData?.category ?? '',
    description: request.formData?.description ?? request.description ?? '',
    priority: request.priority ?? 'MEDIUM',
    affectedSystem: request.formData?.affectedSystem ?? '',
    locationText: request.formData?.locationText ?? '',
    subcategory: request.formData?.subcategory ?? '',
  })

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await updateRequest(`${portal}/requests/${requestId}`, {
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim() || null,
        priority: form.priority,
        affectedSystem: form.affectedSystem.trim() || null,
        locationText: form.locationText.trim() || null,
        subcategory: form.subcategory.trim() || null,
      })
      toast.success(tt('forms.revTicketUpdated', 'Ticket updated and resubmitted.'))
      router.push(backPath)
    } catch (error: any) {
      toast.error(error.message ?? tt('forms.revTicketFail', 'Failed to update ticket.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 pb-20">
      <Header backPath={backPath} title={tt('forms.revItTitle', 'Revise IT Ticket')} description={tt('forms.revItDesc', 'Update the ticket details and resubmit it to IT.')} />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          <Label>{tt('tickets.title', 'Title')} *</Label>
          <Input
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder={tt('forms.itTitlePlaceholder', 'Printer not working in faculty office')}
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{tt('tickets.category', 'Category')} *</Label>
            <Select value={form.category} onValueChange={(value) => set('category', value)} required>
              <SelectTrigger>
                <SelectValue placeholder={tt('forms.itCategoryPlaceholder', 'Select category...')} />
              </SelectTrigger>
              <SelectContent>
                {IT_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{tt('common.priority', 'Priority')}</Label>
            <Select value={form.priority} onValueChange={(value) => set('priority', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROCUREMENT_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{tt('forms.itAffectedSystem', 'Affected System')}</Label>
            <Input
              value={form.affectedSystem}
              onChange={(event) => set('affectedSystem', event.target.value)}
              placeholder={tt('forms.itAffectedSystemPlaceholder', 'Printer / Wi-Fi / LMS')}
            />
          </div>

          <div className="space-y-2">
            <Label>{tt('tickets.location', 'Location')}</Label>
            <Input
              value={form.locationText}
              onChange={(event) => set('locationText', event.target.value)}
              placeholder={tt('forms.itLocationPlaceholder', 'Engineering Building, Room 214')}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{tt('forms.itSubcategory', 'Subcategory')}</Label>
          <Input
            value={form.subcategory}
            onChange={(event) => set('subcategory', event.target.value)}
            placeholder={tt('forms.itSubcategoryPlaceholder', 'VPN, Outlook, printer driver...')}
          />
        </div>

        <div className="space-y-2">
          <Label>{tt('tickets.description', 'Description')}</Label>
          <Textarea
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder={tt('forms.itDescriptionPlaceholder', 'Describe the issue, what you tried, and when it started.')}
            rows={6}
          />
        </div>

        <Footer backPath={backPath} isSubmitting={isSubmitting} submitLabel={tt('forms.revSubmitTicket', 'Resubmit Ticket')} cancelLabel={tt('forms.cancel', 'Cancel')} />
      </form>
    </div>
  )
}

function UnsupportedRevisionForm({ requestId, request, portal = 'student' }: Props) {
  const tt = useOptionalT()
  const backPath = `/${portal}/requests/${requestId}`
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Header backPath={backPath} title={tt('forms.revGenericTitle', 'Revise Request')} description={tt('forms.revGenericDesc', 'This request type does not have a specialized revision form yet.')} />
      <div className="rounded-lg border border-border bg-card p-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          {tt('forms.requestType', 'Request type')}: <span className="font-medium text-foreground">{request.typeName ?? request.type}</span>
        </p>
        <Link href={backPath}>
          <Button variant="outline">{tt('forms.backToDetail', 'Back to Detail')}</Button>
        </Link>
      </div>
    </div>
  )
}

export function RequestRevisionForm({ requestId, request, portal = 'student' }: Props) {
  const key = useMemo(() => request?.type, [request?.type])

  switch (key) {
    case 'DOCUMENT_REQUEST':
      return <DocumentRevisionForm requestId={requestId} request={request} portal={portal} />
    case 'ROOM_RESERVATION':
      return <ReservationRevisionForm requestId={requestId} request={request} portal={portal} />
    case 'APPOINTMENT':
      return <AppointmentRevisionForm requestId={requestId} request={request} portal={portal} />
    case 'PROCUREMENT_REQUEST':
      return <ProcurementRevisionForm requestId={requestId} request={request} portal={portal} />
    case 'ACCESS_REQUEST':
      return <AccessRevisionForm requestId={requestId} request={request} portal={portal} />
    case 'EVENT_REQUEST':
      return <EventRevisionForm requestId={requestId} request={request} portal={portal} />
    case 'EQUIPMENT':
      return <EquipmentRevisionForm requestId={requestId} request={request} portal={portal} />
    case 'INTERNSHIP_REQUEST':
      return <InternshipRevisionForm requestId={requestId} request={request} portal={portal} />
    case 'IT_SUPPORT':
    case 'IT_TICKET':
      return <ItTicketRevisionForm requestId={requestId} request={request} portal={portal} />
    default:
      return <UnsupportedRevisionForm requestId={requestId} request={request} portal={portal} />
  }
}
