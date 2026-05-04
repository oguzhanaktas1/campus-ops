'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Search, Plus, Trash2, Loader2, FileCheck2, Settings2, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { AddRequestTypeModal } from '@/components/admin/add-request-type-modal'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

interface RequestType {
  id: string
  key: string
  name: string
  description: string | null
  category: string
  isActive: boolean
  createdAt: string
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
}

export default function RequestTypesPage() {
  const { t } = useI18n()
  const [types, setTypes] = useState<RequestType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Edit dialog
  const [editItem, setEditItem] = useState<RequestType | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', category: '', isActive: true })
  const [isSaving, setIsSaving] = useState(false)

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/request-types`, { headers: authHeaders() })
      if (res.ok) setTypes(await res.json())
      else toast.error(t('requestTypes.saveFail'))
    } catch {
      toast.error(t('requestTypes.saveFail'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void fetchTypes() }, [fetchTypes])

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([])
    else setSelectedIds(filtered.map((t) => t.id))
  }

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((i) => i !== id))
    else setSelectedIds([...selectedIds, id])
  }

  const handleBulkDelete = async () => {
    if (!window.confirm(t('requestTypes.deleteConfirm', { count: selectedIds.length }))) return
    setIsDeleting(true)
    try {
      const res = await fetch(`${BACKEND}/admin/request-types/bulk-delete`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ids: selectedIds }),
      })
      if (res.ok) {
        toast.success(t('requestTypes.deleteSuccess'))
        setSelectedIds([])
        void fetchTypes()
      } else {
        toast.error(t('requestTypes.deleteFail'))
      }
    } catch {
      toast.error(t('requestTypes.saveFail'))
    } finally {
      setIsDeleting(false)
    }
  }

  const openEdit = (type: RequestType) => {
    setEditItem(type)
    setEditForm({
      name: type.name,
      description: type.description ?? '',
      category: type.category,
      isActive: type.isActive,
    })
  }

  const handleSaveEdit = async () => {
    if (!editItem) return
    setIsSaving(true)
    try {
      const res = await fetch(`${BACKEND}/admin/request-types/${editItem.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          category: editForm.category,
          isActive: editForm.isActive,
        }),
      })
      if (res.ok) {
        toast.success(t('requestTypes.saveSuccess'))
        setEditItem(null)
        void fetchTypes()
      } else {
        const err = await res.json().catch(() => ({})) as { message?: string }
        toast.error(err.message ?? t('requestTypes.saveFail'))
      }
    } catch {
      toast.error(t('requestTypes.saveFail'))
    } finally {
      setIsSaving(false)
    }
  }

  const filtered = types.filter(
    (t) =>
      search === '' ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()),
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
          <h1 className="text-xl font-bold text-foreground">{t('requestTypes.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('requestTypes.subtitle', { count: types.length })}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setIsModalOpen(true)}>
          <Plus className="size-3.5" /> {t('requestTypes.addNewType')}
        </Button>
      </div>

      {/* Search + bulk-delete bar */}
      <div className="flex items-center justify-between gap-4 bg-card border border-border p-3 rounded-lg shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('requestTypes.searchByNameCategory')}
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-200">
            <span className="text-sm font-medium text-muted-foreground">{t('requestTypes.selected', { count: selectedIds.length })}</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {t('requestTypes.deleteSelected')}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-5 py-3 text-left w-12">
                <input
                  type="checkbox"
                  className="rounded border-border size-4 cursor-pointer"
                  checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">{t('requestTypes.colTypeKey')}</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">
                {t('requestTypes.colCategory')}
              </th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">{t('requestTypes.colStatus')}</th>
              <th className="px-5 py-3 text-right font-semibold text-muted-foreground">{t('requestTypes.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((type) => (
              <tr
                key={type.id}
                className={cn(
                  'hover:bg-muted/20 transition-colors',
                  selectedIds.includes(type.id) && 'bg-primary/5 hover:bg-primary/10',
                )}
              >
                <td className="px-5 py-3.5">
                  <input
                    type="checkbox"
                    className="rounded border-border size-4 cursor-pointer"
                    checked={selectedIds.includes(type.id)}
                    onChange={() => toggleSelectOne(type.id)}
                  />
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-md bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 flex-shrink-0">
                      <Settings2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-foreground">{type.name}</p>
                      <p className="text-xs text-muted-foreground truncate uppercase tracking-wider">{type.key}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
                    {type.category}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  {type.isActive ? (
                    <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold tracking-wider">
                      {t('requestTypes.active')}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-[10px] font-bold tracking-wider">
                      {t('requestTypes.inactive')}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(type)}>
                    <Pencil className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <FileCheck2 className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('requestTypes.noTypes')}</p>
          </div>
        )}
      </div>

      {/* Add modal */}
      <AddRequestTypeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchTypes} />

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('requestTypes.editType')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('requestTypes.name')} <span className="text-destructive">*</span></Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder={t('requestTypes.namePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('requestTypes.category')}</Label>
              <Input
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                placeholder={t('requestTypes.categoryPlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('requestTypes.description')}</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={editForm.isActive}
                onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editForm.isActive ? 'bg-primary' : 'bg-muted-foreground/30'}`}
              >
                <span className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${editForm.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <Label
                className="cursor-pointer"
                onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
              >
                {editForm.isActive ? t('common.active') : t('common.inactive')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)} disabled={isSaving}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('requestTypes.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
