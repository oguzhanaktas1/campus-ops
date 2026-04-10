'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, User, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface AvailabilitySlot { id?: string; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }

function ProfileField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {label === 'Bio' || label === 'Address' ? (
        <Textarea value={value || '—'} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground resize-none min-h-[70px]" />
      ) : (
        <Input value={value || '—'} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground" />
      )}
    </div>
  )
}

export default function FacultySettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [preferences, setPreferences] = useState<any>(null)
  const [officeHours, setOfficeHours] = useState({ startTime: '09:00', endTime: '17:00' })
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingHours, setIsSavingHours] = useState(false)
  const [isSavingAvailability, setIsSavingAvailability] = useState(false)

  useEffect(() => {
    const fetch_ = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) return
      const headers = { Authorization: `Bearer ${token}` }
      try {
        const [profileRes, prefsRes, hoursRes, availRes] = await Promise.all([
          fetch(`${BACKEND}/auth/profile`, { headers }),
          fetch(`${BACKEND}/faculty/preferences`, { headers }),
          fetch(`${BACKEND}/faculty/office-hours`, { headers }),
          fetch(`${BACKEND}/availability/me`, { headers }),
        ])
        if (profileRes.ok) setUser(await profileRes.json())
        if (prefsRes.ok) setPreferences(await prefsRes.json())
        if (hoursRes.ok) setOfficeHours(await hoursRes.json())
        if (availRes.ok) setAvailability(await availRes.json())
      } catch { toast.error('Failed to load settings.') }
      finally { setIsLoading(false) }
    }
    fetch_()
  }, [])

  const handlePreferenceChange = async (key: string, checked: boolean) => {
    setPreferences((prev: any) => ({ ...prev, [key]: checked }))
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${BACKEND}/faculty/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: checked }),
      })
      if (!res.ok) throw new Error()
      toast.success('Preference updated.')
    } catch { toast.error('Failed.'); setPreferences((prev: any) => ({ ...prev, [key]: !checked })) }
  }

  const addSlot = () => setAvailability(prev => [...prev, { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }])
  const removeSlot = (i: number) => setAvailability(prev => prev.filter((_, j) => j !== i))
  const updateSlot = (i: number, key: keyof AvailabilitySlot, value: any) =>
    setAvailability(prev => prev.map((s, j) => j === i ? { ...s, [key]: value } : s))

  const handleSaveAvailability = async () => {
    setIsSavingAvailability(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${BACKEND}/availability/me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slots: availability }),
      })
      if (!res.ok) throw new Error()
      setAvailability(await res.json())
      toast.success('Availability saved.')
    } catch { toast.error('Could not save availability.') }
    finally { setIsSavingAvailability(false) }
  }

  const handleUpdateOfficeHours = async () => {
    setIsSavingHours(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${BACKEND}/faculty/office-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(officeHours),
      })
      if (!res.ok) throw new Error()
      toast.success('Office hours updated.')
    } catch { toast.error('Could not save office hours.') }
    finally { setIsSavingHours(false) }
  }

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!user) return null

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your profile and account preferences</p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">

        {/* Profile — read-only */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><User className="size-4 text-emerald-600" /> Profile Information</h2>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded"><Lock className="size-3" /> Managed by University</span>
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
            <ProfileField label="First Name"    value={user.firstName} />
            <ProfileField label="Last Name"     value={user.lastName} />
            <ProfileField label="Email"         value={user.email} />
            <ProfileField label="Phone"         value={user.phoneNumber} />
            <ProfileField label="Staff Number"  value={user.staffNumber} />
            <ProfileField label="Academic Title" value={user.title} />
            <ProfileField label="Faculty"       value={user.faculty} />
            <ProfileField label="Department"    value={user.department} />
            <ProfileField label="Gender"        value={user.gender} />
            <ProfileField label="Birth Date"    value={user.birthDate} />
            <ProfileField label="Address"       value={user.address} wide />
            <ProfileField label="Bio"           value={user.bio} wide />
          </div>
        </div>

        {/* Availability Slots */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Availability</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Shown to students when booking appointments.</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={addSlot}><Plus className="size-3.5" /> Add Slot</Button>
          </div>
          {availability.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No availability slots set.</p>
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
                    <input type="checkbox" checked={slot.isActive} onChange={e => updateSlot(idx, 'isActive', e.target.checked)} className="rounded" /> Active
                  </label>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10" onClick={() => removeSlot(idx)}><Trash2 className="size-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
          <Button size="sm" onClick={handleSaveAvailability} disabled={isSavingAvailability}>
            {isSavingAvailability && <Loader2 className="size-4 animate-spin mr-2" />} Save Availability
          </Button>
        </div>

        {/* Office Hours */}
        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Office Hours</h2>
          <p className="text-xs text-muted-foreground -mt-3">General weekday office hours.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Start</Label><Input type="time" value={officeHours.startTime} onChange={e => setOfficeHours({ ...officeHours, startTime: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>End</Label><Input type="time" value={officeHours.endTime} onChange={e => setOfficeHours({ ...officeHours, endTime: e.target.value })} /></div>
          </div>
          <Button size="sm" onClick={handleUpdateOfficeHours} disabled={isSavingHours}>
            {isSavingHours && <Loader2 className="size-4 animate-spin mr-2" />} Update Hours
          </Button>
        </div>

        {/* Notification Preferences */}
        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Notification Preferences</h2>
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
