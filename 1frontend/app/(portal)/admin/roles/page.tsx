'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Plus, Pencil, Trash2, Loader2, Shield, Lock } from 'lucide-react'
import { toast } from 'sonner'

type ScopeType = 'GLOBAL' | 'CAMPUS' | 'FACULTY' | 'DEPARTMENT' | 'UNIT'

const SCOPE_TYPES: ScopeType[] = ['GLOBAL', 'CAMPUS', 'FACULTY', 'DEPARTMENT', 'UNIT']

const scopeColors: Record<ScopeType, string> = {
  GLOBAL: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800',
  CAMPUS: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  FACULTY: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
  DEPARTMENT: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  UNIT: 'text-cyan-700 bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800',
}

interface Role {
  id: string
  name: string
  description: string
  scopeType: ScopeType
  isSystem: boolean
  permissionsCount: number
}

const EMPTY_FORM = { name: '', description: '', scopeType: 'GLOBAL' as ScopeType }

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Role | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const fetchRoles = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/admin/roles-full`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setRoles(await res.json())
      else toast.error('Failed to load roles')
    } catch (error) {
      console.error('API Error:', error)
      toast.error('Failed to load roles')
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const openAdd = () => {
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (role: Role) => {
    setEditingItem(role)
    setForm({ name: role.name, description: role.description || '', scopeType: role.scopeType })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Role name is required')
      return
    }
    setIsSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      const url = editingItem
        ? `${backendUrl}/admin/roles/${editingItem.id}`
        : `${backendUrl}/admin/roles`
      const method = editingItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success(editingItem ? 'Role updated!' : 'Role created!')
        setDialogOpen(false)
        fetchRoles()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { message?: string }).message || 'Failed to save role')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save role')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (role: Role) => {
    if (role.isSystem) {
      toast.error('System roles cannot be deleted')
      return
    }
    if (!window.confirm(`Are you sure you want to delete the role "${role.name}"? This cannot be undone.`)) return
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/admin/roles/${role.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success('Role deleted!')
        fetchRoles()
      } else {
        toast.error('Failed to delete role')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete role')
    }
  }

  const filtered = roles.filter(
    (r) =>
      search === '' ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.scopeType.toLowerCase().includes(search.toLowerCase()),
  )

  if (isLoading)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Role Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {roles.length} role{roles.length !== 1 ? 's' : ''} configured in the system.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="size-3.5" /> Add Role
        </Button>
      </div>

      {/* Search + Stats bar */}
      <div className="flex items-center gap-4 bg-card border border-border p-3 rounded-lg shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search roles by name, description or scope..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 text-sm ml-auto">
          <span className="font-medium text-muted-foreground">
            <Lock className="inline size-3.5 mr-1 mb-0.5" />
            {roles.filter((r) => r.isSystem).length} System
          </span>
          <span className="font-medium text-muted-foreground">
            {roles.filter((r) => !r.isSystem).length} Custom
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Role</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Scope</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">Permissions</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Type</th>
              <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((role) => (
              <tr key={role.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 dark:text-violet-400 flex-shrink-0">
                      <Shield className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{role.name}</p>
                      {role.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{role.description}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${scopeColors[role.scopeType]}`}>
                    {role.scopeType}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
                    {role.permissionsCount ?? 0} permissions
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {role.isSystem ? (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold tracking-wider w-fit">
                      <Lock className="size-2.5" /> SYSTEM
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold tracking-wider">
                      CUSTOM
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(role)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
                      onClick={() => handleDelete(role)}
                      disabled={role.isSystem}
                      title={role.isSystem ? 'System roles cannot be deleted' : 'Delete role'}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Shield className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No roles found.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Role' : 'Add Role'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="role-name"
                placeholder="e.g. Department Coordinator"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                placeholder="Brief description of this role..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Scope Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.scopeType}
                onValueChange={(v) => setForm({ ...form, scopeType: v as ScopeType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPE_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Defines the organizational level this role applies to.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingItem ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
