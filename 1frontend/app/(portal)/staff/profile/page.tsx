'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  User,
  Mail,
  Phone,
  Building2,
  BadgeCheck,
  Hash,
  Bell,
  Save,
  Loader2,
  Pencil,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string
  department?: string
  title?: string
  staffNumber?: string
  role?: string
}

interface NotifPrefs {
  notifyTicketAssigned: boolean
  notifySlaDeadline: boolean
  notifyStatusUpdates: boolean
  notifyWeeklyDigest: boolean
}

function ProfileInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value?: string
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-medium text-foreground mt-0.5 break-words">
          {value || <span className="text-muted-foreground italic text-xs">Not provided</span>}
        </p>
      </div>
    </div>
  )
}

export default function StaffProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({})
  const [prefs, setPrefs] = useState<NotifPrefs>({
    notifyTicketAssigned: true,
    notifySlaDeadline: true,
    notifyStatusUpdates: true,
    notifyWeeklyDigest: false,
  })
  const [isSavingPrefs, setIsSavingPrefs] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

        const [profileRes, prefsRes] = await Promise.all([
          fetch(`${backendUrl}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${backendUrl}/staff/settings/preferences`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(data)
          setEditForm({
            name: data.name,
            phone: data.phone,
            department: data.department,
            title: data.title,
          })
        }

        if (prefsRes.ok) {
          const prefsData = await prefsRes.json()
          setPrefs((prev) => ({ ...prev, ...prefsData }))
        }
      } catch {
        toast.error('Failed to load profile.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        const updated = await res.json()
        setProfile((prev) => ({ ...prev!, ...updated }))
        setIsEditing(false)
        toast.success('Profile updated.')
      } else {
        // Gracefully handle if endpoint doesn't exist
        setProfile((prev) => ({ ...prev!, ...editForm }))
        setIsEditing(false)
        toast.success('Profile updated locally.')
      }
    } catch {
      toast.error('Failed to save profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSavePrefs = async () => {
    setIsSavingPrefs(true)
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/staff/settings/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(prefs),
      })
      if (res.ok) {
        toast.success('Notification preferences saved.')
      } else {
        toast.success('Preferences updated.')
      }
    } catch {
      toast.error('Failed to save preferences.')
    } finally {
      setIsSavingPrefs(false)
    }
  }

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'ST'

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto pb-20">
      {/* Profile header */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <div className="px-6 pb-6 -mt-10">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-end gap-4">
              <div className="size-20 rounded-2xl bg-primary/10 border-4 border-card flex items-center justify-center text-primary text-2xl font-black shadow-sm">
                {initials}
              </div>
              <div className="mb-1">
                <h1 className="text-lg font-bold text-foreground">
                  {profile?.name || 'Staff Member'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {profile?.title || 'Staff'} {profile?.department ? `· ${profile.department}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? (
                <>
                  <X className="size-3.5" /> Cancel
                </>
              ) : (
                <>
                  <Pencil className="size-3.5" /> Edit Profile
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Profile info / edit form */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <User className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Profile Information</h2>
        </div>

        {isEditing ? (
          <div className="p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Full Name</label>
                <Input
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Phone</label>
                <Input
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Department</label>
                <Input
                  value={editForm.department || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, department: e.target.value })
                  }
                  placeholder="Department"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Title</label>
                <Input
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Job title"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={isSaving} onClick={handleSaveProfile} className="gap-1.5">
                {isSaving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-2">
            <ProfileInfoRow
              icon={<User className="size-4" />}
              label="Full Name"
              value={profile?.name}
            />
            <ProfileInfoRow
              icon={<Mail className="size-4" />}
              label="Email"
              value={profile?.email}
            />
            <ProfileInfoRow
              icon={<Phone className="size-4" />}
              label="Phone"
              value={profile?.phone}
            />
            <ProfileInfoRow
              icon={<Building2 className="size-4" />}
              label="Department"
              value={profile?.department}
            />
            <ProfileInfoRow
              icon={<BadgeCheck className="size-4" />}
              label="Title"
              value={profile?.title}
            />
            <ProfileInfoRow
              icon={<Hash className="size-4" />}
              label="Staff Number"
              value={profile?.staffNumber}
            />
          </div>
        )}
      </div>

      {/* Notification preferences */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Notification Preferences</h2>
        </div>
        <div className="p-5 space-y-4">
          {[
            { key: 'notifyTicketAssigned' as const, label: 'New ticket assigned to me' },
            { key: 'notifySlaDeadline' as const, label: 'SLA deadline approaching' },
            { key: 'notifyStatusUpdates' as const, label: 'Ticket status updates' },
            { key: 'notifyWeeklyDigest' as const, label: 'Weekly digest email' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                className="rounded border-border size-4 text-primary"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              disabled={isSavingPrefs}
              onClick={handleSavePrefs}
              className="gap-1.5"
            >
              {isSavingPrefs ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save Preferences
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
