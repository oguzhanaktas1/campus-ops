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
import { useI18n } from '@/lib/i18n'

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
      {wide ? (
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
  const { t } = useI18n()

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
        toast.error(t('messages.loadSettingsFail'))
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
      toast.success(t('messages.preferenceUpdated'))
    } catch {
      toast.error(t('messages.updatePreferenceFail'))
      setPreferences((prev: any) => ({ ...prev, [key]: !checked }))
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwords.currentPassword || !passwords.newPassword) {
      toast.error(t('messages.fillAllFields'))
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
      toast.success(t('messages.passwordChanged'))
      setPasswords({ currentPassword: '', newPassword: '' })
    } catch (err: any) {
      toast.error(err.message || t('messages.failed'))
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
        <h1 className="text-xl font-bold text-foreground">{t('pages.settingsTitle')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('pages.settingsSubtitle')}
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="size-4 text-primary" /> {t('forms.profileInformation')}
            </h2>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded">
              <Lock className="size-3" /> {t('forms.managedByUniversity')}
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
            <ProfileField label={t('forms.firstName')} value={user.firstName} />
            <ProfileField label={t('forms.lastName')} value={user.lastName} />
            <ProfileField label={t('forms.email')} value={user.email} />
            <ProfileField
              label={t('forms.studentNumber')}
              value={user.studentNumber || user.studentId}
            />
            <ProfileField label={t('forms.faculty')} value={user.faculty} />
            <ProfileField label={t('forms.department')} value={user.department} />
            <ProfileField label={t('forms.gender')} value={user.gender} />
            <ProfileField label={t('forms.birthDate')} value={user.birthDate} />
            <ProfileField label={t('forms.phoneNumber')} value={user.phoneNumber} />
            <ProfileField label={t('forms.address')} value={user.address} wide />
            <ProfileField label={t('forms.bio')} value={user.bio} wide />
          </div>
        </div>

        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            {t('forms.notificationPreferences')}
          </h2>
          <div className="space-y-4">
            {[
              {
                key: 'emailEnabled',
                label: t('forms.emailNotifications'),
                desc: t('forms.emailNotificationsDesc'),
              },
              {
                key: 'inAppEnabled',
                label: t('forms.inAppNotifications'),
                desc: t('forms.inAppNotificationsDesc'),
              },
              {
                key: 'reminderEmailEnabled',
                label: t('forms.appointmentReminders'),
                desc: t('forms.appointmentRemindersDesc'),
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
            <Shield className="size-4" /> {t('forms.changePassword')}
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('forms.currentPassword')}</Label>
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
                <Label>{t('forms.newPassword')}</Label>
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
              {t('forms.updatePassword')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
