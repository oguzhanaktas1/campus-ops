'use client'

import { useState, useEffect, useCallback } from 'react'
import { TopScrollTable } from '@/components/ui/top-scroll-table'
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
import { Search, Plus, Pencil, Trash2, Loader2, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'

interface Faculty {
  id: string
  name: string
  code: string
  campusName?: string
}

interface Department {
  id: string
  name: string
  code: string
  facultyId: string
  facultyName: string
  isActive: boolean
}

const EMPTY_FORM = { name: '', code: '', facultyId: '', isActive: true }

export default function DepartmentsPage() {
  const { t } = useI18n()
  const [departments, setDepartments] = useState<Department[]>([])
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Department | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const fetchDepartments = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/admin/departments`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setDepartments(await res.json())
      else toast.error(t('organization.saveFail'))
    } catch (error) {
      console.error('API Error:', error)
      toast.error(t('organization.saveFail'))
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl])

  const fetchFaculties = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/admin/faculties`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setFaculties(await res.json())
    } catch (error) {
      console.error('Faculties fetch error:', error)
    }
  }, [backendUrl])

  useEffect(() => {
    fetchDepartments()
    fetchFaculties()
  }, [fetchDepartments, fetchFaculties])

  const openAdd = () => {
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (dept: Department) => {
    setEditingItem(dept)
    setForm({ name: dept.name, code: dept.code, facultyId: dept.facultyId, isActive: dept.isActive })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.facultyId) {
      toast.error(t('common.required'))
      return
    }
    setIsSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      const url = editingItem
        ? `${backendUrl}/admin/departments/${editingItem.id}`
        : `${backendUrl}/admin/departments`
      const method = editingItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success(t('organization.saveSuccess'))
        setDialogOpen(false)
        fetchDepartments()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error((err as { message?: string }).message || t('organization.saveFail'))
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error(t('organization.saveFail'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (dept: Department) => {
    if (!window.confirm(t('organization.confirmDelete', { name: dept.name }))) return
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/admin/departments/${dept.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success(t('organization.deleteSuccess'))
        fetchDepartments()
      } else {
        toast.error(t('organization.deleteFail'))
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(t('organization.deleteFail'))
    }
  }

  const filtered = departments.filter(
    (d) =>
      search === '' ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase()) ||
      d.facultyName?.toLowerCase().includes(search.toLowerCase()),
  )

  if (isLoading)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('organization.departmentsTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('organization.departmentsSubtitle', { count: departments.length })}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="size-3.5" /> {t('organization.addDepartment')}
        </Button>
      </div>

      {/* Search + Stats bar */}
      <div className="flex items-center gap-4 bg-card border border-border p-3 rounded-lg shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 text-sm ml-auto">
          <span className="font-medium text-emerald-600">{departments.filter((d) => d.isActive).length} {t('common.active')}</span>
          <span className="font-medium text-muted-foreground">{departments.filter((d) => !d.isActive).length} {t('common.inactive')}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <TopScrollTable>
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">{t('organization.departmentsTitle')}</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">{t('organization.departmentName')}</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">{t('organization.facultiesTitle')}</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">{t('common.status')}</th>
              <th className="px-5 py-3 text-right font-semibold text-muted-foreground">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((dept) => (
              <tr key={dept.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 flex-shrink-0">
                      <BookOpen className="size-4" />
                    </div>
                    <p className="font-medium text-foreground">{dept.name}</p>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-medium bg-muted text-foreground border border-border">
                    {dept.code}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground">
                  {dept.facultyName || '—'}
                </td>
                <td className="px-5 py-3.5">
                  {dept.isActive ? (
                    <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold tracking-wider">
                      {t('common.active').toUpperCase()}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-[10px] font-bold tracking-wider">
                      {t('common.inactive').toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(dept)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(dept)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </TopScrollTable>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('organization.noDepartments')}</p>
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? t('organization.editDepartment') : t('organization.addDepartment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name">
                {t('organization.departmentName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dept-name"
                placeholder={t('organization.departmentNamePlaceholder')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-code">
                {t('organization.facultyCode')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dept-code"
                placeholder={t('organization.departmentCodePlaceholder')}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                {t('organization.facultiesTitle')} <span className="text-destructive">*</span>
              </Label>
              <Select value={form.facultyId} onValueChange={(v) => setForm({ ...form, facultyId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('organization.selectFaculty')} />
                </SelectTrigger>
                <SelectContent>
                  {faculties.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.code})
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
                {form.isActive ? t('common.active') : t('common.inactive')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
