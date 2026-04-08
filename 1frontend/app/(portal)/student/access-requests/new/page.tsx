'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const ACCESS_TYPES = ['System / Portal', 'Lab Access', 'Network Resource', 'Software License', 'Campus Area', 'Other']

export default function NewStudentAccessRequestPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    accessType: 'System / Portal',
    targetResource: '',
    requestedRoleOrPermission: '',
    justification: '',
    startAt: '',
    endAt: '',
  })

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.targetResource.trim() || !form.justification.trim()) {
      toast.error('Target resource and justification are required.')
      return
    }
    setIsSubmitting(true)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          ...form,
          startAt: form.startAt || undefined,
          endAt: form.endAt || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(`Access request ${data.requestNo} submitted.`)
      router.push('/student/access-requests')
    } catch {
      toast.error('Failed to submit access request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto pb-20">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> New Access Request</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Request access to a system, lab, or campus resource.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Access Type</Label>
            <select value={form.accessType} onChange={(e) => set('accessType', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring">
              {ACCESS_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Target Resource / System <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Research Lab 301, MATLAB Portal" value={form.targetResource} onChange={(e) => set('targetResource', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Requested Role / Permission (optional)</Label>
          <Input placeholder="e.g. Read-only, Student access" value={form.requestedRoleOrPermission} onChange={(e) => set('requestedRoleOrPermission', e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Access Start Date (optional)</Label>
            <Input type="date" value={form.startAt} onChange={(e) => set('startAt', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Access End Date (optional)</Label>
            <Input type="date" value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Justification <span className="text-destructive">*</span></Label>
          <textarea value={form.justification} onChange={(e) => set('justification', e.target.value)} rows={4}
            placeholder="Explain why you need this access..."
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />} Submit Request
          </Button>
        </div>
      </form>
    </div>
  )
}
