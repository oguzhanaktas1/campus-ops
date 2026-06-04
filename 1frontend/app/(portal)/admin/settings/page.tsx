'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { User, Bell, Shield, Save, Loader2, Camera, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

export default function AdminSettingsPage() {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState('profile')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [profile, setProfile] = useState({
    firstName: '', lastName: '', email: '', phoneNumber: '',
    title: '', gender: '', birthDate: '', address: '', bio: '', avatarUrl: '',
  })

  const [prefs, setPrefs] = useState({
    emailEnabled: true, inAppEnabled: true,
    marketingEmailEnabled: false, reminderEmailEnabled: true,
  })

  const [passwords, setPasswords] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  })

  const sections = [
    { id: 'profile', label: t('settings.profile'), icon: User },
    { id: 'notifications', label: t('settings.notifications'), icon: Bell },
    { id: 'security', label: t('settings.security'), icon: Shield },
  ]

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const headers = { Authorization: `Bearer ${token}` }
        const [resProf, resPrefs] = await Promise.all([
          fetch(`${BACKEND}/admin/settings/me`, { headers }),
          fetch(`${BACKEND}/admin/settings/preferences`, { headers }),
        ])

        if (resProf.ok) {
          const d = await resProf.json()
          setProfile({
            firstName:   d.profile?.firstName  ?? d.name?.split(' ')[0] ?? '',
            lastName:    d.profile?.lastName   ?? d.name?.split(' ').slice(1).join(' ') ?? '',
            email:       d.email ?? '',
            phoneNumber: d.phoneNumber ?? '',
            title:       d.profile?.title ?? '',
            gender:      d.profile?.gender ?? '',
            birthDate:   d.profile?.birthDate ? new Date(d.profile.birthDate).toISOString().split('T')[0] : '',
            address:     d.profile?.address ?? '',
            bio:         d.profile?.bio ?? '',
            avatarUrl:   d.profile?.avatarUrl ?? '',
          })
        }

        if (resPrefs.ok) {
          const p = await resPrefs.json()
          setPrefs({ emailEnabled: p.emailEnabled, inAppEnabled: p.inAppEnabled, marketingEmailEnabled: p.marketingEmailEnabled, reminderEmailEnabled: p.reminderEmailEnabled })
        }
      } catch { toast.error(t('settings.loadFail')) }
      finally { setIsLoading(false) }
    }
    fetch_()
  }, [])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setProfile(p => ({ ...p, avatarUrl: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const token = localStorage.getItem('access_token')
    try {
      if (activeSection === 'profile') {
        const res = await fetch(`${BACKEND}/admin/settings/me`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: `${profile.firstName} ${profile.lastName}`.trim(),
            ...profile,
          }),
        })
        if (res.ok) toast.success(t('settings.saveSuccess'))
        else throw new Error()
      }

      if (activeSection === 'notifications') {
        await fetch(`${BACKEND}/admin/settings/preferences`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(prefs),
        })
        toast.success(t('settings.prefsSaved'))
      }

      if (activeSection === 'security' && (passwords.currentPassword || passwords.newPassword)) {
        if (passwords.newPassword !== passwords.confirmPassword) { toast.error(t('settings.passwordMismatch')); setIsSaving(false); return }
        const res = await fetch(`${BACKEND}/admin/settings/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
        })
        if (res.ok) { toast.success(t('settings.passwordUpdated')); setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' }) }
        else { const e = await res.json(); toast.error(e.message || t('settings.saveFail')) }
      }
    } catch { toast.error(t('settings.saveFail')) }
    finally { setIsSaving(false) }
  }

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>

  const initials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase()

  return (
    <div className="p-6 max-w-4xl mx-auto pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('settings.subtitle')}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="md:w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map(s => {
              const Icon = s.icon
              return (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    activeSection === s.id ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-muted'
                  )}>
                  <Icon className="size-4" /> {s.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="flex-1 space-y-5">

          {/* ── Profile Section ── */}
          {activeSection === 'profile' && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
                <User className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{t('settings.editProfile')}</h2>
              </div>
              <div className="p-5 space-y-5">

                {/* Avatar upload */}
                <div className="flex items-center gap-4">
                  <label htmlFor="admin-avatar" className="cursor-pointer group relative">
                    <div className="size-20 rounded-full border-2 border-dashed border-muted-foreground/40 overflow-hidden bg-muted flex items-center justify-center group-hover:border-primary transition-colors">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                      ) : initials ? (
                        <span className="text-xl font-bold text-muted-foreground">{initials}</span>
                      ) : (
                        <UserCircle className="size-10 text-muted-foreground/50" />
                      )}
                      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="size-5 text-white" />
                      </div>
                    </div>
                  </label>
                  <input id="admin-avatar" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{`${profile.firstName} ${profile.lastName}`.trim() || 'Admin'}</p>
                    <p className="text-xs text-muted-foreground">{profile.email}</p>
                    {profile.avatarUrl && (
                      <button type="button" className="text-xs text-destructive hover:underline mt-1" onClick={() => setProfile(p => ({ ...p, avatarUrl: '' }))}>{t('settings.removePhoto')}</button>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('settings.firstName')}</Label>
                    <Input value={profile.firstName} onChange={e => setProfile({ ...profile, firstName: e.target.value })} placeholder={t('settings.firstNamePlaceholder')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings.lastName')}</Label>
                    <Input value={profile.lastName} onChange={e => setProfile({ ...profile, lastName: e.target.value })} placeholder={t('settings.lastNamePlaceholder')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings.email')}</Label>
                    <Input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings.phone')}</Label>
                    <Input value={profile.phoneNumber} onChange={e => setProfile({ ...profile, phoneNumber: e.target.value })} placeholder={t('settings.phonePlaceholder')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings.titleField')}</Label>
                    <Input value={profile.title} onChange={e => setProfile({ ...profile, title: e.target.value })} placeholder={t('settings.titlePlaceholder')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings.gender')}</Label>
                    <select value={profile.gender} onChange={e => setProfile({ ...profile, gender: e.target.value })}
                      className="w-full h-10 bg-background border border-input rounded-md px-3 text-sm focus:ring-2 focus:ring-primary outline-none">
                      <option value="">{t('settings.genderSelect')}</option>
                      <option value="MALE">{t('settings.genderMale')}</option>
                      <option value="FEMALE">{t('settings.genderFemale')}</option>
                      <option value="OTHER">{t('settings.genderOther')}</option>
                      <option value="PREFER_NOT_TO_SAY">{t('settings.genderPreferNot')}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('settings.birthDate')}</Label>
                    <Input type="date" value={profile.birthDate} onChange={e => setProfile({ ...profile, birthDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{t('settings.address')}</Label>
                    <Textarea value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} placeholder={t('settings.addressPlaceholder')} className="min-h-[70px] resize-none" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{t('settings.bio')}</Label>
                    <Textarea value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} placeholder={t('settings.bioPlaceholder')} className="min-h-[70px] resize-none" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeSection === 'notifications' && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
                <Bell className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{t('settings.notificationPreferences')}</h2>
              </div>
              <div className="p-5 space-y-4">
                {Object.entries(prefs).map(([key, value]) => (
                  <label key={key} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                    <span className="text-sm font-medium text-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <input type="checkbox" checked={value} onChange={e => setPrefs({ ...prefs, [key]: e.target.checked })} className="size-4 rounded border-border text-primary focus:ring-primary" />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Security ── */}
          {activeSection === 'security' && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
                <Shield className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{t('settings.changePassword')}</h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5"><Label>{t('settings.currentPassword')}</Label><Input type="password" value={passwords.currentPassword} onChange={e => setPasswords({ ...passwords, currentPassword: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>{t('settings.newPassword')}</Label><Input type="password" value={passwords.newPassword} onChange={e => setPasswords({ ...passwords, newPassword: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>{t('settings.confirmPassword')}</Label><Input type="password" value={passwords.confirmPassword} onChange={e => setPasswords({ ...passwords, confirmPassword: e.target.value })} /></div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="px-8 shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {isSaving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
