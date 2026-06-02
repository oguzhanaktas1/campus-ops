'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  ClipboardList,
  BookMarked,
  ShieldCheck,
  Package,
  ShoppingCart,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const EVENT_TYPES = [
  'Conference',
  'Workshop',
  'Club Activity',
  'Social Event',
  'Sports',
  'Cultural',
  'Academic',
  'Other',
]

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

type RequestOption = {
  id: string
  requestNo: string
  status: string
  label: string
  detail?: string
}

function statusOf(item: any) {
  return String(item?.reservationStatus ?? item?.status ?? '').toUpperCase()
}

function isApproved(status: string) {
  return status === 'APPROVED'
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

function RequestRequirementCard(props: {
  title: string
  description: string
  icon: React.ReactNode
  createHref: string
  createLabel: string
  options: RequestOption[]
  value: string
  onChange: (value: string) => void
  required: boolean
}) {
  const { t } = useI18n()
  const selected = props.options.find((option) => option.id === props.value)
  const approved = selected ? isApproved(selected.status) : false

  return (
    <div className="border border-border rounded-xl p-4 space-y-4 bg-card">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {props.icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {props.title}
              </h2>
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border shrink-0',
                  props.required
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-muted text-muted-foreground border-border',
                )}
              >
                {props.required ? t('common.required') : t('common.optional')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {props.description}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 self-start"
          onClick={() => window.open(props.createHref, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="size-3.5" />
          {props.createLabel}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>{t('pages.selectExistingRequest')}</Label>
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">
            {props.required ? 'Select an approved request...' : 'None'}
          </option>
          {props.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.requestNo} - {option.label} - {formatStatusLabel(option.status)}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-xs',
            approved
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200',
          )}
        >
          <div className="flex items-center gap-2 font-semibold">
            {approved ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <AlertTriangle className="size-4" />
            )}
            {selected.requestNo} · {formatStatusLabel(selected.status)}
          </div>
          {selected.detail && <p className="mt-1">{selected.detail}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {props.required
            ? 'Create and approve this request before creating the event plan.'
            : 'Attach one if this event needs it.'}
        </p>
      )}
    </div>
  )
}

export default function NewEventPlanPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingDependencies, setIsLoadingDependencies] = useState(true)
  const [reservationOptions, setReservationOptions] = useState<RequestOption[]>([])
  const [accessOptions, setAccessOptions] = useState<RequestOption[]>([])
  const [equipmentOptions, setEquipmentOptions] = useState<RequestOption[]>([])
  const [procurementOptions, setProcurementOptions] = useState<RequestOption[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    eventType: 'Workshop',
    tentativeStartAt: '',
    tentativeEndAt: '',
    locationPreference: '',
    minimumAttendance: '',
    targetAttendance: '',
    registrationStartAt: '',
    registrationEndAt: '',
    notes: '',
    sourceEventRequestId: '',
    reservationRequestId: '',
    accessRequestId: '',
    equipmentRequestId: '',
    procurementRequestId: '',
  })

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const headers = { Authorization: `Bearer ${getToken()}` }
        const [reservationRes, accessRes, equipmentRes, procurementRes] =
          await Promise.all([
            fetch(`${BACKEND}/room-reservation-requests/my`, { headers }),
            fetch(`${BACKEND}/access-requests`, { headers }),
            fetch(`${BACKEND}/equipment-requests/my`, { headers }),
            fetch(`${BACKEND}/procurement`, { headers }),
          ])

        const reservations = reservationRes.ok ? await reservationRes.json() : []
        const accesses = accessRes.ok ? await accessRes.json() : []
        const equipments = equipmentRes.ok ? await equipmentRes.json() : []
        const procurements = procurementRes.ok ? await procurementRes.json() : []

        setReservationOptions(
          reservations.map((item: any) => ({
            id: item.id,
            requestNo: item.requestNo,
            status: statusOf(item),
            label: item.eventName ?? item.title ?? item.resource?.name ?? 'Reservation',
            detail: item.resource?.name
              ? `${item.resource.name}${item.startAt ? ` · ${new Date(item.startAt).toLocaleDateString()}` : ''}`
              : item.reservationPurpose,
          })),
        )

        setAccessOptions(
          accesses.map((item: any) => ({
            id: item.id,
            requestNo: item.requestNo,
            status: statusOf(item),
            label: item.targetResource ?? item.accessType ?? 'Access request',
            detail: item.requestedRoleOrPermission ?? item.justification ?? '',
          })),
        )

        setEquipmentOptions(
          equipments.map((item: any) => ({
            id: item.equipmentRequestId ?? item.id,
            requestNo: item.requestNo,
            status: statusOf(item),
            label: item.equipmentName ?? item.title ?? 'Equipment request',
            detail: item.equipmentCategory
              ? `${item.equipmentCategory}${item.quantity ? ` · qty ${item.quantity}` : ''}`
              : '',
          })),
        )

        setProcurementOptions(
          procurements.map((item: any) => ({
            id: item.procurementRequestId ?? item.id,
            requestNo: item.requestNo,
            status: statusOf(item),
            label: item.itemName ?? item.title ?? 'Procurement request',
            detail: item.itemCategory
              ? `${item.itemCategory}${item.quantity ? ` · qty ${item.quantity}` : ''}`
              : '',
          })),
        )
      } catch {
        toast.error(t('pages.prereqLoadFail'))
      } finally {
        setIsLoadingDependencies(false)
      }
    }

    void loadDependencies()
  }, [t])

  const selectedReservation = useMemo(
    () => reservationOptions.find((item) => item.id === form.reservationRequestId),
    [reservationOptions, form.reservationRequestId],
  )
  const selectedAccess = useMemo(
    () => accessOptions.find((item) => item.id === form.accessRequestId),
    [accessOptions, form.accessRequestId],
  )

  const canCreatePlan =
    Boolean(selectedReservation && isApproved(selectedReservation.status)) &&
    Boolean(selectedAccess && isApproved(selectedAccess.status))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.minimumAttendance) {
      toast.error(t('pages.titleMinRequired'))
      return
    }
    if (!canCreatePlan) {
      toast.error(t('pages.approvalsRequired'))
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/event-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          eventType: form.eventType,
          tentativeStartAt: form.tentativeStartAt || undefined,
          tentativeEndAt: form.tentativeEndAt || undefined,
          locationPreference: form.locationPreference || undefined,
          minimumAttendance: parseInt(form.minimumAttendance, 10),
          targetAttendance: form.targetAttendance
            ? parseInt(form.targetAttendance, 10)
            : undefined,
          registrationStartAt: form.registrationStartAt || undefined,
          registrationEndAt: form.registrationEndAt || undefined,
          notes: form.notes || undefined,
          sourceEventRequestId: form.sourceEventRequestId || undefined,
          reservationRequestId: form.reservationRequestId,
          accessRequestId: form.accessRequestId,
          equipmentRequestId: form.equipmentRequestId || undefined,
          procurementRequestId: form.procurementRequestId || undefined,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.message || t('pages.planCreateFail'))
      }

      toast.success(t('pages.planCreated'))
      router.push(`/organizer/plans/${data.id}`)
    } catch (error: any) {
      toast.error(error.message || t('pages.planCreateFail'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-20 overflow-x-hidden">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" /> {t('dashboard.newEventPlan')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('pages.plansSubtitle')}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl shadow-sm p-4 sm:p-6 space-y-6"
      >
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">{t('pages.approvalRules')}</p>
          <p className="mt-1">
            Reservation and access requests are mandatory and must be approved before you can create the plan.
            Equipment and procurement requests are optional.
          </p>
        </div>

        {isLoadingDependencies ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <RequestRequirementCard
              title={t('pages.reservations')}
              description="Reserve the room or venue for the event."
              icon={<BookMarked className="size-5" />}
              createHref="/organizer/reservations/new"
              createLabel={t('pages.reserveRoom')}
              options={reservationOptions}
              value={form.reservationRequestId}
              onChange={(value) => set('reservationRequestId', value)}
              required
            />
            <RequestRequirementCard
              title={t('nav.accessRequests')}
              description="Request lab, area or system access needed for the event."
              icon={<ShieldCheck className="size-5" />}
              createHref="/organizer/access-requests/new"
              createLabel={t('pages.newAccessRequest')}
              options={accessOptions}
              value={form.accessRequestId}
              onChange={(value) => set('accessRequestId', value)}
              required
            />
            <RequestRequirementCard
              title={t('pages.equipmentRequests')}
              description="Optional equipment such as projector, laptop or audio kit."
              icon={<Package className="size-5" />}
              createHref="/organizer/equipment/new"
              createLabel={t('pages.requestEquipment')}
              options={equipmentOptions}
              value={form.equipmentRequestId}
              onChange={(value) => set('equipmentRequestId', value)}
              required={false}
            />
            <RequestRequirementCard
              title={t('pages.procurementTitle')}
              description="Optional purchases or external service procurement."
              icon={<ShoppingCart className="size-5" />}
              createHref="/organizer/procurement/new"
              createLabel={t('common.newRequest')}
              options={procurementOptions}
              value={form.procurementRequestId}
              onChange={(value) => set('procurementRequestId', value)}
              required={false}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>
            {t('common.title')} <span className="text-destructive">*</span>
          </Label>
          <Input
            placeholder={t('pages.titlePlaceholder')}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('pages.eventType')}</Label>
            <select
              value={form.eventType}
              onChange={(e) => set('eventType', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('pages.locationPreference')}</Label>
            <Input
              placeholder={t('pages.locationPlaceholder')}
              value={form.locationPreference}
              onChange={(e) => set('locationPreference', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t('common.description')}</Label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder={t('pages.eventDescriptionPlaceholder')}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>
              {t('pages.minAttendance')} <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min="1"
              placeholder={t('pages.minAttendancePlaceholder')}
              value={form.minimumAttendance}
              onChange={(e) => set('minimumAttendance', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('pages.targetAttendance')}</Label>
            <Input
              type="number"
              min="1"
              placeholder={t('pages.targetAttendancePlaceholder')}
              value={form.targetAttendance}
              onChange={(e) => set('targetAttendance', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('pages.tentativeDates')}
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('pages.start')}</Label>
              <Input
                type="datetime-local"
                value={form.tentativeStartAt}
                onChange={(e) => set('tentativeStartAt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('pages.end')}</Label>
              <Input
                type="datetime-local"
                value={form.tentativeEndAt}
                onChange={(e) => set('tentativeEndAt', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('pages.preregWindow')}
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('pages.registrationOpens')}</Label>
              <Input
                type="datetime-local"
                value={form.registrationStartAt}
                onChange={(e) => set('registrationStartAt', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('pages.registrationCloses')}</Label>
              <Input
                type="datetime-local"
                value={form.registrationEndAt}
                onChange={(e) => set('registrationEndAt', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t('pages.sourceRequestId')}</Label>
          <Input
            placeholder={t('pages.sourceRequestPlaceholder')}
            value={form.sourceEventRequestId}
            onChange={(e) => set('sourceEventRequestId', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('common.notes')}</Label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder={t('pages.notesPlaceholder')}
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {!canCreatePlan && !isLoadingDependencies && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Create Plan is locked until both the selected reservation and access requests are approved.
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting || isLoadingDependencies || !canCreatePlan} className="gap-2">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />} {t('common.newPlan')}
          </Button>
        </div>
      </form>
    </div>
  )
}
