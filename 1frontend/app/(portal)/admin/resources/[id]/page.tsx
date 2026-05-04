'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Box, Loader2, Plus, Trash2, Pencil, Save } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const RESOURCE_TYPES = ['ROOM', 'LAB', 'EQUIPMENT', 'VEHICLE', 'OTHER'] as const
const TYPE_BADGE: Record<string, string> = {
  ROOM: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
  LAB: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
  EQUIPMENT: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  VEHICLE: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
  OTHER: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700',
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface AvailabilitySlot {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
}

interface ResourceDetail {
  id: string
  name: string
  code: string
  resourceType: string
  description?: string
  locationText?: string
  capacity?: number
  isActive: boolean
  campus?: { name: string }
  faculty?: { name: string }
  department?: { name: string }
  unit?: { name: string }
  availabilitySlots: AvailabilitySlot[]
}

const EMPTY_SLOT: Omit<AvailabilitySlot, 'id'> = {
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '17:00',
  isAvailable: true,
}

export default function AdminResourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useI18n()

  const [resource, setResource] = useState<ResourceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Edit form state
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({
    name: '', code: '', resourceType: 'ROOM', description: '', locationText: '', capacity: '', isActive: true,
  })
  const [isSaving, setIsSaving] = useState(false)

  // Availability state
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [isSavingSlots, setIsSavingSlots] = useState(false)
  const [slotsChanged, setSlotsChanged] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/resources/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      const data: ResourceDetail = await res.json()
      setResource(data)
      setForm({
        name: data.name,
        code: data.code,
        resourceType: data.resourceType,
        description: data.description ?? '',
        locationText: data.locationText ?? '',
        capacity: data.capacity?.toString() ?? '',
        isActive: data.isActive,
      })
      setSlots(data.availabilitySlots ?? [])
    } catch {
      toast.error(t('resources.loadFail'))
    } finally {
      setIsLoading(false)
    }
  }, [id, t])

  useEffect(() => { void load() }, [load])

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) { toast.error(t('resources.nameCodeRequired')); return }
    setIsSaving(true)
    try {
      const res = await fetch(`${BACKEND}/admin/resources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ ...form, capacity: form.capacity ? parseInt(form.capacity) : undefined }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('resources.updated'))
      setEditMode(false)
      await load()
    } catch {
      toast.error(t('resources.updateFail'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveSlots() {
    setIsSavingSlots(true)
    try {
      const res = await fetch(`${BACKEND}/admin/resources/${id}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ slots: slots.map(({ id: _id, ...s }) => s) }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('resources.availabilitySaved'))
      setSlotsChanged(false)
      await load()
    } catch {
      toast.error(t('resources.availabilitySaveFail'))
    } finally {
      setIsSavingSlots(false)
    }
  }

  function addSlot() {
    setSlots((prev) => [...prev, { ...EMPTY_SLOT }])
    setSlotsChanged(true)
  }

  function removeSlot(idx: number) {
    setSlots((prev) => prev.filter((_, i) => i !== idx))
    setSlotsChanged(true)
  }

  function updateSlot(idx: number, field: keyof AvailabilitySlot, value: string | number | boolean) {
    setSlots((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
    setSlotsChanged(true)
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!resource) {
    return <div className="p-6 text-center text-muted-foreground">{t('resources.notFound')}</div>
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/resources">
          <Button variant="ghost" size="icon" className="size-8"><ArrowLeft className="size-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{resource.name}</h1>
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', TYPE_BADGE[resource.resourceType])}>
              {resource.resourceType}
            </span>
            <span className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full border',
              resource.isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700'
            )}>
              {resource.isActive ? t('resources.active') : t('resources.inactive')}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{resource.code}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditMode(!editMode)}>
          <Pencil className="size-3.5" />{editMode ? t('common.cancel') : t('common.edit')}
        </Button>
      </div>

      {/* Details / Edit form */}
      <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Box className="size-4 text-primary" /> {t('resources.details')}
          </h2>
          {editMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { label: `${t('resources.name')} *`, key: 'name', type: 'text' },
                { label: `${t('resources.code')} *`, key: 'code', type: 'text' },
                { label: t('resources.location'), key: 'locationText', type: 'text' },
                { label: t('resources.colCapacity'), key: 'capacity', type: 'number' },
                { label: t('common.description'), key: 'description', type: 'text' },
              ] as const).map(({ label, key, type }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <Input
                    type={type}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t('common.type')}</label>
                <select
                  value={form.resourceType}
                  onChange={(e) => setForm((f) => ({ ...f, resourceType: e.target.value }))}
                  className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                  {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="isActive" className="text-sm text-foreground">{t('common.active')}</label>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditMode(false)} disabled={isSaving}>{t('common.cancel')}</Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
                  {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  {t('common.save')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: t('resources.code'), value: resource.code },
                { label: t('common.type'), value: resource.resourceType },
                { label: t('resources.colCapacity'), value: resource.capacity ?? '—' },
                { label: t('resources.location'), value: resource.locationText ?? '—' },
                { label: t('resources.campus'), value: resource.campus?.name ?? '—' },
                { label: t('resources.faculty'), value: resource.faculty?.name ?? '—' },
                { label: t('resources.department'), value: resource.department?.name ?? '—' },
                { label: t('resources.unit'), value: resource.unit?.name ?? '—' },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{f.value}</p>
                </div>
              ))}
              {resource.description && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">{t('common.description')}</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{resource.description}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Availability */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-foreground">{t('resources.weeklyAvailability')}</h2>
          <div className="flex items-center gap-2">
            {slotsChanged && (
              <Button size="sm" className="gap-1.5" onClick={handleSaveSlots} disabled={isSavingSlots}>
                {isSavingSlots ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                {t('resources.save')}
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={addSlot}>
              <Plus className="size-3.5" /> {t('resources.addSlot')}
            </Button>
          </div>
        </div>

        {slots.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t('resources.noSlots')}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {slots.map((slot, idx) => (
              <div key={idx} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                <select
                  value={slot.dayOfWeek}
                  onChange={(e) => updateSlot(idx, 'dayOfWeek', parseInt(e.target.value))}
                  className="bg-background border border-input rounded-md px-3 h-9 text-sm focus:ring-2 focus:ring-primary outline-none min-w-[130px]"
                >
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(idx, 'startTime', e.target.value)}
                    className="bg-background border border-input rounded-md px-3 h-9 text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                  <span className="text-muted-foreground text-sm">–</span>
                  <input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(idx, 'endTime', e.target.value)}
                    className="bg-background border border-input rounded-md px-3 h-9 text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slot.isAvailable}
                    onChange={(e) => updateSlot(idx, 'isAvailable', e.target.checked)}
                    className="rounded"
                  />
                  {t('resources.available')}
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                  onClick={() => removeSlot(idx)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
