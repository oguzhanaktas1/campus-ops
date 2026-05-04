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
  multiline = false,
}: {
  label: string
  value: string
  wide?: boolean
  multiline?: boolean
}) {
  const isEmpty = !value
  return (
    <div className={`space-y-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
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

export default function OrganizerSettingsPage() {
  const { t } = useI18n()
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
          fetch(`${BACKEND}/organizer/preferences`, { headers }),
        ])
        setUser(profile)
        if (prefsRes.ok) setPreferences(await prefsRes.json())
      } catch {
        toast.error(t('pages.settingsLoadFail'))
      } finally {
        setIsLoading(false)
      }
    }

    void fetchSettings()
  }, [t])

  const handlePreferenceChange = async (key: string, checked: boolean) => {
    setPreferences((prev: any) => ({ ...prev, [key]: checked }))
    try {
      const token = getToken()
      const res = await fetch(`${BACKEND}/organizer/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: checked }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('pages.preferenceUpdated'))
    } catch {
      toast.error(t('pages.preferenceUpdateFail'))
      setPreferences((prev: any) => ({ ...prev, [key]: !checked }))
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwords.currentPassword || !passwords.newPassword) {
      toast.error(t('pages.fillAllFields'))
      return
    }

    setIsChangingPassword(true)
    try {
      const token = getToken()
      const res = await fetch(`${BACKEND}/organizer/change-password`, {
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
      toast.success(t('pages.passwordChanged'))
      setPasswords({ currentPassword: '', newPassword: '' })
    } catch (err: any) {
      toast.error(err.message || t('common.failed'))
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
        <h1 className="text-xl font-bold text-foreground">{t('common.settings')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('pages.settingsSubtitle')}
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="size-4 text-primary" /> {t('pages.profileInformation')}
            </h2>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded">
              <Lock className="size-3" /> {t('pages.managedByUniversity')}
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
            <ProfileField label={t('pages.firstName')} value={user.firstName} />
            <ProfileField label={t('pages.lastName')} value={user.lastName} />
            <ProfileField label={t('pages.email')} value={user.email} />
            <ProfileField label={t('pages.staffNumber')} value={user.staffNumber || user.staffId} />
            <ProfileField label={t('pages.faculty')} value={user.faculty} />
            <ProfileField label={t('pages.department')} value={user.department} />
            <ProfileField label={t('pages.titleLabel')} value={user.title} />
            <ProfileField label={t('pages.phoneNumber')} value={user.phoneNumber} />
            <ProfileField label={t('pages.address')} value={user.address} wide multiline />
            <ProfileField label={t('pages.bio')} value={user.bio} wide multiline />
          </div>
        </div>

        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">
            {t('pages.notificationPreferences')}
          </h2>
          <div className="space-y-4">
            {[
              {
                key: 'emailEnabled',
                label: t('pages.emailNotifications'),
                desc: t('pages.emailNotificationsDesc'),
              },
              {
                key: 'inAppEnabled',
                label: t('pages.inAppNotifications'),
                desc: t('pages.inAppNotificationsDesc'),
              },
              {
                key: 'reminderEmailEnabled',
                label: t('pages.eventReminders'),
                desc: t('pages.eventRemindersDesc'),
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
            <Shield className="size-4" /> {t('pages.changePassword')}
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('pages.currentPassword')}</Label>
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
                <Label>{t('pages.newPassword')}</Label>
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
              {t('pages.updatePassword')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
