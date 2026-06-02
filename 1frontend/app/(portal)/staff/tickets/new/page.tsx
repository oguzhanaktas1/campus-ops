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
import { RequestAttachments, uploadAttachments, AttachmentsState } from '@/components/student/request-attachments'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export default function NewStaffTicketPage() {
  const { t } = useI18n()
  const router = useRouter()
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
      const uploadedIds = await uploadAttachments(attachments.newFiles, `${BACKEND}/staff/upload`)
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

      if (!res.ok) throw new Error()

      const created = await res.json()
      toast.success(t('tickets.createSuccess'))
      router.push(`/staff/requests/it-support/${created.requestId}`)
    } catch {
      toast.error(t('tickets.createFail'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 pb-20">
      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <Link href="/staff/tickets">
          <ArrowLeft className="size-4" /> {t('common.back')}
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold">{t('tickets.newTicket')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('tickets.newSubtitle')}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('common.title')}</label>
          <Input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder={t('tickets.titlePlaceholder')}
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('tickets.category')}</label>
            <Input
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder={t('tickets.categoryPlaceholder')}
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
              <option className="bg-background text-foreground" value="LOW">{t('common.low')}</option>
              <option className="bg-background text-foreground" value="MEDIUM">{t('common.medium')}</option>
              <option className="bg-background text-foreground" value="HIGH">{t('common.high')}</option>
              <option className="bg-background text-foreground" value="URGENT">{t('tickets.urgent')}</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('tickets.affectedSystem')}</label>
            <Input
              value={form.affectedSystem}
              onChange={(e) => setForm((prev) => ({ ...prev, affectedSystem: e.target.value }))}
              placeholder={t('tickets.affectedSystemPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('tickets.location')}</label>
            <Input
              value={form.locationText}
              onChange={(e) => setForm((prev) => ({ ...prev, locationText: e.target.value }))}
              placeholder={t('tickets.locationPlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t('tickets.description')}</label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t('tickets.descriptionPlaceholder')}
            rows={6}
          />
        </div>

        <div className="pt-2 border-t border-border">
          <RequestAttachments hidePicker onChange={setAttachments} />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            {t('tickets.submitTicket')}
          </Button>
        </div>
      </form>
    </div>
  )
}
