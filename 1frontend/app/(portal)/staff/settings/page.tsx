'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User, Bell, Shield, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function StaffSettingsPage() {
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>({ name: '', email: '', title: '', department: '' })

  // Bildirim Tercihleri State'i
  const [prefs, setPrefs] = useState({
    notifyTicketAssigned: true,
    notifySlaDeadline: true,
    notifyStatusUpdates: true,
    notifyWeeklyDigest: false,
  })

  // Şifre Değiştirme State'i
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // Sayfa açıldığında veritabanından mevcut bildirim ayarlarını çek
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const headers = { Authorization: `Bearer ${token}` }

        const [profileRes, prefsRes] = await Promise.all([
          fetch(`${backendUrl}/auth/profile`, { headers }),
          fetch(`${backendUrl}/staff/settings/preferences`, { headers }),
        ])

        if (profileRes.ok) {
          const profileData = await profileRes.json()
          setUser({
            name: profileData.profile?.fullName || profileData.email || '',
            email: profileData.email || '',
            title: profileData.profile?.title || '',
            department: profileData.profile?.department || '',
          })
        }

        if (prefsRes.ok) {
          const data = await prefsRes.json()
          // DB'den gelen verileri state'e yaz
          setPrefs({
            notifyTicketAssigned: data.notifyTicketAssigned ?? true,
            notifySlaDeadline: data.notifySlaDeadline ?? true,
            notifyStatusUpdates: data.notifyStatusUpdates ?? true,
            notifyWeeklyDigest: data.notifyWeeklyDigest ?? false,
          })
        }
      } catch (error) {
        console.error('Tercihler yüklenemedi', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreferences()
  }, [])

  // Ana Kaydetme (Save) İşlemi
  const handleSave = async () => {
    setIsSaving(true)
    const token = localStorage.getItem('access_token')
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

    try {
      // 1. Bildirim Tercihlerini Kaydet
      await fetch(`${backendUrl}/staff/settings/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(prefs)
      })

      // 2. Eğer şifre alanları doldurulduysa Şifre Değiştirme İsteği At
      if (passwords.currentPassword || passwords.newPassword) {
        if (passwords.newPassword !== passwords.confirmPassword) {
          toast.error('Yeni şifreler birbiriyle eşleşmiyor!')
          setIsSaving(false)
          return
        }

        const passRes = await fetch(`${backendUrl}/staff/settings/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            currentPassword: passwords.currentPassword,
            newPassword: passwords.newPassword
          })
        })

        if (!passRes.ok) {
          const errorData = await passRes.json()
          toast.error(errorData.message || 'Şifre değiştirilemedi.')
          setIsSaving(false)
          return
        }

        // Şifre başarıyla değiştiyse kutuları temizle
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
        toast.success('Şifreniz başarıyla güncellendi.')
      }

      toast.success('Ayarlarınız kaydedildi!')
    } catch (err) {
      toast.error('Kayıt sırasında bir hata oluştu.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="size-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto pb-20">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your staff account preferences.</p>
      </div>

      {/* Profile - SESSİZCE KİLİTLENDİ (disabled) */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <User className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Profile</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-300 text-lg font-bold flex-shrink-0">
              {user.name.split(' ').map((n: string) => n[0]).join('')}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.title} · {user.department}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Full Name</label>
                <Input value={user.name} disabled className="bg-muted/50 cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email</label>
                <Input value={user.email} type="email" disabled className="bg-muted/50 cursor-not-allowed" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Department</label>
                <Input value={user.department} disabled className="bg-muted/50 cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Title</label>
                <Input value={user.title} disabled className="bg-muted/50 cursor-not-allowed" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications - GERÇEK STATE'E BAĞLI */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Bell className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Notification Preferences</h2>
        </div>
        <div className="p-5 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={prefs.notifyTicketAssigned} 
              onChange={(e) => setPrefs({...prefs, notifyTicketAssigned: e.target.checked})}
              className="rounded border-border size-4 text-primary" 
            />
            <span className="text-sm text-foreground">New ticket assigned to me</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={prefs.notifySlaDeadline} 
              onChange={(e) => setPrefs({...prefs, notifySlaDeadline: e.target.checked})}
              className="rounded border-border size-4 text-primary" 
            />
            <span className="text-sm text-foreground">SLA deadline approaching</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={prefs.notifyStatusUpdates} 
              onChange={(e) => setPrefs({...prefs, notifyStatusUpdates: e.target.checked})}
              className="rounded border-border size-4 text-primary" 
            />
            <span className="text-sm text-foreground">Ticket status updates</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={prefs.notifyWeeklyDigest} 
              onChange={(e) => setPrefs({...prefs, notifyWeeklyDigest: e.target.checked})}
              className="rounded border-border size-4 text-primary" 
            />
            <span className="text-sm text-foreground">Weekly digest email</span>
          </label>
        </div>
      </div>

      {/* Security - GERÇEK ŞİFRE DEĞİŞTİRME */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Shield className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Security</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Current Password</label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({...passwords, currentPassword: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">New Password</label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={passwords.newPassword}
              onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Confirm New Password</label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
          {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}