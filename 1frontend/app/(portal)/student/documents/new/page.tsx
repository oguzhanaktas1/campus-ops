'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getToken } from '@/lib/auth'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'
import { RequestAttachments, uploadAttachments, AttachmentsState } from '@/components/student/request-attachments'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export default function NewDocumentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentsState>({ newFiles: [], linkedFileIds: [] })

  const [form, setForm] = useState({
    documentType: searchParams.get('type') ?? 'TRANSCRIPT',
    language: 'English',
    copiesCount: 1,
    deliveryMethod: 'PICKUP',
    deliveryAddress: '',
    description: '',
  })

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const uploadedIds = await uploadAttachments(attachments.newFiles)
      const attachmentFileIds = [...attachments.linkedFileIds, ...uploadedIds]
      const res = await fetch(`${BACKEND}/document-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          documentType: form.documentType,
          language: form.language || null,
          copiesCount: Number(form.copiesCount),
          deliveryMethod: form.deliveryMethod,
          deliveryAddress: form.deliveryAddress || null,
          description: form.description || null,
          ...(attachmentFileIds.length ? { attachmentFileIds } : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).message ?? t('documents.submitFail'))
      }
      toast.success(t('documents.submitted'))
      router.push('/student/documents')
    } catch (err: any) {
      toast.error(err.message ?? t('documents.submitFail'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/student/documents">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('documents.newTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('documents.newSubtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        {/* Document Type */}
        <div className="px-5 py-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="size-4 text-primary" /> {t('documents.details')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('documents.documentType')} *</label>
              <select
                value={form.documentType}
                onChange={(e) => set('documentType', e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {[
                  { value: 'TRANSCRIPT', label: t('documents.transcript') },
                  { value: 'ENROLLMENT_CERTIFICATE', label: t('documents.enrollmentCertificate') },
                  { value: 'STUDENT_CERTIFICATE', label: t('documents.studentCertificate') },
                  { value: 'DIPLOMA', label: t('documents.diploma') },
                  { value: 'OTHER', label: t('documents.other') },
                ].map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('forms.language')}</label>
              <select
                value={form.language}
                onChange={(e) => set('language', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="English">{t('forms.langEnglish')}</option>
                <option value="Turkish">{t('forms.langTurkish')}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('forms.copies')}</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.copiesCount}
                onChange={(e) => set('copiesCount', parseInt(e.target.value) || 1)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="px-5 py-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">{t('forms.deliveryPreferences')}</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{t('documents.deliveryMethod')} *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'PICKUP', label: t('documents.pickup') },
                  { value: 'EMAIL', label: t('documents.emailDelivery') },
                  { value: 'MAIL', label: t('documents.mailDelivery') },
                ].map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => set('deliveryMethod', m.value)}
                    className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                      form.deliveryMethod === m.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {(form.deliveryMethod === 'EMAIL' || form.deliveryMethod === 'MAIL') && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {form.deliveryMethod === 'EMAIL' ? t('documents.emailAddress') : t('documents.postalAddress')} *
                </label>
                <input
                  type={form.deliveryMethod === 'EMAIL' ? 'email' : 'text'}
                  value={form.deliveryAddress}
                  onChange={(e) => set('deliveryAddress', e.target.value)}
                  placeholder={form.deliveryMethod === 'EMAIL' ? t('forms.emailPlaceholder') : t('forms.addressPlaceholder')}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 py-4 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t('forms.additionalNotes')}</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder={t('forms.additionalNotesPlaceholder')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Attachments */}
        <div className="px-5 py-4">
          <RequestAttachments onChange={setAttachments} />
        </div>

        {/* Submit */}
        <div className="px-5 py-4 flex items-center justify-end gap-3">
          <Link href="/student/documents">
            <Button type="button" variant="ghost" size="sm">{t('common.cancel')}</Button>
          </Link>
          <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            {t('common.submitRequest')}
          </Button>
        </div>
      </form>
    </div>
  )
}
