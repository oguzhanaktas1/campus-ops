'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { User, Bell, Shield, Save, Loader2, Phone } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState('profile')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // 🔥 1. PROFİL STATE'İ (Admin'in kendi bilgileri)
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phoneNumber: ''
  })

  // 2. BİLDİRİM STATE'İ
  const [prefs, setPrefs] = useState({
    emailEnabled: true,
    inAppEnabled: true,
    marketingEmailEnabled: false,
    reminderEmailEnabled: true,
  })

  // 3. ŞİFRE STATE'İ
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  // Verileri DB'den çek
  useEffect(() => {
    const fetchAllSettings = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        
        // Profil ve Bildirim tercihlerini çek
        const [resProf, resPrefs] = await Promise.all([
          fetch(`${backendUrl}/admin/settings/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${backendUrl}/admin/settings/preferences`, { headers: { Authorization: `Bearer ${token}` } })
        ])

        if (resProf.ok) {
          const pData = await resProf.json()
          setProfile({
            name: pData.profile?.fullName || '',
            email: pData.email || '',
            phoneNumber: pData.phoneNumber || ''
          })
        }

        if (resPrefs.ok) {
          const prefData = await resPrefs.json()
          setPrefs({
            emailEnabled: prefData.emailEnabled,
            inAppEnabled: prefData.inAppEnabled,
            marketingEmailEnabled: prefData.marketingEmailEnabled,
            reminderEmailEnabled: prefData.reminderEmailEnabled,
          })
        }
      } catch (error) {
        toast.error('Settings could not be loaded.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchAllSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    const token = localStorage.getItem('access_token')
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

    try {
      // 🟢 PROFIL GÜNCELLEME
      if (activeSection === 'profile') {
        const res = await fetch(`${backendUrl}/admin/settings/me`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(profile)
        })
        if (res.ok) toast.success('Profile updated successfully!')
        else throw new Error()
      }

      // 🟡 BİLDİRİM GÜNCELLEME
      if (activeSection === 'notifications') {
        await fetch(`${backendUrl}/admin/settings/preferences`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(prefs)
        })
        toast.success('Preferences saved!')
      }

      // 🔴 ŞİFRE GÜNCELLEME
      if (activeSection === 'security' && (passwords.currentPassword || passwords.newPassword)) {
        if (passwords.newPassword !== passwords.confirmPassword) {
          toast.error('Passwords do not match!')
          setIsSaving(false)
          return
        }
        const res = await fetch(`${backendUrl}/admin/settings/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword })
        })
        if (res.ok) {
          toast.success('Password updated!')
          setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
        } else {
          const err = await res.json()
          toast.error(err.message || 'Failed to update password.')
        }
      }
    } catch (err) {
      toast.error('An error occurred while saving.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>

  return (
    <div className="p-6 max-w-4xl mx-auto pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your personal profile, notifications and security.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="md:w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map((s) => {
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    activeSection === s.id ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="size-4" /> {s.label}
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="flex-1 space-y-5">
          {activeSection === 'profile' && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
                <User className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Edit Profile</h2>
              </div>
              <div className="p-5 space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Full Name</label>
                    <Input value={profile.name} onChange={(e) => setProfile({...profile, name: e.target.value})} placeholder="Admin Name" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Email Address</label>
                    <Input value={profile.email} onChange={(e) => setProfile({...profile, email: e.target.value})} type="email" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input className="pl-9" value={profile.phoneNumber} onChange={(e) => setProfile({...profile, phoneNumber: e.target.value})} placeholder="+90..." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
                <Bell className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Notification Preferences</h2>
              </div>
              <div className="p-5 space-y-4">
                {Object.entries(prefs).map(([key, value]) => (
                  <label key={key} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                    <span className="text-sm font-medium text-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <input 
                      type="checkbox" 
                      checked={value} 
                      onChange={(e) => setPrefs({...prefs, [key]: e.target.checked})}
                      className="size-4 rounded border-border text-primary focus:ring-primary" 
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/20">
                <Shield className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase">Current Password</label><Input type="password" value={passwords.currentPassword} onChange={(e) => setPasswords({...passwords, currentPassword: e.target.value})} /></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase">New Password</label><Input type="password" value={passwords.newPassword} onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})} /></div>
                <div className="space-y-1.5"><label className="text-xs font-bold text-muted-foreground uppercase">Confirm New Password</label><Input type="password" value={passwords.confirmPassword} onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})} /></div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={isSaving} className="px-8 shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              {isSaving ? 'Saving...' : 'Save All Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}