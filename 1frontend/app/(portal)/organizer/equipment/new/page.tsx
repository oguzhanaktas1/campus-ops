'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Package, Info } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import {
  getCurrentDateInputValue,
  validateDateWindow,
} from '@/lib/date-time'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const CATEGORIES = [
  'Projector',
  'Laptop / Computer',
  'Camera / Video',
  'Audio Equipment',
  'Drawing Tablet',
  'Measurement Instrument',
  'Other',
]

export default function OrganizerNewEquipmentPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [resources, setResources] = useState<any[]>([])
  const [isLoadingResources, setIsLoadingResources] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const minDate = getCurrentDateInputValue()

  const [form, setForm] = useState({
    labResourceId: '',
    equipmentName: '',
    equipmentCategory: 'Projector',
    quantity: '1',
    purpose: '',
    neededFrom: '',
    neededUntil: '',
    urgencyReason: '',
  })

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/resources?resourceType=EQUIPMENT`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      setResources(res.ok ? await res.json() : [])
    } catch {
      setResources([])
    } finally {
      setIsLoadingResources(false)
    }
  }, [])

  useEffect(() => { void fetchResources() }, [fetchResources])

  const selectedResource = resources.find((r) => r.id === form.labResourceId)

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))
  const setDateField = (key: 'neededFrom' | 'neededUntil', value: string) => {
    const nextForm = { ...form, [key]: value }
    const error = validateDateWindow({
      start: nextForm.neededFrom,
      end: nextForm.neededUntil,
      type: 'date',
      startLabel: 'Baslangic tarihi',
      endLabel: 'Bitis tarihi',
    })
    setForm(nextForm)
    setDateError(error)
    if (error) toast.error(error)
  }

  const handleResourceSelect = (resourceId: string) => {
    const r = resources.find((res) => res.id === resourceId)
    set('labResourceId', resourceId)
    if (r) {
      set('equipmentName', r.name)
      const name = r.name.toLowerCase()
      if (name.includes('projector')) set('equipmentCategory', 'Projector')
      else if (name.includes('laptop') || name.includes('computer')) set('equipmentCategory', 'Laptop / Computer')
      else if (name.includes('camera')) set('equipmentCategory', 'Camera / Video')
      else if (name.includes('audio') || name.includes('speaker') || name.includes('mic')) set('equipmentCategory', 'Audio Equipment')
      else if (name.includes('tablet')) set('equipmentCategory', 'Drawing Tablet')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const equipmentName = form.labResourceId && selectedResource
      ? selectedResource.name
      : form.equipmentName.trim()

    if (!equipmentName) { toast.error(t('pages.equipmentSelectRequired')); return }
    if (!form.purpose.trim()) { toast.error(t('pages.purposeRequired')); return }
    const validationError = validateDateWindow({
      start: form.neededFrom,
      end: form.neededUntil,
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
      const res = await fetch(`${BACKEND}/equipment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          labResourceId: form.labResourceId || undefined,
          equipmentName,
          equipmentCategory: form.equipmentCategory,
          quantity: Math.max(1, parseInt(form.quantity) || 1),
          purpose: form.purpose.trim(),
          neededFrom: form.neededFrom || undefined,
          neededUntil: form.neededUntil || undefined,
          urgencyReason: form.urgencyReason.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('pages.accessSubmitFail'))
      toast.success(t('pages.equipmentSubmitted', { requestNo: data.requestNo }))
      router.push('/organizer/equipment')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/organizer/equipment">
          <Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.requestEquipment')}</h1>
          <p className="text-sm text-muted-foreground">{t('pages.requestEquipmentSubtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">

        <div className="space-y-1.5">
          <Label>{t('pages.equipmentCatalog')}</Label>
          {isLoadingResources ? (
            <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
            </div>
          ) : resources.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t('pages.noEquipmentCatalog')}</p>
          ) : (
            <select
              value={form.labResourceId}
              onChange={(e) => handleResourceSelect(e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— Select equipment from catalog —</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}{r.locationText ? ` (${r.locationText})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedResource && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="size-4 text-primary" />
            </div>
            <div className="text-sm">
              <p className="font-semibold text-foreground">{selectedResource.name}</p>
              {selectedResource.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{selectedResource.description}</p>
              )}
              {selectedResource.locationText && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Info className="size-3" /> {selectedResource.locationText}
                </p>
              )}
            </div>
          </div>
        )}

        {!form.labResourceId && (
          <div className="space-y-1.5">
            <Label>{t('pages.equipmentName')} <span className="text-destructive">*</span></Label>
            <Input
              placeholder={t('pages.equipmentNamePlaceholder')}
              value={form.equipmentName}
              onChange={(e) => set('equipmentName', e.target.value)}
            />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('common.category')}</Label>
            <select
              value={form.equipmentCategory}
              onChange={(e) => set('equipmentCategory', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('common.quantity')} <span className="text-destructive">*</span></Label>
            <Input type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('pages.neededFrom')}</Label>
            <Input type="date" min={minDate} value={form.neededFrom} onChange={(e) => setDateField('neededFrom', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('pages.returnBy')}</Label>
            <Input type="date" min={form.neededFrom || minDate} value={form.neededUntil} onChange={(e) => setDateField('neededUntil', e.target.value)} />
          </div>
        </div>
        {dateError && <p className="text-sm text-destructive">{dateError}</p>}

        <div className="space-y-1.5">
          <Label>{t('pages.purpose')} <span className="text-destructive">*</span></Label>
          <textarea
            value={form.purpose}
            onChange={(e) => set('purpose', e.target.value)}
            rows={3}
            placeholder={t('pages.purposePlaceholder')}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('pages.urgencyReason')}</Label>
          <Input
            placeholder={t('pages.urgencyPlaceholder')}
            value={form.urgencyReason}
            onChange={(e) => set('urgencyReason', e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none gap-2">
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
            {t('common.newRequest')}
          </Button>
          <Link href="/organizer/equipment">
            <Button type="button" variant="outline">{t('common.cancel')}</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
