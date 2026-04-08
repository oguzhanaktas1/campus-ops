'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { getToken } from '@/lib/auth'
import { toast } from 'sonner'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const DOC_TYPES = [
  { value: 'TRANSCRIPT', label: 'Transcript' },
  { value: 'ENROLLMENT_CERTIFICATE', label: 'Enrollment Certificate' },
  { value: 'STUDENT_CERTIFICATE', label: 'Student Certificate' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'OTHER', label: 'Other' },
]

const DELIVERY_METHODS = [
  { value: 'PICKUP', label: 'Pickup from Office' },
  { value: 'EMAIL', label: 'Send via Email' },
  { value: 'MAIL', label: 'Postal Mail' },
]

export default function NewDocumentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    documentType: searchParams.get('type') ?? 'TRANSCRIPT',
    language: 'English',
    copiesCount: 1,
    deliveryMethod: 'PICKUP',
    deliveryAddress: '',
    description: '',
  })

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/document-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          documentType: form.documentType,
          language: form.language || null,
          copiesCount: Number(form.copiesCount),
          deliveryMethod: form.deliveryMethod,
          deliveryAddress: form.deliveryAddress || null,
          description: form.description || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).message ?? 'Failed to submit request.')
      }
      toast.success('Document request submitted.')
      router.push('/student/documents')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit request.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/student/documents">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">New Document Request</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Request an official document from the registrar.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg shadow-sm divide-y divide-border">
        {/* Document Type */}
        <div className="px-5 py-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="size-4 text-primary" /> Document Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Document Type *</label>
              <select
                value={form.documentType}
                onChange={(e) => set('documentType', e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Language</label>
              <select
                value={form.language}
                onChange={(e) => set('language', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="English">English</option>
                <option value="Turkish">Turkish</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Number of Copies</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.copiesCount}
                onChange={(e) => set('copiesCount', parseInt(e.target.value) || 1)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="px-5 py-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Delivery Preferences</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Delivery Method *</label>
              <div className="grid grid-cols-3 gap-2">
                {DELIVERY_METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => set('deliveryMethod', m.value)}
                    className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                      form.deliveryMethod === m.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {(form.deliveryMethod === 'EMAIL' || form.deliveryMethod === 'MAIL') && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {form.deliveryMethod === 'EMAIL' ? 'Email Address' : 'Postal Address'} *
                </label>
                <input
                  type={form.deliveryMethod === 'EMAIL' ? 'email' : 'text'}
                  value={form.deliveryAddress}
                  onChange={(e) => set('deliveryAddress', e.target.value)}
                  placeholder={form.deliveryMethod === 'EMAIL' ? 'your@email.com' : 'Full postal address'}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 py-4 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Additional Notes</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Any special instructions or additional information..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Submit */}
        <div className="px-5 py-4 flex items-center justify-end gap-3">
          <Link href="/student/documents">
            <Button type="button" variant="ghost" size="sm">Cancel</Button>
          </Link>
          <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            Submit Request
          </Button>
        </div>
      </form>
    </div>
  )
}
