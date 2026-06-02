'use client'

import { useState, useRef, useCallback } from 'react'
import { Paperclip, Upload, FolderOpen, X, FileText, Search, Loader2, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { toast } from 'sonner'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const MAX_MB = 10
const MAX_BYTES = MAX_MB * 1024 * 1024
const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.zip,.rar,.txt,.csv'

export interface AttachmentsState {
  newFiles: File[]
  linkedFileIds: string[]
  isUploading?: boolean
}

interface Props {
  onChange: (state: AttachmentsState) => void
  uploadUrl?: string
  hidePicker?: boolean
}

type FileEntry = {
  key: string
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  uploadedId?: string
}

function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function makeKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

export function RequestAttachments({ onChange, uploadUrl, hidePicker = false }: Props) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [entries, setEntries] = useState<FileEntry[]>([])
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [linkedMeta, setLinkedMeta] = useState<Record<string, { name: string; size: number }>>({})

  const [isDragOver, setIsDragOver] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [myFiles, setMyFiles] = useState<any[]>([])
  const [loadingMyFiles, setLoadingMyFiles] = useState(false)
  const [query, setQuery] = useState('')

  const buildState = useCallback(
    (currentEntries: FileEntry[], currentLinkedIds: string[]): AttachmentsState => {
      const failedFiles = currentEntries.filter((e) => e.status === 'error').map((e) => e.file)
      const uploadedIds = currentEntries.filter((e) => e.status === 'done' && e.uploadedId).map((e) => e.uploadedId!)
      const isUploading = currentEntries.some((e) => e.status === 'uploading' || e.status === 'pending')
      return {
        newFiles: failedFiles,
        linkedFileIds: [...currentLinkedIds, ...uploadedIds],
        isUploading,
      }
    },
    [],
  )

  const emit = useCallback(
    (currentEntries: FileEntry[], currentLinkedIds: string[]) => {
      onChange(buildState(currentEntries, currentLinkedIds))
    },
    [onChange, buildState],
  )

  const uploadEntry = useCallback(
    async (entry: FileEntry, url: string) => {
      setEntries((prev) => {
        const next = prev.map((e) => (e.key === entry.key ? { ...e, status: 'uploading' as const } : e))
        emit(next, linkedIds)
        return next
      })

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20_000)

      try {
        const fd = new FormData()
        fd.append('file', entry.file)
        const res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
          body: fd,
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (res.ok) {
          const d = await res.json()
          const uploadedId = d.id as string | undefined
          if (uploadedId) {
            setEntries((prev) => {
              const next = prev.map((e) =>
                e.key === entry.key ? { ...e, status: 'done' as const, uploadedId } : e,
              )
              emit(next, linkedIds)
              return next
            })
            return
          }
        }
      } catch { /* abort or network error — fall through to error state */ }
      finally { clearTimeout(timeout) }

      setEntries((prev) => {
        const next = prev.map((e) => (e.key === entry.key ? { ...e, status: 'error' as const } : e))
        emit(next, linkedIds)
        return next
      })
      toast.error(`${entry.file.name} — upload failed`)
    },
    [emit, linkedIds],
  )

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const newEntries: FileEntry[] = []
      for (const f of Array.from(incoming)) {
        if (f.size > MAX_BYTES) {
          toast.error(`${f.name} — max ${MAX_MB} MB`)
          continue
        }
        const key = makeKey(f)
        if (entries.some((e) => e.key === key)) continue
        newEntries.push({ key, file: f, status: uploadUrl ? 'pending' : 'pending' })
      }
      if (!newEntries.length) return

      setEntries((prev) => {
        const next = [...prev, ...newEntries]
        emit(next, linkedIds)
        return next
      })

      if (uploadUrl) {
        for (const entry of newEntries) {
          void uploadEntry(entry, uploadUrl)
        }
      }
    },
    [entries, linkedIds, uploadUrl, uploadEntry, emit],
  )

  const removeEntry = (key: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.key !== key)
      emit(next, linkedIds)
      return next
    })
  }

  const removeLinked = (id: string) => {
    const next = linkedIds.filter((x) => x !== id)
    setLinkedIds(next)
    setLinkedMeta((prev) => { const m = { ...prev }; delete m[id]; return m })
    emit(entries, next)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  const handleBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  const openPicker = async () => {
    setPickerOpen(true)
    if (myFiles.length || loadingMyFiles) return
    setLoadingMyFiles(true)
    try {
      const res = await fetch(`${BACKEND}/student/files`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setMyFiles(await res.json())
    } catch { /* silent */ } finally {
      setLoadingMyFiles(false)
    }
  }

  const toggle = (file: any) => {
    if (linkedIds.includes(file.id)) {
      removeLinked(file.id)
    } else {
      const next = [...linkedIds, file.id]
      setLinkedIds(next)
      setLinkedMeta((prev) => ({ ...prev, [file.id]: { name: file.name, size: file.size ?? 0 } }))
      emit(entries, next)
    }
  }

  const filtered = myFiles.filter((f) => f.name?.toLowerCase().includes(query.toLowerCase()))
  const total = entries.length + linkedIds.length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t('forms.attachmentsOptional')}</span>
        {total > 0 && (
          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
            {total}
          </span>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg px-4 py-5 text-center transition-colors cursor-pointer ${
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className={`size-6 mx-auto mb-1.5 ${isDragOver ? 'text-primary' : 'text-muted-foreground/50'}`} />
        <p className="text-sm text-muted-foreground">
          {t('forms.dropFilesHere')}{' '}
          <span className="text-primary font-medium">{t('forms.browse')}</span>
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{t('forms.fileTypeHint')}</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={handleBrowse}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {!hidePicker && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-2 text-muted-foreground hover:text-foreground"
          onClick={openPicker}
        >
          <FolderOpen className="size-4" />
          {t('forms.selectFromMyFiles')}
        </Button>
      )}

      {total > 0 && (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={entry.key}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 border ${
                entry.status === 'done'
                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                  : entry.status === 'error'
                    ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
                    : 'bg-muted/40 border-border'
              }`}
            >
              <FileText className={`size-4 shrink-0 ${
                entry.status === 'done' ? 'text-emerald-600' :
                entry.status === 'error' ? 'text-red-500' :
                'text-muted-foreground'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{entry.file.name}</p>
                <p className="text-[10px] text-muted-foreground">{fmt(entry.file.size)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {(entry.status === 'uploading' || entry.status === 'pending') && (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                )}
                {entry.status === 'done' && (
                  <Check className="size-3.5 text-emerald-600" />
                )}
                {entry.status === 'error' && (
                  <AlertCircle className="size-3.5 text-red-500" />
                )}
                <button
                  type="button"
                  onClick={() => removeEntry(entry.key)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ))}

          {linkedIds.map((id) => {
            const m = linkedMeta[id]
            return (
              <div
                key={id}
                className="flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-md px-3 py-2"
              >
                <FileText className="size-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{m?.name ?? id}</p>
                  {m?.size ? <p className="text-[10px] text-muted-foreground">{fmt(m.size)}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeLinked(id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md flex flex-col max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="size-4" />
              {t('forms.selectFromMyFiles')}
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t('forms.searchFilesPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
            {loadingMyFiles ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                {myFiles.length === 0 ? t('forms.noFilesYet') : t('forms.noFilesMatch')}
              </p>
            ) : (
              filtered.map((file) => {
                const sel = linkedIds.includes(file.id)
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => toggle(file)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      sel
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/60 border border-transparent'
                    }`}
                  >
                    <div className={`size-7 rounded-md flex items-center justify-center shrink-0 ${sel ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                      {sel ? <Check className="size-3.5" /> : <FileText className="size-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.size ? fmt(file.size) : ''}
                        {file.uploadedAt ? ` · ${new Date(file.uploadedAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {linkedIds.length > 0 ? `${linkedIds.length} ${t('common.selected')}` : ''}
            </span>
            <Button size="sm" onClick={() => setPickerOpen(false)}>
              {t('forms.doneBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Upload File[] in parallel and return their server-side IDs. */
export async function uploadAttachments(
  files: File[],
  uploadUrl = `${BACKEND}/student/upload`,
): Promise<string[]> {
  if (!files.length) return []

  const results = await Promise.all(
    files.map(async (file) => {
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${getToken()}` },
          body: fd,
        })
        if (res.ok) {
          const d = await res.json()
          return d.id as string | undefined
        }
      } catch { /* non-blocking */ }
      return undefined
    }),
  )

  return results.filter((id): id is string => Boolean(id))
}
