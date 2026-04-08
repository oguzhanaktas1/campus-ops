'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'

export default function StudentSettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [preferences, setPreferences] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' })
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    const fetchSettingsData = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) return

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const headers = { Authorization: `Bearer ${token}` }

      try {
        const [profileRes, prefsRes] = await Promise.all([
          fetch(`${backendUrl}/auth/profile`, { headers }),
          fetch(`${backendUrl}/student/preferences`, { headers })
        ])

        if (profileRes.ok) setUser(await profileRes.json())
        if (prefsRes.ok) setPreferences(await prefsRes.json())
      } catch (error) {
        console.error('Settings fetch error:', error)
        toast.error('Ayarlar yüklenemedi.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettingsData()
  }, [])

  const handlePreferenceChange = async (key: string, checked: boolean) => {
    setPreferences((prev: any) => ({ ...prev, [key]: checked }))

    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      
      const res = await fetch(`${backendUrl}/student/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ [key]: checked })
      })

      if (!res.ok) throw new Error('Güncellenemedi')
      toast.success('Preference updated successfully.')
    } catch (error) {
      toast.error('Failed to update preference.')
      setPreferences((prev: any) => ({ ...prev, [key]: !checked }))
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwords.currentPassword || !passwords.newPassword) {
      toast.error('Please fill in all password fields.')
      return
    }

    setIsChangingPassword(true)
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      
      const res = await fetch(`${backendUrl}/student/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(passwords)
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Şifre güncellenemedi.')
      }

      toast.success('Password changed successfully!')
      setPasswords({ currentPassword: '', newPassword: '' }) 
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsChangingPassword(false)
    }
  }

  if (isLoading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
  }

  if (!user) return null

  // 🔥 BACKEND'İN TERTEMİZ FLAT (DÜZ) YAPISINA BİREBİR UYUMLU EŞLEŞTİRME 🔥
  const fullName = user.fullName || user.name || 'Not Set'
  const studentId = user.studentId || 'Not Set'
  const email = user.email || 'Not Set'
  const departmentName = user.department || 'Not Set'
  const bio = user.bio || 'No bio or description provided by the university system.'

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account preferences</p>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        
        {/* KİLİTLİ PROFİL BİLGİLERİ */}
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
              <Label>Student ID</Label>
              <Input defaultValue={studentId} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input defaultValue={email} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input defaultValue={departmentName} readOnly className="bg-muted/50 cursor-not-allowed text-muted-foreground" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description / Bio</Label>
              <Textarea 
                defaultValue={bio} 
                readOnly 
                className="bg-muted/50 cursor-not-allowed text-muted-foreground min-h-[80px] resize-none" 
              />
            </div>
          </div>
        </div>

        {/* BİLDİRİM TERCİHLERİ */}
        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Notification Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Receive important updates via email</p>
              </div>
              <Switch 
                checked={preferences?.emailEnabled ?? true} 
                onCheckedChange={(val) => handlePreferenceChange('emailEnabled', val)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">In-App Notifications</p>
                <p className="text-xs text-muted-foreground">Get notified when a request changes status</p>
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

        {/* ŞİFRE DEĞİŞTİRME */}
        <div className="p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Current Password</Label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({...passwords, currentPassword: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input 
                  type="password" 
                  placeholder="••••••••" 
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                />
              </div>
            </div>
            <Button size="sm" variant="outline" type="submit" disabled={isChangingPassword}>
              {isChangingPassword && <Loader2 className="size-4 animate-spin mr-2" />}
              Update Password
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}