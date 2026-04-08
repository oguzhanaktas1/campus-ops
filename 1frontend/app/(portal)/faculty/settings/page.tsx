'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Lock, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface AvailabilitySlot {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
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
    const fetchSettingsData = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) return

      const backendUrl = BACKEND
      const headers = { Authorization: `Bearer ${token}` }

      try {
        const [profileRes, prefsRes, hoursRes, availRes] = await Promise.all([
          fetch(`${backendUrl}/auth/profile`, { headers }),
          fetch(`${backendUrl}/faculty/preferences`, { headers }),
          fetch(`${backendUrl}/faculty/office-hours`, { headers }),
          fetch(`${backendUrl}/availability/me`, { headers }),
        ])

        if (profileRes.ok) setUser(await profileRes.json())
        if (prefsRes.ok) setPreferences(await prefsRes.json())
        if (hoursRes.ok) setOfficeHours(await hoursRes.json())
        if (availRes.ok) setAvailability(await availRes.json())
      } catch (error) {
        console.error('Settings fetch error:', error)
        toast.error('Failed to load settings.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettingsData()
  }, [])

  // 🔥 BİLDİRİM TERCİHLERİNİ GÜNCELLEME 🔥
  const handlePreferenceChange = async (key: string, checked: boolean) => {
    setPreferences((prev: any) => ({ ...prev, [key]: checked }))

    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      
      const res = await fetch(`${backendUrl}/faculty/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ [key]: checked })
      })

      if (!res.ok) throw new Error('Failed')
      toast.success('Preference updated successfully.')
    } catch (error) {
      toast.error('Failed to update preference.')
      setPreferences((prev: any) => ({ ...prev, [key]: !checked }))
    }
  }

  const addSlot = () =>
    setAvailability((prev) => [...prev, { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }])

  const removeSlot = (idx: number) =>
    setAvailability((prev) => prev.filter((_, i) => i !== idx))

  const updateSlot = (idx: number, key: keyof AvailabilitySlot, value: any) =>
    setAvailability((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)))

  const handleSaveAvailability = async () => {
    setIsSavingAvailability(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${BACKEND}/availability/me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slots: availability }),
      })
      if (!res.ok) throw new Error('Failed')
      setAvailability(await res.json())
      toast.success('Availability saved.')
    } catch {
      toast.error('Could not save availability.')
    } finally {
      setIsSavingAvailability(false)
    }
  }

  // OFİS SAATLERİNİ GÜNCELLEME
  const handleUpdateOfficeHours = async () => {
    setIsSavingHours(true)
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      
      const res = await fetch(`${backendUrl}/faculty/office-hours`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(officeHours)
      })

      if (!res.ok) throw new Error('Failed to update hours')
      toast.success('Office hours updated for weekdays.')
    } catch (error) {
      toast.error('Could not save office hours.')
    } finally {
      setIsSavingHours(false)
    }
  }

  if (isLoading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  }

  if (!user) return null

  // Backend'in "flat" yapısından verileri al
  const fullName = user.fullName || user.name || 'Not Set'
  const email = user.email || 'Not Set'
  const title = user.title || 'Not Set'
  const departmentName = user.department || 'Not Set'

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your faculty account preferences</p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        
        {/* 🔥 KİLİTLİ PROFİL BİLGİLERİ 🔥 */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Profile Information</h2>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded">
              <Lock className="size-3" /> Managed by University
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input defaultValue={fullName} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>Academic Title</Label>
              <Input defaultValue={title} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input defaultValue={email} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input defaultValue={departmentName} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* AVAILABILITY SLOTS */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Availability</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Shown to students when booking appointments.</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={addSlot}>
              <Plus className="size-3.5" /> Add Slot
            </Button>
          </div>
          {availability.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No availability slots set.</p>
          ) : (
            <div className="space-y-2">
              {availability.map((slot, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={slot.dayOfWeek}
                    onChange={(e) => updateSlot(idx, 'dayOfWeek', parseInt(e.target.value))}
                    className="bg-background border border-input rounded-md px-2 h-9 text-sm focus:ring-2 focus:ring-primary outline-none"
                  >
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <Input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(idx, 'startTime', e.target.value)}
                    className="w-32"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(idx, 'endTime', e.target.value)}
                    className="w-32"
                  />
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slot.isActive}
                      onChange={(e) => updateSlot(idx, 'isActive', e.target.checked)}
                      className="rounded"
                    />
                    Active
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:bg-destructive/10"
                    onClick={() => removeSlot(idx)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button size="sm" onClick={handleSaveAvailability} disabled={isSavingAvailability}>
            {isSavingAvailability && <Loader2 className="size-4 animate-spin mr-2" />}
            Save Availability
          </Button>
        </div>

        {/* OFFICE HOURS */}
        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Office Hours</h2>
          <p className="text-xs text-muted-foreground -mt-3">General weekday office hours.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="time" value={officeHours.startTime} onChange={(e) => setOfficeHours({ ...officeHours, startTime: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="time" value={officeHours.endTime} onChange={(e) => setOfficeHours({ ...officeHours, endTime: e.target.value })} />
            </div>
          </div>
          <Button size="sm" onClick={handleUpdateOfficeHours} disabled={isSavingHours}>
            {isSavingHours && <Loader2 className="size-4 animate-spin mr-2" />}
            Update Hours
          </Button>
        </div>

        {/* 🔥 GERÇEK BİLDİRİM TERCİHLERİ 🔥 */}
        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Notification Preferences</h2>
          <div className="space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Receive updates via email for new requests</p>
              </div>
              <Switch 
                checked={preferences?.emailEnabled ?? true} 
                onCheckedChange={(val) => handlePreferenceChange('emailEnabled', val)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">In-App Notifications</p>
                <p className="text-xs text-muted-foreground">Get notified inside the portal</p>
              </div>
              <Switch 
                checked={preferences?.inAppEnabled ?? true} 
                onCheckedChange={(val) => handlePreferenceChange('inAppEnabled', val)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Appointment Reminders</p>
                <p className="text-xs text-muted-foreground">Email reminder before scheduled appointments</p>
              </div>
              <Switch 
                checked={preferences?.reminderEmailEnabled ?? true} 
                onCheckedChange={(val) => handlePreferenceChange('reminderEmailEnabled', val)}
              />
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}