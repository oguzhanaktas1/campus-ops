'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Users,
  AlertTriangle,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import {
  getCurrentDateTimeInputValue,
  validateDateWindow,
} from '@/lib/date-time'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  ROOM: 'Room',
  LAB: 'Laboratory',
  EQUIPMENT: 'Equipment',
  VEHICLE: 'Vehicle',
  DESK: 'Desk',
  OTHER: 'Other',
}

export default function OrganizerNewReservationPage() {
  const router = useRouter()
  const [resources, setResources] = useState<any[]>([])
  const [isLoadingResources, setIsLoadingResources] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [dateError, setDateError] = useState<string | null>(null)

  const [form, setForm] = useState({
    resourceId: '',
    eventName: '',
    reservationPurpose: '',
    attendeeCount: '1',
    startAt: '',
    endAt: '',
    requiresSecurityApproval: false,
    requiresTechnicalSupport: false,
    setupNotes: '',
    description: '',
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

  useEffect(() => { void fetchResources() }, [fetchResources])

  const selectedResource = resources.find((r) => r.id === form.resourceId)
  const minDateTime = getCurrentDateTimeInputValue()

  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }))

  const setDateField = (key: 'startAt' | 'endAt', value: string) => {
    const nextForm = { ...form, [key]: value }
    const error = validateDateWindow({
      start: nextForm.startAt,
      end: nextForm.endAt,
      type: 'datetime-local',
      startLabel: 'Baslangic tarihi',
      endLabel: 'Bitis tarihi',
    })
    setForm(nextForm)
    setDateError(error)
    if (error) toast.error(error)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.resourceId) { toast.error('Please select a resource.'); return }
    if (!form.startAt || !form.endAt) { toast.error('Please set start and end time.'); return }
    const validationError = validateDateWindow({
      start: form.startAt,
      end: form.endAt,
      type: 'datetime-local',
      startLabel: 'Baslangic tarihi',
      endLabel: 'Bitis tarihi',
    })
    if (validationError) {
      setDateError(validationError)
      toast.error(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/room-reservation-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          resourceId: form.resourceId,
          eventName: form.eventName.trim(),
          reservationPurpose: form.reservationPurpose.trim(),
          attendeeCount: Math.max(1, parseInt(form.attendeeCount) || 1),
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          requiresSecurityApproval: form.requiresSecurityApproval,
          requiresTechnicalSupport: form.requiresTechnicalSupport,
          setupNotes: form.setupNotes.trim() || undefined,
          description: form.description.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit reservation.')
      }

      if (data.hasConflicts) {
        setConflicts(data.conflicts)
        toast.warning(`Submitted with ${data.conflicts.length} scheduling conflict(s). Staff will review.`)
      } else {
        toast.success('Reservation request submitted successfully!')
      }
      router.push('/organizer/reservations')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/organizer/reservations">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Reserve a Room</h1>
          <p className="text-sm text-muted-foreground">Submit a room or resource reservation request</p>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Scheduling conflicts detected
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                This time slot overlaps with {conflicts.length} existing reservation(s). Your request was submitted and staff will review.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-5 shadow-sm">

        <div className="space-y-1.5">
          <Label>Resource <span className="text-destructive">*</span></Label>
          {isLoadingResources ? (
            <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading resources...
            </div>
          ) : (
            <Select value={form.resourceId} onValueChange={(v) => set('resourceId', v)}>
              <SelectTrigger><SelectValue placeholder="Select a room or resource..." /></SelectTrigger>
              <SelectContent>
                {resources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                    {r.locationText ? ` — ${r.locationText}` : ''}
                    {r.capacity ? ` (cap. ${r.capacity})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedResource && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="size-4 text-primary" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-foreground">{selectedResource.name}</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                <span>{RESOURCE_TYPE_LABEL[selectedResource.resourceType] ?? selectedResource.resourceType}</span>
                {selectedResource.locationText && <span className="flex items-center gap-1"><MapPin className="size-3" />{selectedResource.locationText}</span>}
                {selectedResource.capacity && <span className="flex items-center gap-1"><Users className="size-3" />Capacity: {selectedResource.capacity}</span>}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="eventName">Event Name <span className="text-destructive">*</span></Label>
            <Input
              id="eventName"
              placeholder="e.g. Study Group, Lecture..."
              required
              value={form.eventName}
              onChange={(e) => set('eventName', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attendeeCount">Expected Attendees <span className="text-destructive">*</span></Label>
            <Input
              id="attendeeCount"
              type="number"
              min={1}
              required
              value={form.attendeeCount}
              onChange={(e) => set('attendeeCount', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="startAt">Start <span className="text-destructive">*</span></Label>
            <Input
              id="startAt"
              type="datetime-local"
              required
              min={minDateTime}
              value={form.startAt}
              onChange={(e) => setDateField('startAt', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endAt">End <span className="text-destructive">*</span></Label>
            <Input
              id="endAt"
              type="datetime-local"
              required
              min={form.startAt || minDateTime}
              value={form.endAt}
              onChange={(e) => setDateField('endAt', e.target.value)}
            />
          </div>
        </div>
        {dateError && <p className="text-sm text-destructive">{dateError}</p>}

        <div className="space-y-1.5">
          <Label htmlFor="reservationPurpose">Purpose <span className="text-destructive">*</span></Label>
          <Textarea
            id="reservationPurpose"
            placeholder="Describe the purpose of this reservation..."
            required
            className="resize-none min-h-[80px]"
            value={form.reservationPurpose}
            onChange={(e) => set('reservationPurpose', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'requiresSecurityApproval', label: 'Requires Security Approval' },
            { key: 'requiresTechnicalSupport', label: 'Requires Technical Support' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2.5 cursor-pointer p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                className="size-4 rounded"
                checked={(form as any)[key]}
                onChange={(e) => set(key, e.target.checked)}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="setupNotes">Setup Notes (optional)</Label>
          <Input
            id="setupNotes"
            placeholder="Special setup requirements..."
            value={form.setupNotes}
            onChange={(e) => set('setupNotes', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button type="submit" className="flex-1 sm:flex-none gap-2" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Calendar className="size-4" />}
            Submit Reservation Request
          </Button>
          <Link href="/organizer/reservations">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
