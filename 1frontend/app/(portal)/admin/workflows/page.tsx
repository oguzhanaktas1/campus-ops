'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Workflow,
  ChevronRight,
  Plus,
  Settings2,
  Loader2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
}

const roleColors: Record<string, string> = {
  STUDENT:  'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  FACULTY:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  STAFF:    'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  ADMIN:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  APPROVAL: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  REVIEW:   'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
}

export default function AdminWorkflowsPage() {
  const [workflows, setWorkflows] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState({ key: '', name: '', description: '' })

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/workflows`, { headers: authHeaders() })
      if (res.ok) setWorkflows(await res.json())
      else toast.error('Failed to load workflows.')
    } catch {
      toast.error('Failed to load workflows.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void fetchWorkflows() }, [fetchWorkflows])

  const handleCreate = async () => {
    if (!form.key.trim() || !form.name.trim()) {
      toast.error('Key and Name are required.')
      return
    }
    setIsCreating(true)
    try {
      const res = await fetch(`${BACKEND}/admin/workflows`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ key: form.key, name: form.name, description: form.description || null }),
      })
      if (res.ok) {
        toast.success('Workflow created.')
        setIsModalOpen(false)
        setForm({ key: '', name: '', description: '' })
        void fetchWorkflows()
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? 'Failed to create workflow.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Delete this workflow? This cannot be undone.')) return
    try {
      const res = await fetch(`${BACKEND}/admin/workflows/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) {
        toast.success('Workflow deleted.')
        if (selected === id) setSelected(null)
        void fetchWorkflows()
      } else {
        toast.error('Failed to delete workflow.')
      }
    } catch {
      toast.error('Network error.')
    }
  }

  const selectedWf = workflows.find((w) => w.id === selected)

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Workflow Configuration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define and manage approval chains for each request type.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setIsModalOpen(true)}>
          <Plus className="size-3.5" />
          New Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <div className="text-center py-16">
          <Workflow className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No workflows defined yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first workflow to get started.</p>
        </div>
      ) : (
        <div className={cn('grid gap-5', selectedWf ? 'lg:grid-cols-2' : 'grid-cols-1')}>
          {/* Workflow list */}
          <div className="space-y-3">
            {workflows.map((wf) => (
              <button
                key={wf.id}
                onClick={() => setSelected(wf.id === selected ? null : wf.id)}
                className={cn(
                  'w-full bg-card border rounded-lg p-4 text-left transition-all hover:border-primary/40 shadow-sm',
                  selected === wf.id ? 'border-primary bg-primary/5' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <Workflow className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{wf.name}</p>
                        {wf.isActive && (
                          <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded font-medium">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{wf.key}</p>
                      {wf.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{wf.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {wf.steps?.length ?? 0} steps · {wf._count?.instances ?? 0} instances
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDelete(wf.id, e)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <ChevronRight
                      className={cn(
                        'size-4 text-muted-foreground flex-shrink-0 mt-0.5 transition-transform',
                        selected === wf.id && 'rotate-90',
                      )}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Workflow detail panel */}
          {selectedWf && (
            <div className="bg-card border border-border rounded-lg shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                    <Settings2 className="size-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground">{selectedWf.name}</h2>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {selectedWf.description && (
                  <p className="text-sm text-muted-foreground">{selectedWf.description}</p>
                )}

                {(selectedWf.steps?.length ?? 0) > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Steps
                    </p>
                    <div className="space-y-2">
                      {(selectedWf.steps as any[])
                        .sort((a, b) => a.stepOrder - b.stepOrder)
                        .map((step: any, idx: number) => (
                          <div key={step.id} className="flex items-center gap-3">
                            <div className="flex flex-col items-center">
                              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                {idx + 1}
                              </div>
                              {idx < selectedWf.steps.length - 1 && (
                                <div className="w-px h-4 bg-border mt-1" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-1">
                              <p className="text-sm text-foreground">{step.stepName}</p>
                              <span
                                className={cn(
                                  'text-xs px-1.5 py-0.5 rounded font-medium',
                                  roleColors[step.stepType] ?? 'bg-muted text-muted-foreground',
                                )}
                              >
                                {step.stepType}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No steps defined yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create workflow modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) setIsModalOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Workflow Definition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Key <span className="text-destructive">*</span></Label>
              <Input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                placeholder="e.g. INTERNSHIP_APPROVAL"
              />
              <p className="text-xs text-muted-foreground">Unique identifier, uppercase with underscores.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Internship Approval"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isCreating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
