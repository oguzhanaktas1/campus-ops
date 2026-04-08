'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Mail, Phone, Building2, GraduationCap, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

export default function StudentProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [phone, setPhone] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('access_token')
      if (!token) return

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      try {
        const res = await fetch(`${backendUrl}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setUser(data)
          setPhone(data.phoneNumber || '')
        }
      } catch (e) {
        console.error('Profile fetch error:', e)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSave = async () => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    setIsSaving(true)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/student/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: phone }),
      })
      if (res.ok) toast.success('Profile updated.')
      else toast.error('Could not update profile.')
    } catch {
      toast.error('Network error.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  const fullName = user.profile?.fullName || user.email || ''
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">View and manage your personal information.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold flex-shrink-0">
          {initials || <User className="size-7" />}
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">{fullName}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      {/* Read-only info */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Academic Information</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <GraduationCap className="size-3.5" /> Student ID
            </Label>
            <Input value={user.studentId || '—'} disabled className="bg-muted/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="size-3.5" /> Department
            </Label>
            <Input value={user.profile?.department || user.department || '—'} disabled className="bg-muted/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3.5" /> Email
            </Label>
            <Input value={user.email} disabled className="bg-muted/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="size-3.5" /> Phone
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+90 555 000 00 00"
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save Changes
      </Button>
    </div>
  )
}
