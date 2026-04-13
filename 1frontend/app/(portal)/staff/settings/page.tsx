'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, User, Bell, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { fetchProfile, getStoredUser } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

function ProfileField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {label === 'Address' ? (
        <Textarea value={value || '-'} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground resize-none min-h-[70px]" />
      ) : (
        <Input value={value || '-'} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground" />
      )}
    </div>
  )
}

export default function StaffSettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [prefs, setPrefs] = useState({ notifyTicketAssigned: true, notifySlaDeadline: true, notifyStatusUpdates: true, notifyWeeklyDigest: false })
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetch_ = async () => {
      const storedUser = getStoredUser()
      if (!storedUser) {
        setIsLoading(false)
        return
      }

      const token = localStorage.getItem('access_token')
      const headers = { Authorization: `Bearer ${token}` }

      try {
        const [profile, prefsRes] = await Promise.all([
          fetchProfile(),
          fetch(`${BACKEND}/staff/settings/preferences`, { headers }),
        ])
        setUser(profile)
        if (prefsRes.ok) {
          const d = await prefsRes.json()
          setPrefs((p) => ({ ...p, ...d }))
        }
      } catch {
        toast.error('Failed to load settings.')
      } finally {
        setIsLoading(false)
      }
    }
    void fetch_()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    const token = localStorage.getItem('access_token')
    try {
      await fetch(`${BACKEND}/staff/settings/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(prefs),
      })

      if (passwords.currentPassword || passwords.newPassword) {
        if (passwords.newPassword !== passwords.confirmPassword) {
          toast.error('Passwords do not match!')
          setIsSaving(false)
          return
        }
        const res = await fetch(`${BACKEND}/staff/settings/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
        })
        if (!res.ok) {
          const e = await res.json()
          toast.error(e.message || 'Failed.')
          setIsSaving(false)
          return
        }
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      }
      toast.success('Settings saved!')
    } catch {
      toast.error('Failed to save.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!user) return null

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your profile and account preferences</p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><User className="size-4 text-amber-600" /> Profile Information</h2>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded"><Lock className="size-3" /> Managed by University</span>
        </div>
        <div className="p-5 space-y-4">
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
            <ProfileField label="First Name" value={user.firstName} />
            <ProfileField label="Last Name" value={user.lastName} />
            <ProfileField label="Email" value={user.email} />
            <ProfileField label="Phone" value={user.phoneNumber} />
            <ProfileField label="Staff Number" value={user.staffNumber} />
            <ProfileField label="Title" value={user.title} />
            <ProfileField label="Department" value={user.department} />
            <ProfileField label="Gender" value={user.gender} />
            <ProfileField label="Birth Date" value={user.birthDate} />
            <ProfileField label="Address" value={user.address} wide />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Notification Preferences</h2>
        </div>
        <div className="p-5 space-y-3">
          {[
            { key: 'notifyTicketAssigned', label: 'New ticket assigned to me' },
            { key: 'notifySlaDeadline', label: 'SLA deadline approaching' },
            { key: 'notifyStatusUpdates', label: 'Ticket status updates' },
            { key: 'notifyWeeklyDigest', label: 'Weekly digest email' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={(prefs as any)[key]} onChange={e => setPrefs({ ...prefs, [key]: e.target.checked })} className="rounded border-border size-4 text-primary" />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Shield className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5"><Label>Current Password</Label><Input type="password" placeholder="********" value={passwords.currentPassword} onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>New Password</Label><Input type="password" placeholder="********" value={passwords.newPassword} onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Confirm Password</Label><Input type="password" placeholder="********" value={passwords.confirmPassword} onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })} /></div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
          {isSaving && <Loader2 className="size-3.5 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
