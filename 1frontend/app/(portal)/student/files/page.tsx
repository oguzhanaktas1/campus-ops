'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { FolderOpen, Download, MoreHorizontal, Loader2, FileText, ExternalLink, Upload, ShieldCheck, Search, Trash2, AlertTriangle } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Progress } from "@/components/ui/progress"
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'

interface FileItem {
  id: string; name: string; size: string; rawSize: number; type: string; uploadedAt: string; relatedTo: string; url: string;
}

export default function StudentFilesPage() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [totalUsedBytes, setTotalUsedBytes] = useState(0)
  
  // Arama, Filtre ve Silme Stateleri
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const MAX_LIMIT_BYTES = 50 * 1024 * 1024; // 50MB
  const { t } = useI18n()

  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/student/files`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setFiles(data)
        const total = data.reduce((sum: number, f: FileItem) => sum + f.rawSize, 0)
        setTotalUsedBytes(total)
      }
    } catch (error) {
      console.error('Files error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchFiles() }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (totalUsedBytes + file.size > MAX_LIMIT_BYTES) {
      toast.error(t('messages.storageLimit'))
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/student/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })

      if (res.ok) {
        toast.success(t('messages.uploadSuccess'))
        fetchFiles()
      } else {
        const err = await res.json()
        toast.error(err.message || t('messages.uploadFail'))
      }
    } catch (err) { toast.error(t('messages.networkError')) } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // DOSYA SİLME FONKSİYONU
  const handleDelete = async () => {
    if (!fileToDelete) return
    setIsDeleting(true)

    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/student/files/${fileToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        toast.success(t('messages.fileDeleted'))
        fetchFiles() // Listeyi ve storage barı güncelle
      } else {
        toast.error(t('messages.deleteFileFail'))
      }
    } catch (err) {
      toast.error(t('messages.networkError'))
    } finally {
      setIsDeleting(false)
      setFileToDelete(null) // Modalı kapat
    }
  }

  // ARAMA VE FİLTRELEME MANTIĞI
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            f.relatedTo.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = typeFilter === 'ALL' || f.type === typeFilter
      return matchesSearch && matchesType
    })
  }, [files, searchQuery, typeFilter])

  // Dinamik olarak dosya tiplerini çıkaralım (PDF, JPG vs. dropdown için)
  const uniqueTypes = Array.from(new Set(files.map(f => f.type)))

  const usagePercent = (totalUsedBytes / MAX_LIMIT_BYTES) * 100;
  const usedMB = (totalUsedBytes / 1024 / 1024).toFixed(1);

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-20 relative">
      
      {/* SİLME ONAY MODALI (Custom) */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-background border border-border p-6 rounded-lg shadow-xl max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="size-6" />
              <h2 className="text-lg font-bold">{t('common.delete')}?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('common.delete')} <strong>{fileToDelete.name}</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" disabled={isDeleting} onClick={() => setFileToDelete(null)}>{t('common.cancel')}</Button>
              <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
                {t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* BAŞLIK VE UPLOAD */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('pages.filesTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('pages.filesSubtitle')}</p>
        </div>
        <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} />
        <Button size="sm" className="gap-1.5" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
          {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {isUploading ? t('common.loading') : t('common.upload')}
        </Button>
      </div>

      {/* STORAGE USAGE CARD */}
      <div className="bg-card border border-border rounded-lg p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">{t('pages.storageQuota')}</span>
          </div>
          <span className={cn("text-xs font-medium", usagePercent > 90 ? "text-red-500" : "text-muted-foreground")}>
            {usedMB} MB / 50 MB ({usagePercent.toFixed(0)}%)
          </span>
        </div>
        <Progress value={usagePercent} className={cn("h-2", usagePercent > 90 ? "[&>div]:bg-red-500" : "")} />
      </div>

      {/* ARAMA VE FİLTRELEME ÇUBUĞU */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder={t('forms.searchFilesPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="w-full sm:w-auto">
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-[150px] px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ALL">{t('pages.allTypes')}</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LİSTELEME */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/20 flex justify-between">
          <p className="text-xs font-medium text-muted-foreground">{t('pages.filesFound', { count: filteredFiles.length })}</p>
        </div>
        <div className="divide-y divide-border">
          {filteredFiles.map((file) => (
            <div key={file.id} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/5 transition-colors group">
              <div className="size-10 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                <FileText className="size-5 text-primary/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                   <p className="text-xs text-muted-foreground">{file.size} · {file.uploadedAt}</p>
                   <span className="text-[10px] text-muted-foreground/40">•</span>
                   <p className="text-xs font-medium text-primary/80 italic truncate max-w-[200px]">{file.relatedTo}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">{file.type}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild><a href={file.url} target="_blank" rel="noreferrer"><ExternalLink className="size-4 mr-2" />{t('common.view')}</a></DropdownMenuItem>
                  <DropdownMenuItem asChild><a href={file.url} download={file.name} className="font-medium"><Download className="size-4 mr-2" />{t('common.download')}</a></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* 🔥 SİL BUTONU 🔥 */}
                  <DropdownMenuItem onClick={() => setFileToDelete(file)} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                    <Trash2 className="size-4 mr-2" />{t('common.delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {filteredFiles.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center px-5">
              <FolderOpen className="size-12 text-muted-foreground/20 mb-4" />
              <h3 className="text-sm font-semibold text-foreground">{t('pages.noMatches')}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t('requests.adjustSearch')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
