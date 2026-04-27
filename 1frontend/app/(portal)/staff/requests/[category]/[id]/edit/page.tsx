'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

export default function StaffRequestEditPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.id as string
  const category = params.category as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({ title: '', description: '' })
  const [revisionNote, setRevisionNote] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND}/staff/requests/${requestId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error()
        const data = await res.json()
        const req = data.request ?? data
        setForm({
          title: req.title ?? '',
          description: req.description ?? '',
        })
        // Show the revision note from the most recent REQUEST_REVISION action
        const revisionAction = (data.approvalHistory ?? []).find(
          (a: any) => a.actionType === 'REQUEST_REVISION',
        )
        setRevisionNote(revisionAction?.decisionNote ?? null)
      } catch {
        toast.error('Failed to load request.')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [requestId])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/staff/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Failed')
      }
      toast.success('Request revised and resubmitted.')
      router.push(`/staff/requests/${category}/${requestId}`)
    } catch (err: any) {
      toast.error(err.message ?? 'Could not submit revision.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 pb-20">
      <Button variant="ghost" size="sm" asChild className="gap-1.5">
        <Link href={`/staff/requests/${category}/${requestId}`}>
          <ArrowLeft className="size-4" /> Back
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-bold">Revise Request</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the details below and resubmit for review.
        </p>
      </div>

      {revisionNote && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Reviewer note</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">{revisionNote}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            rows={8}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" type="button" asChild>
            <Link href={`/staff/requests/${category}/${requestId}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            Resubmit
          </Button>
        </div>
      </form>
    </div>
  )
}
