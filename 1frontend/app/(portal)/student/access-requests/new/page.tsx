'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import {
  getCurrentDateInputValue,
  validateDateWindow,
} from '@/lib/date-time'
import { useI18n } from '@/lib/i18n'

const ACCESS_TYPES = ['System / Portal', 'Lab Access', 'Network Resource', 'Software License', 'Campus Area', 'Other']

export default function NewStudentAccessRequestPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const minDate = getCurrentDateInputValue()
  const [form, setForm] = useState({
    accessType: 'System / Portal',
    targetResource: '',
    requestedRoleOrPermission: '',
    justification: '',
    startAt: '',
    endAt: '',
  })

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))
  const setDateField = (key: 'startAt' | 'endAt', value: string) => {
    const nextForm = { ...form, [key]: value }
    const error = validateDateWindow({
      start: nextForm.startAt,
      end: nextForm.endAt,
      type: 'date',
      startLabel: 'Baslangic tarihi',
      endLabel: 'Bitis tarihi',
    })
    setForm(nextForm)
    setDateError(error)
    if (error) toast.error(error)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.targetResource.trim() || !form.justification.trim()) {
      toast.error(t('messages.accessRequired'))
      return
    }
    const validationError = validateDateWindow({
      start: form.startAt,
      end: form.endAt,
      type: 'date',
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
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          ...form,
          startAt: form.startAt || undefined,
          endAt: form.endAt || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(t('messages.accessSubmitted', { requestNo: data.requestNo }))
      router.push('/student/access-requests')
    } catch {
      toast.error(t('messages.submitAccessFail'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> {t('pages.newAccessRequestTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('pages.newAccessRequestSubtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('forms.accessType')}</Label>
            <select value={form.accessType} onChange={(e) => set('accessType', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring">
              {ACCESS_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('forms.targetResource')} <span className="text-destructive">*</span></Label>
            <Input placeholder={t('forms.targetResourcePlaceholder')} value={form.targetResource} onChange={(e) => set('targetResource', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t('forms.requestedPermissionOptional')}</Label>
          <Input placeholder={t('forms.requestedPermissionPlaceholder')} value={form.requestedRoleOrPermission} onChange={(e) => set('requestedRoleOrPermission', e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('forms.accessStartDateOptional')}</Label>
            <Input type="date" min={minDate} value={form.startAt} onChange={(e) => setDateField('startAt', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('forms.accessEndDateOptional')}</Label>
            <Input type="date" min={form.startAt || minDate} value={form.endAt} onChange={(e) => setDateField('endAt', e.target.value)} />
          </div>
        </div>
        {dateError && <p className="text-sm text-destructive">{dateError}</p>}

        <div className="space-y-1.5">
          <Label>{t('forms.justification')} <span className="text-destructive">*</span></Label>
          <textarea value={form.justification} onChange={(e) => set('justification', e.target.value)} rows={4}
            placeholder={t('forms.justificationPlaceholder')}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />} {t('common.submitRequest')}
          </Button>
        </div>
      </form>
    </div>
  )
}
