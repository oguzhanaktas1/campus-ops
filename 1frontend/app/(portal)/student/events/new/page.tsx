'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, PartyPopper } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const EVENT_TYPES = ['Conference', 'Workshop', 'Club Activity', 'Social Event', 'Sports', 'Cultural', 'Academic', 'Other']

export default function NewStudentEventPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    eventName: '',
    eventType: 'Club Activity',
    description: '',
    expectedAttendance: '',
    locationPreference: '',
    startAt: '',
    endAt: '',
    needsBudget: false,
    estimatedBudget: '',
    needsPosterApproval: false,
    needsSecuritySupport: false,
    needsTechnicalSupport: false,
  })

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.eventName.trim() || !form.startAt || !form.endAt || !form.expectedAttendance) {
      toast.error('Please fill in all required fields.')
      return
    }
    setIsSubmitting(true)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          ...form,
          expectedAttendance: parseInt(form.expectedAttendance),
          estimatedBudget: form.estimatedBudget ? parseFloat(form.estimatedBudget) : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`Event request ${data.requestNo} submitted.`)
      router.push('/student/events')
    } catch {
      toast.error('Failed to submit event request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><PartyPopper className="size-5 text-primary" /> New Event Request</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Request approval for a campus event or activity.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="space-y-1.5">
          <Label>Event Name <span className="text-destructive">*</span></Label>
          <Input placeholder="e.g. Spring Tech Fest 2025" value={form.eventName} onChange={(e) => set('eventName', e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <select value={form.eventType} onChange={(e) => set('eventType', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring">
              {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Expected Attendance <span className="text-destructive">*</span></Label>
            <Input type="number" min="1" placeholder="e.g. 100" value={form.expectedAttendance} onChange={(e) => set('expectedAttendance', e.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Start Date & Time <span className="text-destructive">*</span></Label>
            <Input type="datetime-local" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>End Date & Time <span className="text-destructive">*</span></Label>
            <Input type="datetime-local" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Preferred Location</Label>
          <Input placeholder="e.g. Engineering Hall A, Outdoor Amphitheater" value={form.locationPreference} onChange={(e) => set('locationPreference', e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Description <span className="text-destructive">*</span></Label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4}
            placeholder="Describe the event purpose and activities..."
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>

        {/* Additional needs */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Additional Requirements</p>
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
              <Label>Estimated Budget ($)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.estimatedBudget} onChange={(e) => set('estimatedBudget', e.target.value)} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />} Submit Request
          </Button>
        </div>
      </form>
    </div>
  )
}
