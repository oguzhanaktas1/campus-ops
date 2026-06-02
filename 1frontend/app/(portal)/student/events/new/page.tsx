'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, PartyPopper } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import {
  getCurrentDateTimeInputValue,
  validateDateWindow,
} from '@/lib/date-time'
import { useI18n } from '@/lib/i18n'
import { RequestAttachments, uploadAttachments, AttachmentsState, clearAttachmentCache } from '@/components/student/request-attachments'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const EVENT_TYPES = ['Conference', 'Workshop', 'Club Activity', 'Social Event', 'Sports', 'Cultural', 'Academic', 'Other']

export default function NewStudentEventPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<AttachmentsState>({ newFiles: [], linkedFileIds: [] })
  const minDateTime = getCurrentDateTimeInputValue()
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
    if (!form.eventName.trim() || !form.startAt || !form.endAt || !form.expectedAttendance) {
      toast.error(t('messages.eventRequired'))
      return
    }
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
      const uploadedIds = await uploadAttachments(attachments.newFiles)
      const attachmentFileIds = [...attachments.linkedFileIds, ...uploadedIds]
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          ...form,
          expectedAttendance: parseInt(form.expectedAttendance),
          estimatedBudget: form.estimatedBudget ? parseFloat(form.estimatedBudget) : undefined,
          ...(attachmentFileIds.length ? { attachmentFileIds } : {}),
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(t('messages.eventSubmitted', { requestNo: data.requestNo }))
      clearAttachmentCache('student-event-new')
      router.push('/student/events')
    } catch {
      toast.error(t('messages.submitEventFail'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><PartyPopper className="size-5 text-primary" /> {t('pages.newEventRequestTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('pages.newEventRequestSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="space-y-1.5">
          <Label>{t('forms.eventName')} <span className="text-destructive">*</span></Label>
          <Input placeholder={t('forms.eventNamePlaceholder')} value={form.eventName} onChange={(e) => set('eventName', e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('forms.eventType')}</Label>
            <select value={form.eventType} onChange={(e) => set('eventType', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring">
              {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('forms.expectedAttendance')} <span className="text-destructive">*</span></Label>
            <Input type="number" min="1" placeholder={t('forms.expectedAttendancePlaceholder')} value={form.expectedAttendance} onChange={(e) => set('expectedAttendance', e.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('forms.startDateTime')} <span className="text-destructive">*</span></Label>
            <Input type="datetime-local" min={minDateTime} value={form.startAt} onChange={(e) => setDateField('startAt', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('forms.endDateTime')} <span className="text-destructive">*</span></Label>
            <Input type="datetime-local" min={form.startAt || minDateTime} value={form.endAt} onChange={(e) => setDateField('endAt', e.target.value)} />
          </div>
        </div>
        {dateError && <p className="text-sm text-destructive">{dateError}</p>}

        <div className="space-y-1.5">
          <Label>{t('forms.preferredLocation')}</Label>
          <Input placeholder={t('forms.preferredLocationPlaceholder')} value={form.locationPreference} onChange={(e) => set('locationPreference', e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>{t('forms.description')} <span className="text-destructive">*</span></Label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4}
            placeholder={t('forms.eventDescriptionPlaceholder')}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>

        {/* Additional needs */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('forms.additionalRequirements')}</p>
          <div className="space-y-2">
            {[
              { key: 'needsBudget', label: t('forms.budgetRequired') },
              { key: 'needsPosterApproval', label: t('forms.posterApproval') },
              { key: 'needsSecuritySupport', label: t('forms.securitySupport') },
              { key: 'needsTechnicalSupport', label: t('forms.technicalSupport') },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(form as any)[key]} onChange={(e) => set(key, e.target.checked)} className="rounded" />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          {form.needsBudget && (
            <div className="space-y-1.5 mt-2">
              <Label>{t('forms.estimatedBudget')} ($)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.estimatedBudget} onChange={(e) => set('estimatedBudget', e.target.value)} />
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border">
          <RequestAttachments onChange={setAttachments} uploadUrl={`${BACKEND}/student/upload`} storageKey="student-event-new" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={isSubmitting || !!attachments.isUploading} className="gap-2">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />} {t('common.submitRequest')}
          </Button>
        </div>
      </form>
    </div>
  )
}
