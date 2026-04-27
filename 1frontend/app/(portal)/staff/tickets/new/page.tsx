'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export default function NewStaffTicketPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    priority: 'MEDIUM',
    affectedSystem: '',
    locationText: '',
  })

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch(`${BACKEND}/it-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      })

      if (!res.ok) throw new Error()

      const created = await res.json()
      toast.success('Ticket created.')
      router.push(`/staff/requests/it-support/${created.requestId}`)
    } catch {
      toast.error('Ticket could not be created.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 pb-20">
      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <Link href="/staff/tickets">
          <ArrowLeft className="size-4" /> Back
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold">New IT Ticket</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit a support request to the IT team.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Printer not working in office"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Input
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="Hardware"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none dark:bg-input/30"
            >
              <option className="bg-background text-foreground" value="LOW">Low</option>
              <option className="bg-background text-foreground" value="MEDIUM">Medium</option>
              <option className="bg-background text-foreground" value="HIGH">High</option>
              <option className="bg-background text-foreground" value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Affected System</label>
            <Input
              value={form.affectedSystem}
              onChange={(e) => setForm((prev) => ({ ...prev, affectedSystem: e.target.value }))}
              placeholder="Printer / Wi-Fi / LMS"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Location</label>
            <Input
              value={form.locationText}
              onChange={(e) => setForm((prev) => ({ ...prev, locationText: e.target.value }))}
              placeholder="Admin Building, Room 101"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe the issue, what you tried, and when it started."
            rows={6}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Submit Ticket
          </Button>
        </div>
      </form>
    </div>
  )
}
