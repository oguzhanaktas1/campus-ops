'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ArrowLeft, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import Link from 'next/link'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const INTERNSHIP_TYPES = ['MANDATORY', 'VOLUNTARY', 'SUMMER']
const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID']

export default function NewInternshipPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [advisors, setAdvisors] = useState<any[]>([])

  const [form, setForm] = useState({
    companyName: '',
    companySector: '',
    companyContactName: '',
    companyContactEmail: '',
    internshipType: 'MANDATORY',
    workMode: 'ONSITE',
    startDate: '',
    endDate: '',
    durationDays: '',
    insuranceRequired: false,
    advisorUserId: '',
  })

  useEffect(() => {
    fetch(`${BACKEND}/student/faculty-members`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then(setAdvisors)
      .catch(() => {})
  }, [])

  // Auto-calculate duration when dates change
  useEffect(() => {
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate)
      const end = new Date(form.endDate)
      if (end >= start) {
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        setForm((prev) => ({ ...prev, durationDays: String(diff) }))
      }
    }
  }, [form.startDate, form.endDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.companyName.trim()) { toast.error('Company name is required.'); return }
    if (!form.startDate || !form.endDate) { toast.error('Start and end dates are required.'); return }
    if (new Date(form.endDate) < new Date(form.startDate)) { toast.error('End date cannot be before start date.'); return }

    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/student/internships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          title: `${form.internshipType} Internship at ${form.companyName}`,
          companyName: form.companyName,
          companySector: form.companySector || undefined,
          companyContactName: form.companyContactName || undefined,
          companyContactEmail: form.companyContactEmail || undefined,
          internshipType: form.internshipType,
          workMode: form.workMode,
          startDate: form.startDate,
          endDate: form.endDate,
          durationDays: Number(form.durationDays) || 0,
          insuranceRequired: form.insuranceRequired,
          advisorUserId: form.advisorUserId || undefined,
        }),
      })

      if (res.ok) {
        toast.success('Internship application submitted successfully.')
        router.push('/student/internships')
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to submit application.')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const field = (
    label: string,
    key: keyof typeof form,
    type = 'text',
    placeholder = '',
    required = false,
  ) => (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={form[key] as string}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        required={required}
      />
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/student/internships">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Briefcase className="size-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">New Internship Application</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Info */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Company Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Company Name', 'companyName', 'text', 'e.g. Acme Corp', true)}
            {field('Industry / Sector', 'companySector', 'text', 'e.g. Software')}
            {field('Contact Person', 'companyContactName', 'text', 'e.g. Jane Doe')}
            {field('Contact Email', 'companyContactEmail', 'email', 'contact@company.com')}
          </div>
        </div>

        {/* Internship Details */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Internship Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type <span className="text-destructive">*</span></Label>
              <Select value={form.internshipType} onValueChange={(v) => setForm({ ...form, internshipType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERNSHIP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Work Mode <span className="text-destructive">*</span></Label>
              <Select value={form.workMode} onValueChange={(v) => setForm({ ...form, workMode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORK_MODES.map((m) => (
                    <SelectItem key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field('Start Date', 'startDate', 'date', '', true)}
            {field('End Date', 'endDate', 'date', '', true)}
            <div className="space-y-1.5">
              <Label>Duration (days)</Label>
              <Input
                type="number"
                min={1}
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                placeholder="Auto-calculated"
              />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <div className="flex items-center gap-3 pb-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.insuranceRequired}
                  onClick={() => setForm({ ...form, insuranceRequired: !form.insuranceRequired })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.insuranceRequired ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${form.insuranceRequired ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <Label className="cursor-pointer" onClick={() => setForm({ ...form, insuranceRequired: !form.insuranceRequired })}>
                  Insurance Required
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Advisor */}
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Faculty Advisor</h2>
          <div className="space-y-1.5">
            <Label>Advisor</Label>
            <Select value={form.advisorUserId} onValueChange={(v) => setForm({ ...form, advisorUserId: v })}>
              <SelectTrigger><SelectValue placeholder="Select advisor (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No advisor</SelectItem>
                {advisors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.profile?.fullName ?? a.email}
                    {a.profile?.title ? ` (${a.profile.title})` : ''}
                    {a.profile?.department?.name ? ` — ${a.profile.department.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/student/internships">
            <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Submit Application
          </Button>
        </div>
      </form>
    </div>
  )
}
