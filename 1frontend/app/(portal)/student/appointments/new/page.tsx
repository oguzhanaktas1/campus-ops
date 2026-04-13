'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Calendar, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import {
  getCurrentDateTimeInputValue,
  validateDateWindow,
} from '@/lib/date-time'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const APPOINTMENT_TYPES = ['ACADEMIC', 'ADVISING', 'CONSULTATION', 'OFFICE_HOURS', 'OTHER']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function NewAppointmentPage() {
  const router = useRouter()
  const [facultyUsers, setFacultyUsers] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const [form, setForm] = useState({
    targetUserId: '',
    appointmentType: '',
    topic: '',
    details: '',
    preferredStartAt: '',
    preferredEndAt: '',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND}/appointment-requests/faculty-users`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setFacultyUsers(await res.json())
      } catch { /* silent */ } finally { setIsLoadingUsers(false) }
    }
    void load()
  }, [])

  const fetchAvailability = useCallback(async (userId: string) => {
    if (!userId) { setAvailability([]); return }
    try {
      const res = await fetch(`${BACKEND}/availability/${userId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setAvailability(res.ok ? await res.json() : [])
    } catch { setAvailability([]) }
  }, [])

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }))
  const minDateTime = getCurrentDateTimeInputValue()

  const setDateField = (key: 'preferredStartAt' | 'preferredEndAt', value: string) => {
    const nextForm = { ...form, [key]: value }
    const error = validateDateWindow({
      start: nextForm.preferredStartAt,
      end: nextForm.preferredEndAt,
      type: 'datetime-local',
      startLabel: 'Baslangic tarihi',
      endLabel: 'Bitis tarihi',
    })
    setForm(nextForm)
    setDateError(error)
    if (error) toast.error(error)
  }

  const handleTargetChange = (userId: string) => {
    set('targetUserId', userId)
    void fetchAvailability(userId)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.targetUserId) { toast.error('Please select a person.'); return }
    if (!form.appointmentType) { toast.error('Please select appointment type.'); return }
    if (!form.topic.trim()) { toast.error('Please enter a topic.'); return }
    const validationError = validateDateWindow({
      start: form.preferredStartAt,
      end: form.preferredEndAt,
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
      const res = await fetch(`${BACKEND}/appointment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          targetUserId: form.targetUserId,
          appointmentType: form.appointmentType,
          topic: form.topic.trim(),
          details: form.details.trim() || undefined,
          preferredStartAt: form.preferredStartAt
            ? new Date(form.preferredStartAt).toISOString()
            : undefined,
          preferredEndAt: form.preferredEndAt
            ? new Date(form.preferredEndAt).toISOString()
            : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to submit.')
      toast.success('Appointment request submitted!')
      router.push('/student/appointments')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedUser = facultyUsers.find((u) => u.id === form.targetUserId)

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/student/appointments">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Book an Appointment</h1>
          <p className="text-sm text-muted-foreground">Request a meeting with faculty or staff</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-5 shadow-sm">

        {/* Target user */}
        <div className="space-y-1.5">
          <Label>Person <span className="text-destructive">*</span></Label>
          {isLoadingUsers ? (
            <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading...
            </div>
          ) : (
            <Select value={form.targetUserId} onValueChange={handleTargetChange}>
              <SelectTrigger><SelectValue placeholder="Select faculty or staff..." /></SelectTrigger>
              <SelectContent>
                {facultyUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName} — {u.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedUser && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
              {selectedUser.fullName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedUser.fullName}</p>
              <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
            </div>
          </div>
        )}

        {/* Availability slots */}
        {availability.length > 0 && (
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="size-3.5" /> Availability
            </p>
            <div className="flex flex-wrap gap-2">
              {availability.filter((s) => s.isActive).map((s: any) => (
                <span
                  key={s.id}
                  className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full"
                >
                  {DAY_NAMES[s.dayOfWeek]} {s.startTime}–{s.endTime}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Type + topic */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Type <span className="text-destructive">*</span></Label>
            <Select value={form.appointmentType} onValueChange={(v) => set('appointmentType', v)}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="topic">Topic <span className="text-destructive">*</span></Label>
            <Input
              id="topic"
              placeholder="e.g. Thesis review..."
              required
              value={form.topic}
              onChange={(e) => set('topic', e.target.value)}
            />
          </div>
        </div>

        {/* Preferred times */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="preferredStartAt">Preferred Start</Label>
            <Input
              id="preferredStartAt"
              type="datetime-local"
              min={minDateTime}
              value={form.preferredStartAt}
              onChange={(e) => setDateField('preferredStartAt', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preferredEndAt">Preferred End</Label>
            <Input
              id="preferredEndAt"
              type="datetime-local"
              min={form.preferredStartAt || minDateTime}
              value={form.preferredEndAt}
              onChange={(e) => setDateField('preferredEndAt', e.target.value)}
            />
          </div>
        </div>
        {dateError && <p className="text-sm text-destructive">{dateError}</p>}

        {/* Details */}
        <div className="space-y-1.5">
          <Label htmlFor="details">Details (optional)</Label>
          <Textarea
            id="details"
            placeholder="Additional context or questions..."
            className="resize-none min-h-[80px]"
            value={form.details}
            onChange={(e) => set('details', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button type="submit" className="flex-1 sm:flex-none gap-2" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Calendar className="size-4" />}
            Submit Request
          </Button>
          <Link href="/student/appointments">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
