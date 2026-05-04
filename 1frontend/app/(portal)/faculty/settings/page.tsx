'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, User, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchProfile, getStoredUser, getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

interface AvailabilitySlot { id?: string; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }

function ProfileField({ label, value, wide = false, multiline = false }: { label: string; value: string; wide?: boolean; multiline?: boolean }) {
  return (
    <div className={`space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea value={value || '-'} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground resize-none min-h-[70px]" />
      ) : (
        <Input value={value || '-'} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground" />
      )}
    </div>
  )
}

export default function FacultySettingsPage() {
  const { t } = useI18n()
  const [user, setUser] = useState<any>(null)
  const [preferences, setPreferences] = useState<any>(null)
  const [officeHours, setOfficeHours] = useState({ startTime: '09:00', endTime: '17:00' })
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingHours, setIsSavingHours] = useState(false)
  const [isSavingAvailability, setIsSavingAvailability] = useState(false)

  const DAY_NAMES = [
    t('settings.days.0'),
    t('settings.days.1'),
    t('settings.days.2'),
    t('settings.days.3'),
    t('settings.days.4'),
    t('settings.days.5'),
    t('settings.days.6'),
  ]

  useEffect(() => {
    const fetch_ = async () => {
      const storedUser = getStoredUser()
      const token = getToken()
      if (!storedUser || !token) {
        setIsLoading(false)
        return
      }

      const headers = { Authorization: `Bearer ${token}` }
      try {
        const [profile, prefsRes, hoursRes, availRes] = await Promise.all([
          fetchProfile(),
          fetch(`${BACKEND}/faculty/preferences`, { headers }),
          fetch(`${BACKEND}/faculty/office-hours`, { headers }),
          fetch(`${BACKEND}/availability/me`, { headers }),
        ])
        setUser(profile)
        if (prefsRes.ok) setPreferences(await prefsRes.json())
        if (hoursRes.ok) setOfficeHours(await hoursRes.json())
        if (availRes.ok) setAvailability(await availRes.json())
      } catch {
        toast.error(t('settings.loadFail'))
      } finally {
        setIsLoading(false)
      }
    }
    void fetch_()
  }, [])

  const handlePreferenceChange = async (key: string, checked: boolean) => {
    setPreferences((prev: any) => ({ ...prev, [key]: checked }))
    try {
      const token = getToken()
      const res = await fetch(`${BACKEND}/faculty/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: checked }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('settings.preferenceUpdated'))
    } catch {
      toast.error(t('common.failed'))
      setPreferences((prev: any) => ({ ...prev, [key]: !checked }))
    }
  }

  const addSlot = () => setAvailability(prev => [...prev, { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }])
  const removeSlot = (i: number) => setAvailability(prev => prev.filter((_, j) => j !== i))
  const updateSlot = (i: number, key: keyof AvailabilitySlot, value: any) =>
    setAvailability(prev => prev.map((s, j) => j === i ? { ...s, [key]: value } : s))

  const handleSaveAvailability = async () => {
    setIsSavingAvailability(true)
    try {
      const token = getToken()
      const res = await fetch(`${BACKEND}/availability/me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slots: availability }),
      })
      if (!res.ok) throw new Error()
      setAvailability(await res.json())
      toast.success(t('settings.availabilitySuccess'))
    } catch {
      toast.error(t('settings.availabilityFail'))
    } finally {
      setIsSavingAvailability(false)
    }
  }

  const handleUpdateOfficeHours = async () => {
    setIsSavingHours(true)
    try {
      const token = getToken()
      const res = await fetch(`${BACKEND}/faculty/office-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(officeHours),
      })
      if (!res.ok) throw new Error()
      toast.success(t('settings.hoursSuccess'))
    } catch {
      toast.error(t('settings.hoursFail'))
    } finally {
      setIsSavingHours(false)
    }
  }

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!user) return null

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('settings.subtitle')}</p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><User className="size-4 text-emerald-600" /> {t('settings.profileSection')}</h2>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded"><Lock className="size-3" /> {t('settings.managedByUniversity')}</span>
          </div>
          {user.avatarUrl && (
            <div className="flex items-center gap-3">
              <img src={user.avatarUrl} alt="avatar" className="size-16 rounded-full object-cover border border-border" />
              <div>
                <p className="text-sm font-semibold">{user.fullName || user.name}</p>
                <p className="text-xs text-muted-foreground">{user.title}</p>
              </div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <ProfileField label={t('settings.firstName')} value={user.firstName} />
            <ProfileField label={t('settings.lastName')} value={user.lastName} />
            <ProfileField label={t('settings.email')} value={user.email} />
            <ProfileField label={t('settings.phone')} value={user.phoneNumber} />
            <ProfileField label={t('settings.staffNumber')} value={user.staffNumber} />
            <ProfileField label={t('settings.academicTitle')} value={user.title} />
            <ProfileField label={t('settings.faculty')} value={user.faculty} />
            <ProfileField label={t('settings.department')} value={user.department} />
            <ProfileField label={t('settings.gender')} value={user.gender} />
            <ProfileField label={t('settings.birthDate')} value={user.birthDate} />
            <ProfileField label={t('settings.address')} value={user.address} wide multiline />
            <ProfileField label={t('settings.bio')} value={user.bio} wide multiline />
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('settings.availabilitySection')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t('settings.bookingHint')}</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={addSlot}><Plus className="size-3.5" /> {t('settings.addSlot')}</Button>
          </div>
          {availability.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t('settings.noAvailabilitySlots')}</p>
          ) : (
            <div className="space-y-2">
              {availability.map((slot, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  <select value={slot.dayOfWeek} onChange={e => updateSlot(idx, 'dayOfWeek', parseInt(e.target.value))} className="bg-background border border-input rounded-md px-2 h-9 text-sm outline-none">
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <Input type="time" value={slot.startTime} onChange={e => updateSlot(idx, 'startTime', e.target.value)} className="w-32" />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="time" value={slot.endTime} onChange={e => updateSlot(idx, 'endTime', e.target.value)} className="w-32" />
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input type="checkbox" checked={slot.isActive} onChange={e => updateSlot(idx, 'isActive', e.target.checked)} className="rounded" /> {t('settings.active')}
                  </label>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10" onClick={() => removeSlot(idx)}><Trash2 className="size-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
          <Button size="sm" onClick={handleSaveAvailability} disabled={isSavingAvailability}>
            {isSavingAvailability ? <><Loader2 className="size-4 animate-spin mr-2" />{t('settings.savingAvailability')}</> : t('settings.saveAvailability')}
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{t('settings.officeHoursSection')}</h2>
          <p className="text-xs text-muted-foreground -mt-3">{t('settings.weekdayOfficeHours')}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>{t('settings.officeStart')}</Label><Input type="time" value={officeHours.startTime} onChange={e => setOfficeHours({ ...officeHours, startTime: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>{t('settings.officeEnd')}</Label><Input type="time" value={officeHours.endTime} onChange={e => setOfficeHours({ ...officeHours, endTime: e.target.value })} /></div>
          </div>
          <Button size="sm" onClick={handleUpdateOfficeHours} disabled={isSavingHours}>
            {isSavingHours ? <><Loader2 className="size-4 animate-spin mr-2" />{t('settings.savingHours')}</> : t('settings.saveOfficeHours')}
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{t('settings.notificationPreferences')}</h2>
          <div className="space-y-4">
            {[
              { key: 'emailEnabled', label: 'Email Notifications', desc: 'Receive updates via email' },
              { key: 'inAppEnabled', label: 'In-App Notifications', desc: 'Notifications inside the portal' },
              { key: 'reminderEmailEnabled', label: 'Appointment Reminders', desc: 'Email reminder before appointments' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-foreground">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                <Switch checked={preferences?.[key] ?? true} onCheckedChange={val => handlePreferenceChange(key, val)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
