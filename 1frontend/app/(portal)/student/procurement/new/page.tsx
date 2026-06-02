'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { RequestAttachments, uploadAttachments, AttachmentsState, clearAttachmentCache } from '@/components/student/request-attachments'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const CATEGORIES = [
  'Laboratory Equipment',
  'Office Supply',
  'Software / License',
  'Service Purchase',
  'Furniture',
  'Technical Equipment',
  'Other',
]

export default function NewStudentProcurementPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentsState>({ newFiles: [], linkedFileIds: [] })
  const [form, setForm] = useState({
    itemName: '',
    itemCategory: 'Laboratory Equipment',
    quantity: '1',
    unitPriceEstimate: '',
    vendorPreference: '',
    justification: '',
    budgetCode: '',
    priority: 'MEDIUM',
  })

  const setValue = (key: string, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.itemName.trim()) {
      toast.error(t('messages.itemNameRequired'))
      return
    }

    if (!form.justification.trim()) {
      toast.error(t('messages.justificationRequired'))
      return
    }

    const quantity = Number(form.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error(t('messages.quantityMin'))
      return
    }

    const unitPriceEstimate = form.unitPriceEstimate.trim()
      ? Number(form.unitPriceEstimate)
      : undefined

    if (
      unitPriceEstimate !== undefined &&
      (Number.isNaN(unitPriceEstimate) || unitPriceEstimate < 0)
    ) {
      toast.error(t('messages.unitPriceInvalid'))
      return
    }

    setIsSubmitting(true)
    try {
      const uploadedIds = await uploadAttachments(attachments.newFiles)
      const attachmentFileIds = [...attachments.linkedFileIds, ...uploadedIds]
      const res = await fetch(`${BACKEND}/procurement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          itemName: form.itemName.trim(),
          itemCategory: form.itemCategory,
          quantity,
          unitPriceEstimate,
          vendorPreference: form.vendorPreference.trim() || undefined,
          justification: form.justification.trim(),
          budgetCode: form.budgetCode.trim() || undefined,
          priority: form.priority,
          ...(attachmentFileIds.length ? { attachmentFileIds } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('documents.submitFail'))

      toast.success(t('messages.procurementSubmitted', { requestNo: data.requestNo }))
      clearAttachmentCache('student-procurement-new')
      router.push(`/student/requests/${data.requestId}`)
    } catch (error: any) {
      toast.error(error.message || t('messages.somethingWentWrong'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/student/procurement">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t('pages.newProcurementTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('pages.newProcurementSubtitle')}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              {t('forms.itemNamePlaceholder') === 'e.g. 15 laptops for software lab' ? 'Item Name' : 'Urun Adi'} <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.itemName}
              onChange={(e) => setValue('itemName', e.target.value)}
              placeholder={t('forms.itemNamePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('forms.category')}</Label>
            <select
              value={form.itemCategory}
              onChange={(e) => setValue('itemCategory', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>
              {t('forms.category') === 'Category' ? 'Priority' : 'Oncelik'} <span className="text-destructive">*</span>
            </Label>
            <select
              value={form.priority}
              onChange={(e) => setValue('priority', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>
              {t('forms.quantity')} <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setValue('quantity', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('forms.unitPriceEstimate')}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.unitPriceEstimate}
              onChange={(e) => setValue('unitPriceEstimate', e.target.value)}
              placeholder={t('forms.unitPricePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('forms.vendorPreference')}</Label>
            <Input
              value={form.vendorPreference}
              onChange={(e) => setValue('vendorPreference', e.target.value)}
              placeholder={t('forms.vendorPreferencePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('forms.budgetCode')}</Label>
            <Input
              value={form.budgetCode}
              onChange={(e) => setValue('budgetCode', e.target.value)}
              placeholder={t('forms.budgetCodePlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            {t('forms.justification')} <span className="text-destructive">*</span>
          </Label>
          <textarea
            rows={5}
            value={form.justification}
            onChange={(e) => setValue('justification', e.target.value)}
            placeholder={t('forms.procurementJustificationPlaceholder')}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="pt-2">
          <RequestAttachments onChange={setAttachments} uploadUrl={`${BACKEND}/student/upload`} storageKey="student-procurement-new" />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button type="submit" disabled={isSubmitting || !!attachments.isUploading} className="gap-2">
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShoppingCart className="size-4" />
            )}
            {t('common.submitRequest')}
          </Button>
          <Link href="/student/procurement">
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
