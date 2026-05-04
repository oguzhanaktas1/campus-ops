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
import { Search, Plus, Pencil, Trash2, Loader2, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'

interface Campus {
  id: string
  name: string
  code: string
  address: string
  isActive: boolean
}

const EMPTY_FORM = { name: '', code: '', address: '', isActive: true }

export default function CampusesPage() {
  const { t } = useI18n()
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Campus | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const fetchCampuses = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/admin/campuses`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setCampuses(await res.json())
      else toast.error(t('organization.saveFail'))
    } catch (error) {
      console.error('API Error:', error)
      toast.error(t('organization.saveFail'))
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl, t])

  useEffect(() => { fetchCampuses() }, [fetchCampuses])

  const openAdd = () => {
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (campus: Campus) => {
    setEditingItem(campus)
    setForm({ name: campus.name, code: campus.code, address: campus.address, isActive: campus.isActive })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t('common.required'))
      return
    }
    setIsSaving(true)
    try {
      const token = localStorage.getItem('access_token')
      const url = editingItem
        ? `${backendUrl}/admin/campuses/${editingItem.id}`
        : `${backendUrl}/admin/campuses`
      const method = editingItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success(t('organization.saveSuccess'))
        setDialogOpen(false)
        fetchCampuses()
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

  const handleDelete = async (campus: Campus) => {
    if (!window.confirm(t('organization.confirmDelete', { name: campus.name }))) return
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/admin/campuses/${campus.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        toast.success(t('organization.deleteSuccess'))
        fetchCampuses()
      } else {
        toast.error(t('organization.deleteFail'))
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(t('organization.deleteFail'))
    }
  }

  const filtered = campuses.filter(
    (c) =>
      search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase()),
  )

  if (isLoading)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('organization.campusesTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('organization.campusesSubtitle', { count: campuses.length })}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="size-3.5" /> {t('organization.addCampus')}
        </Button>
      </div>

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
          <span className="font-medium text-emerald-600">{campuses.filter((c) => c.isActive).length} {t('common.active')}</span>
          <span className="font-medium text-muted-foreground">{campuses.filter((c) => !c.isActive).length} {t('common.inactive')}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">{t('organization.campusName')}</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">{t('organization.campusCode')}</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden lg:table-cell">{t('organization.campusLocation')}</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">{t('common.status')}</th>
              <th className="px-5 py-3 text-right font-semibold text-muted-foreground">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((campus) => (
              <tr key={campus.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-md bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 flex-shrink-0">
                      <Building2 className="size-4" />
                    </div>
                    <p className="font-medium text-foreground">{campus.name}</p>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-medium bg-muted text-foreground border border-border">
                    {campus.code}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-muted-foreground max-w-xs truncate">
                  {campus.address || '—'}
                </td>
                <td className="px-5 py-3.5">
                  {campus.isActive ? (
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
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(campus)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(campus)}
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
            <Building2 className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('organization.noCampuses')}</p>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? t('organization.editCampus') : t('organization.addCampus')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="campus-name">
                {t('organization.campusName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="campus-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campus-code">
                {t('organization.campusCode')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="campus-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campus-address">{t('organization.campusLocation')}</Label>
              <Input
                id="campus-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
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
              {editingItem ? t('common.save') : t('organization.addCampus')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
