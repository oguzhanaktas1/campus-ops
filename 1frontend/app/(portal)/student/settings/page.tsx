'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, User, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { fetchProfile, getStoredUser, getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

function ProfileField({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  const isEmpty = !value
  return (
    <div className={`space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {label === 'Bio' || label === 'Address' ? (
        <Textarea
          value={isEmpty ? '—' : value}
          readOnly
          className="bg-muted/50 cursor-not-allowed text-muted-foreground resize-none min-h-[70px]"
        />
      ) : (
        <Input
          value={isEmpty ? '—' : value}
          readOnly
          className="bg-muted/50 cursor-not-allowed text-muted-foreground"
        />
      )}
    </div>
  )
}

export default function StudentSettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [preferences, setPreferences] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      const storedUser = getStoredUser()
      const token = getToken()
      if (!storedUser || !token) {
        setIsLoading(false)
        return
      }

      const headers = { Authorization: `Bearer ${token}` }

      try {
        const [profile, prefsRes] = await Promise.all([
          fetchProfile(),
          fetch(`${BACKEND}/student/preferences`, { headers }),
        ])
        setUser(profile)
        if (prefsRes.ok) setPreferences(await prefsRes.json())
      } catch {
        toast.error('Failed to load settings.')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchSettings()
  }, [])

  const handlePreferenceChange = async (key: string, checked: boolean) => {
    setPreferences((prev: any) => ({ ...prev, [key]: checked }))
    try {
      const token = getToken()
      const res = await fetch(`${BACKEND}/student/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: checked }),
      })
      if (!res.ok) throw new Error()
      toast.success('Preference updated.')
    } catch {
      toast.error('Failed to update preference.')
      setPreferences((prev: any) => ({ ...prev, [key]: !checked }))
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwords.currentPassword || !passwords.newPassword) {
      toast.error('Please fill in all fields.')
      return
    }

    setIsChangingPassword(true)
    try {
      const token = getToken()
      const res = await fetch(`${BACKEND}/student/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(passwords),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message)
      }
      toast.success('Password changed!')
      setPasswords({ currentPassword: '', newPassword: '' })
    } catch (err: any) {
      toast.error(err.message || 'Failed.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your profile and account preferences
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="size-4 text-primary" /> Profile Information
            </h2>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded">
              <Lock className="size-3" /> Managed by University
            </span>
          </div>

          {user.avatarUrl && (
            <div className="flex items-center gap-3">
              <img
                src={user.avatarUrl}
                alt="avatar"
                className="size-16 rounded-full object-cover border border-border"
              />
              <div>
                <p className="text-sm font-semibold">{user.fullName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <ProfileField label="First Name" value={user.firstName} />
            <ProfileField label="Last Name" value={user.lastName} />
            <ProfileField label="Email" value={user.email} />
            <ProfileField
              label="Student Number"
              value={user.studentNumber || user.studentId}
            />
            <ProfileField label="Faculty" value={user.faculty} />
            <ProfileField label="Department" value={user.department} />
            <ProfileField label="Gender" value={user.gender} />
            <ProfileField label="Birth Date" value={user.birthDate} />
            <ProfileField label="Phone Number" value={user.phoneNumber} />
            <ProfileField label="Address" value={user.address} wide />
            <ProfileField label="Bio" value={user.bio} wide />
          </div>
        </div>

        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            Notification Preferences
          </h2>
          <div className="space-y-4">
            {[
              {
                key: 'emailEnabled',
                label: 'Email Notifications',
                desc: 'Receive updates via email',
              },
              {
                key: 'inAppEnabled',
                label: 'In-App Notifications',
                desc: 'Notifications inside the portal',
              },
              {
                key: 'reminderEmailEnabled',
                label: 'Appointment Reminders',
                desc: 'Email reminder before appointments',
              },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={preferences?.[key] ?? true}
                  onCheckedChange={(val) => handlePreferenceChange(key, val)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="size-4" /> Change Password
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  placeholder="********"
                  value={passwords.currentPassword}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      currentPassword: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input
                  type="password"
                  placeholder="********"
                  value={passwords.newPassword}
                  onChange={(e) =>
                    setPasswords({
                      ...passwords,
                      newPassword: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              type="submit"
              disabled={isChangingPassword}
            >
              {isChangingPassword && (
                <Loader2 className="size-4 animate-spin mr-2" />
              )}
              Update Password
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
