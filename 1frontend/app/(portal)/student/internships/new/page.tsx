'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ArrowLeft, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import Link from 'next/link'
import {
  getCurrentDateInputValue,
  validateDateWindow,
} from '@/lib/date-time'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const INTERNSHIP_TYPES = ['MANDATORY', 'VOLUNTARY', 'SUMMER']
const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID']

export default function NewInternshipPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const minDate = getCurrentDateInputValue()

  const [form, setForm] = useState({
    companyName: '',
    companySector: '',
    companyContactName: '',
    companyContactEmail: '',
    internshipType: 'MANDATORY',
    workMode: 'ONSITE',
    startDate: '',
    endDate: '',
    durationDays: '',
    insuranceRequired: false,
  })

  const setDateField = (key: 'startDate' | 'endDate', value: string) => {
    const nextForm = { ...form, [key]: value }
    const error = validateDateWindow({
      start: nextForm.startDate,
      end: nextForm.endDate,
      type: 'date',
      startLabel: 'Baslangic tarihi',
      endLabel: 'Bitis tarihi',
    })
    if (!error && nextForm.startDate && nextForm.endDate) {
      const diff = Math.round(
        (new Date(nextForm.endDate).getTime() - new Date(nextForm.startDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      nextForm.durationDays = diff > 0 ? String(diff) : ''
    }
    setForm(nextForm)
    setDateError(error)
    if (error) toast.error(error)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.companyName.trim()) {
      toast.error(t('messages.companyRequired'))
      return
    }
    if (!form.startDate || !form.endDate) {
      toast.error(t('messages.internshipDatesRequired'))
      return
    }
    const validationError = validateDateWindow({
      start: form.startDate,
      end: form.endDate,
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
      const res = await fetch(`${BACKEND}/student/internships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          title: `${form.internshipType} Internship at ${form.companyName}`,
          companyName: form.companyName,
          companySector: form.companySector || undefined,
          companyContactName: form.companyContactName || undefined,
          companyContactEmail: form.companyContactEmail || undefined,
          internshipType: form.internshipType,
          workMode: form.workMode,
          startDate: form.startDate,
          endDate: form.endDate,
          durationDays: Number(form.durationDays) || 0,
          insuranceRequired: form.insuranceRequired,
        }),
      })

      if (res.ok) {
        toast.success(t('messages.internshipSubmitted'))
        router.push('/student/internships')
      } else {
        const err = (await res.json().catch(() => ({}))) as { message?: string }
        toast.error(err.message ?? t('messages.submitApplicationFail'))
      }
    } catch {
      toast.error(t('messages.networkTryAgain'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const field = (
    label: string,
    key: keyof typeof form,
    type = 'text',
    placeholder = '',
    required = false,
  ) => (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        required={required}
      />
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl p-6 pb-20">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/student/internships">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" /> {t('forms.back')}
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Briefcase className="size-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">
            {t('pages.newInternshipTitle')}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            {t('forms.companyName') === 'Company Name' ? 'Company Information' : 'Sirket Bilgileri'}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field(t('forms.companyName'), 'companyName', 'text', t('forms.companyNamePlaceholder'), true)}
            {field(t('forms.industrySector'), 'companySector', 'text', t('forms.industrySectorPlaceholder'))}
            {field(t('forms.contactPerson'), 'companyContactName', 'text', t('forms.contactPersonPlaceholder'))}
            {field(t('forms.contactEmail'), 'companyContactEmail', 'email', t('forms.contactEmailPlaceholder'))}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            {t('pages.internshipsTitle')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                {t('forms.type')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.internshipType}
                onValueChange={(v) => setForm({ ...form, internshipType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERNSHIP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {t('forms.workMode')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.workMode}
                onValueChange={(v) => setForm({ ...form, workMode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m.charAt(0) + m.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {t('forms.startDate')} <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                min={minDate}
                value={form.startDate}
                onChange={(e) => setDateField('startDate', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                {t('forms.endDate')} <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                min={form.startDate || minDate}
                value={form.endDate}
                onChange={(e) => setDateField('endDate', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                {t('forms.durationDays')}
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">(auto)</span>
              </Label>
              <Input
                type="number"
                min={1}
                value={form.durationDays}
                readOnly={!!(form.startDate && form.endDate)}
                onChange={(e) =>
                  setForm({ ...form, durationDays: e.target.value })
                }
                placeholder={t('forms.durationPlaceholder')}
                className={form.startDate && form.endDate ? 'bg-muted/50 cursor-default' : ''}
              />
            </div>
            <div className="flex flex-col justify-end space-y-1.5">
              <div className="flex items-center gap-3 pb-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.insuranceRequired}
                  onClick={() =>
                    setForm({
                      ...form,
                      insuranceRequired: !form.insuranceRequired,
                    })
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    form.insuranceRequired
                      ? 'bg-primary'
                      : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
                      form.insuranceRequired ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <Label
                  className="cursor-pointer"
                  onClick={() =>
                    setForm({
                      ...form,
                      insuranceRequired: !form.insuranceRequired,
                    })
                  }
                >
                  {t('forms.insuranceRequired')}
                </Label>
              </div>
            </div>
          </div>
        </div>
        {dateError && <p className="text-sm text-destructive">{dateError}</p>}

        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            {t('forms.internshipRouteInfo')}
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/student/internships">
            <Button type="button" variant="outline" disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('forms.submitApplication')}
          </Button>
        </div>
      </form>
    </div>
  )
}
