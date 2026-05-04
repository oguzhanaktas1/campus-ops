'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, User, Bell, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { fetchProfile, getStoredUser } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

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

export default function StaffSettingsPage() {
  const { t } = useI18n()
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
        toast.error(t('pages.settingsLoadFail'))
      } finally {
        setIsLoading(false)
      }
    }
    void fetch_()
  }, [t])

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
          toast.error(t('pages.passwordsMismatch'))
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
          toast.error(e.message || t('common.failed'))
          setIsSaving(false)
          return
        }
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      }
      toast.success(t('pages.settingsSaveSuccess'))
    } catch {
      toast.error(t('pages.settingsSaveFail'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="size-8 animate-spin text-primary" /></div>
  if (!user) return null

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('pages.settings')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('pages.settingsSubtitle')}</p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><User className="size-4 text-amber-600" /> {t('pages.profileInformation')}</h2>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted px-2 py-1 rounded"><Lock className="size-3" /> {t('pages.managedByUniversity')}</span>
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
            <ProfileField label={t('pages.firstName')} value={user.firstName} />
            <ProfileField label={t('pages.lastName')} value={user.lastName} />
            <ProfileField label={t('pages.email')} value={user.email} />
            <ProfileField label={t('pages.phone')} value={user.phoneNumber} />
            <ProfileField label={t('pages.staffNumber')} value={user.staffNumber} />
            <ProfileField label={t('pages.titleLabel')} value={user.title} />
            <ProfileField label={t('pages.department')} value={user.department} />
            <ProfileField label={t('pages.gender')} value={user.gender} />
            <ProfileField label={t('pages.birthDate')} value={user.birthDate} />
            <ProfileField label={t('pages.address')} value={user.address} wide multiline />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">{t('pages.notificationPreferences')}</h2>
        </div>
        <div className="p-5 space-y-3">
          {[
            { key: 'notifyTicketAssigned', label: t('pages.notifyTicketAssigned') },
            { key: 'notifySlaDeadline', label: t('pages.notifySlaDeadline') },
            { key: 'notifyStatusUpdates', label: t('pages.notifyStatusUpdates') },
            { key: 'notifyWeeklyDigest', label: t('pages.notifyWeeklyDigest') },
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
          <h2 className="text-sm font-semibold text-foreground">{t('pages.changePassword')}</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5"><Label>{t('pages.currentPassword')}</Label><Input type="password" placeholder="********" value={passwords.currentPassword} onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{t('pages.newPassword')}</Label><Input type="password" placeholder="********" value={passwords.newPassword} onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>{t('pages.confirmPassword')}</Label><Input type="password" placeholder="********" value={passwords.confirmPassword} onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })} /></div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
          {isSaving && <Loader2 className="size-3.5 animate-spin" />}
          {t('common.saveChanges')}
        </Button>
      </div>
    </div>
  )
}
