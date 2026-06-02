'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { RequestAttachments, uploadAttachments, AttachmentsState, clearAttachmentCache } from '@/components/student/request-attachments'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export default function NewFacultyTicketPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentsState>({ newFiles: [], linkedFileIds: [] })
  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    priority: 'MEDIUM',
    affectedSystem: '',
    locationText: '',
  })

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // newFiles only contains failed eager-upload files; retry them now
      const uploadedIds = await uploadAttachments(attachments.newFiles, `${BACKEND}/faculty/upload`)
      const attachmentFileIds = [...attachments.linkedFileIds, ...uploadedIds]
      const res = await fetch(`${BACKEND}/it-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          ...form,
          ...(attachmentFileIds.length ? { attachmentFileIds } : {}),
        }),
      })

      if (!res.ok) {
        throw new Error()
      }

      const created = await res.json()
      clearAttachmentCache('faculty-ticket-new')
      toast.success(t('detail.ticketCreated'))
      router.push(`/faculty/requests/${created.requestId}?from=/faculty/tickets`)
    } catch {
      toast.error(t('detail.ticketCreateFail'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 pb-20">
      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <Link href="/faculty/tickets">
          <ArrowLeft className="size-4" /> {t('common.back')}
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold">{t('tickets.newTicket')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('tickets.subtitle', { count: 0 })}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('common.name')}</label>
          <Input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={t('forms.itTitlePlaceholder')}
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('tickets.category')}</label>
            <Input
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder={t('forms.itCategoryPlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('tickets.priority')}</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none dark:bg-input/30"
            >
              <option className="bg-background text-foreground" value="LOW">{t('tickets.low')}</option>
              <option className="bg-background text-foreground" value="MEDIUM">{t('tickets.medium')}</option>
              <option className="bg-background text-foreground" value="HIGH">{t('tickets.high')}</option>
              <option className="bg-background text-foreground" value="URGENT">{t('tickets.urgent')}</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('tickets.affectedSystem')}</label>
            <Input
              value={form.affectedSystem}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, affectedSystem: e.target.value }))
              }
              placeholder={t('forms.itAffectedSystemPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('tickets.location')}</label>
            <Input
              value={form.locationText}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, locationText: e.target.value }))
              }
              placeholder={t('forms.itLocationPlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('tickets.description')}</label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t('forms.itDescriptionPlaceholder')}
            rows={6}
          />
        </div>

        <div className="pt-2 border-t border-border">
          <RequestAttachments hidePicker uploadUrl={`${BACKEND}/faculty/upload`} onChange={setAttachments} storageKey="faculty-ticket-new" />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !!attachments.isUploading}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('common.submit')}
          </Button>
        </div>
      </form>
    </div>
  )
}
