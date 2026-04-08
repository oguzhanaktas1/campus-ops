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
import { Search, Plus, Pencil, Trash2, Loader2, Layers } from 'lucide-react'
import { toast } from 'sonner'

interface Campus {
  id: string
  name: string
  code: string
}

interface Faculty {
  id: string
  name: string
  code: string
}

interface Department {
  id: string
  name: string
  code: string
}

interface Unit {
  id: string
  name: string
  code: string
  campusId?: string
  campusName?: string
  facultyId?: string
  facultyName?: string
  departmentId?: string
  departmentName?: string
  isActive: boolean
}

const EMPTY_FORM = {
  name: '',
  code: '',
  campusId: '',
  facultyId: '',
  departmentId: '',
  isActive: true,
}

const NONE_VALUE = '__none__'

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Unit | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const fetchUnits = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/admin/units`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setUnits(await res.json())
      else toast.error('Failed to load units')
    } catch (error) {
      console.error('API Error:', error)
      toast.error('Failed to load units')
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl])

  const fetchRelated = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const headers = { Authorization: `Bearer ${token}` }
      const [campusRes, facultyRes, deptRes] = await Promise.all([
        fetch(`${backendUrl}/admin/campuses`, { headers }),
        fetch(`${backendUrl}/admin/faculties`, { headers }),
        fetch(`${backendUrl}/admin/departments`, { headers }),
      ])
      if (campusRes.ok) setCampuses(await campusRes.json())
      if (facultyRes.ok) setFaculties(await facultyRes.json())
      if (deptRes.ok) setDepartments(await deptRes.json())
    } catch (error) {
      console.error('Related data fetch error:', error)
    }
  }, [backendUrl])

  useEffect(() => {
    fetchUnits()
    fetchRelated()
  }, [fetchUnits, fetchRelated])

  const openAdd = () => {
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (unit: Unit) => {
    setEditingItem(unit)
    setForm({
      name: unit.name,
      code: unit.code,
      campusId: unit.campusId || '',
      facultyId: unit.facultyId || '',
      departmentId: unit.departmentId || '',
      isActive: unit.isActive,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required')
      return
    }
    setIsSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      const url = editingItem
        ? `${backendUrl}/admin/units/${editingItem.id}`
        : `${backendUrl}/admin/units`
      const method = editingItem ? 'PUT' : 'POST'

      // Strip empty optional foreign keys
      const body: Record<string, unknown> = {
        name: form.name,
        code: form.code,
        isActive: form.isActive,
      }
      if (form.campusId) body.campusId = form.campusId
      if (form.facultyId) body.facultyId = form.facultyId
      if (form.departmentId) body.departmentId = form.departmentId

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(editingItem ? 'Unit updated!' : 'Unit created!')
        setDialogOpen(false)
        fetchUnits()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { message?: string }).message || 'Failed to save unit')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save unit')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (unit: Unit) => {
    if (!window.confirm(`Are you sure you want to delete "${unit.name}"? This cannot be undone.`)) return
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/admin/units/${unit.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success('Unit deleted!')
        fetchUnits()
      } else {
        toast.error('Failed to delete unit')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete unit')
    }
  }

  const getParentLabel = (unit: Unit) => {
    if (unit.departmentName) return unit.departmentName
    if (unit.facultyName) return unit.facultyName
    if (unit.campusName) return unit.campusName
    return '—'
  }

  const filtered = units.filter(
    (u) =>
      search === '' ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.code.toLowerCase().includes(search.toLowerCase()) ||
      u.campusName?.toLowerCase().includes(search.toLowerCase()) ||
      u.facultyName?.toLowerCase().includes(search.toLowerCase()) ||
      u.departmentName?.toLowerCase().includes(search.toLowerCase()),
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
          <h1 className="text-xl font-bold text-foreground">Unit Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {units.length} unit{units.length !== 1 ? 's' : ''} registered in the system.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="size-3.5" /> Add Unit
        </Button>
      </div>

      {/* Search + Stats bar */}
      <div className="flex items-center gap-4 bg-card border border-border p-3 rounded-lg shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search units by name, code or parent..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 text-sm ml-auto">
          <span className="font-medium text-emerald-600">{units.filter((u) => u.isActive).length} Active</span>
          <span className="font-medium text-muted-foreground">{units.filter((u) => !u.isActive).length} Inactive</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Unit</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Code</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">Parent</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Status</th>
              <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((unit) => (
              <tr key={unit.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-md bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-700 dark:text-cyan-400 flex-shrink-0">
                      <Layers className="size-4" />
                    </div>
                    <p className="font-medium text-foreground">{unit.name}</p>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-medium bg-muted text-foreground border border-border">
                    {unit.code}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">
                  {getParentLabel(unit)}
                </td>
                <td className="px-5 py-3.5">
                  {unit.isActive ? (
                    <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold tracking-wider">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-[10px] font-bold tracking-wider">
                      INACTIVE
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(unit)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(unit)}
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
            <Layers className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No units found.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Unit' : 'Add Unit'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="unit-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unit-name"
                placeholder="e.g. Student Affairs Office"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit-code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="unit-code"
                placeholder="e.g. SAO"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Campus (optional)</Label>
              <Select
                value={form.campusId || NONE_VALUE}
                onValueChange={(v) => setForm({ ...form, campusId: v === NONE_VALUE ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {campuses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Faculty (optional)</Label>
              <Select
                value={form.facultyId || NONE_VALUE}
                onValueChange={(v) => setForm({ ...form, facultyId: v === NONE_VALUE ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {faculties.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department (optional)</Label>
              <Select
                value={form.departmentId || NONE_VALUE}
                onValueChange={(v) => setForm({ ...form, departmentId: v === NONE_VALUE ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  form.isActive ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${
                    form.isActive ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <Label
                className="cursor-pointer select-none"
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
              >
                {form.isActive ? 'Active' : 'Inactive'}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingItem ? 'Save Changes' : 'Create Unit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
