'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, ShieldCheck, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'

interface RequestType { id: string; name: string; key: string }

interface SLAPolicy {
  id: string
  name: string
  requestTypeId?: string | null
  requestType?: RequestType | null
  priority?: string | null
  firstResponseMinutes?: number | null
  resolutionMinutes?: number | null
  escalationMinutes?: number | null
  isActive: boolean
}

const PRIORITY_BADGE: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function minutesToHuman(mins?: number | null): string {
  if (!mins && mins !== 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const EMPTY_FORM = {
  name: '',
  requestTypeId: '',
  priority: '',
  firstResponseMinutes: '',
  resolutionMinutes: '',
  escalationMinutes: '',
  isActive: true,
}

export default function AdminSLAPage() {
  const [policies, setPolicies] = useState<SLAPolicy[]>([])
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editTarget, setEditTarget] = useState<SLAPolicy | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchPolicies = useCallback(async () => {
    try {
      const [polRes, rtRes] = await Promise.all([
        fetch(`${BACKEND}/admin/sla`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${BACKEND}/admin/request-types`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ])
      if (polRes.ok) setPolicies(await polRes.json())
      if (rtRes.ok) setRequestTypes(await rtRes.json())
    } catch {
      toast.error('Failed to load SLA policies.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchPolicies() }, [fetchPolicies])

  function openAdd() {
    setEditTarget(null)
    setForm({ ...EMPTY_FORM })
    setShowDialog(true)
  }

  function openEdit(p: SLAPolicy) {
    setEditTarget(p)
    setForm({
      name: p.name,
      requestTypeId: p.requestTypeId ?? '',
      priority: p.priority ?? '',
      firstResponseMinutes: p.firstResponseMinutes?.toString() ?? '',
      resolutionMinutes: p.resolutionMinutes?.toString() ?? '',
      escalationMinutes: p.escalationMinutes?.toString() ?? '',
      isActive: p.isActive,
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Policy name is required.'); return }
    setIsSaving(true)
    try {
      const payload = {
        name: form.name,
        requestTypeId: form.requestTypeId || null,
        priority: form.priority || null,
        firstResponseMinutes: form.firstResponseMinutes ? parseInt(form.firstResponseMinutes) : null,
        resolutionMinutes: form.resolutionMinutes ? parseInt(form.resolutionMinutes) : null,
        escalationMinutes: form.escalationMinutes ? parseInt(form.escalationMinutes) : null,
        isActive: form.isActive,
      }
      const url = editTarget ? `${BACKEND}/admin/sla/${editTarget.id}` : `${BACKEND}/admin/sla`
      const method = editTarget ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      toast.success(editTarget ? 'SLA policy updated.' : 'SLA policy created.')
      setShowDialog(false)
      fetchPolicies()
    } catch {
      toast.error('Failed to save SLA policy.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`${BACKEND}/admin/sla/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error()
      toast.success('SLA policy deleted.')
      setPolicies((prev) => prev.filter((p) => p.id !== id))
    } catch {
      toast.error('Failed to delete SLA policy.')
    } finally {
      setDeletingId(null)
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
    <div className="p-6 space-y-6 max-w-5xl mx-auto pb-20">
      {/* Dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-foreground">
              {editTarget ? 'Edit SLA Policy' : 'Add SLA Policy'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Policy Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Critical Response SLA"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Request Type</label>
                <select
                  value={form.requestTypeId}
                  onChange={(e) => setForm((f) => ({ ...f, requestTypeId: e.target.value }))}
                  className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">Any request type</option>
                  {requestTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>{rt.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className="w-full bg-background border border-input rounded-md px-3 h-10 text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                  <option value="">Any priority</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">First Response (min)</label>
                  <Input
                    type="number" min="1"
                    value={form.firstResponseMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, firstResponseMinutes: e.target.value }))}
                    placeholder="e.g. 60"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Resolution (min)</label>
                  <Input
                    type="number" min="1"
                    value={form.resolutionMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, resolutionMinutes: e.target.value }))}
                    placeholder="e.g. 480"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Escalation (min)</label>
                  <Input
                    type="number" min="1"
                    value={form.escalationMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, escalationMinutes: e.target.value }))}
                    placeholder="e.g. 1440"
                  />
                </div>
              </div>
              {(form.firstResponseMinutes || form.resolutionMinutes || form.escalationMinutes) && (
                <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs text-muted-foreground space-y-1">
                  {form.firstResponseMinutes && (
                    <p>First response: <span className="font-semibold text-foreground">{minutesToHuman(parseInt(form.firstResponseMinutes))}</span></p>
                  )}
                  {form.resolutionMinutes && (
                    <p>Resolution: <span className="font-semibold text-foreground">{minutesToHuman(parseInt(form.resolutionMinutes))}</span></p>
                  )}
                  {form.escalationMinutes && (
                    <p>Escalation: <span className="font-semibold text-foreground">{minutesToHuman(parseInt(form.escalationMinutes))}</span></p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="isActive" className="text-sm text-foreground">Active</label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : editTarget ? 'Update' : 'Create Policy'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">SLA Policies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Define response and resolution time targets.</p>
        </div>
        <Button onClick={openAdd} className="gap-2 self-start">
          <Plus className="size-4" /> Add Policy
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Policy Name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Request Type</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">First Response</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Resolution</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Escalation</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {policies.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-primary shrink-0" />
                      <span className="font-medium text-foreground">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell text-xs text-muted-foreground">
                    {p.requestType?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {p.priority ? (
                      <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', PRIORITY_BADGE[p.priority] ?? PRIORITY_BADGE.LOW)}>
                        {p.priority}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Any</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Clock className="size-3.5 text-muted-foreground" />
                      {minutesToHuman(p.firstResponseMinutes)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Clock className="size-3.5 text-muted-foreground" />
                      {minutesToHuman(p.resolutionMinutes)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Clock className="size-3.5 text-muted-foreground" />
                      {minutesToHuman(p.escalationMinutes)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full border',
                      p.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800'
                        : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700'
                    )}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(p)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {policies.length === 0 && (
            <div className="text-center py-16">
              <ShieldCheck className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No SLA policies defined.</p>
              <p className="text-xs text-muted-foreground mt-1">Add a policy to set response time targets.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
