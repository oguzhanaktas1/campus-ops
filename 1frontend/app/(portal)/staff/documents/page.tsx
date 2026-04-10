'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/status-badge'
import { EmptyState } from '@/components/empty-state'
import {
  FileText,
  Filter,
  Loader2,
  ChevronRight,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

interface DocumentRequest {
  id: string
  documentRequestId?: string
  requestNo: string
  title: string
  requesterName: string
  status: string
  priority: string
  createdAt: string
  documentType: string
  deliveryMethod?: string
}

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed' | 'rejected'

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' },
]

const DOC_TYPE_LABELS: Record<string, string> = {
  TRANSCRIPT: 'Transcript',
  ENROLLMENT_CERTIFICATE: 'Enrollment Certificate',
  STUDENT_CERTIFICATE: 'Student Certificate',
  DIPLOMA: 'Diploma',
  OTHER: 'Other',
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDocType(req: DocumentRequest): string {
  const raw = req.documentType || 'Administrative'
  return DOC_TYPE_LABELS[raw] ?? raw.replace(/_/g, ' ')
}

export default function StaffDocumentsPage() {
  const router = useRouter()
  const [documents, setDocuments] = useState<DocumentRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all')

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/document-requests/inbox`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) {
          const data = await res.json()
          setDocuments(Array.isArray(data) ? data : [])
        } else {
          setDocuments([])
        }
      } catch {
        toast.error('Failed to load documents.')
        setDocuments([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchDocuments()
  }, [])

  const getCount = (key: FilterStatus) => {
    if (key === 'all') return documents.length
    return documents.filter((r) => {
      const s = r.status?.toLowerCase()
      if (key === 'pending') return ['pending', 'submitted', 'waiting_approval'].includes(s)
      if (key === 'in_progress') return ['in_progress', 'in_review', 'under_review'].includes(s)
      if (key === 'completed') return s === 'completed'
      if (key === 'rejected') return s === 'rejected'
      return false
    }).length
  }

  const filtered = documents.filter((r) => {
    if (activeFilter === 'all') return true
    const s = r.status?.toLowerCase()
    if (activeFilter === 'pending') return ['pending', 'submitted', 'waiting_approval'].includes(s)
    if (activeFilter === 'in_progress') return ['in_progress', 'in_review', 'under_review'].includes(s)
    if (activeFilter === 'completed') return s === 'completed'
    if (activeFilter === 'rejected') return s === 'rejected'
    return true
  })

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="size-5 text-primary" /> Documents
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage document and administrative requests
        </p>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-border flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="size-3.5 text-muted-foreground mr-1" />
            {FILTER_TABS.map((tab) => {
              const count = getCount(tab.key)
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5',
                    activeFilter === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={cn(
                        'text-[9px] font-bold px-1 rounded-full',
                        activeFilter === tab.key
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} records</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No document requests"
            description={
              activeFilter === 'all'
                ? 'Administrative and document requests will appear here.'
                : `No ${activeFilter.replace('_', ' ')} document requests found.`
            }
            icon={<FolderOpen className="size-6" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Request No
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Document Type
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Requester
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Submitted At
                  </th>
                  <th className="sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => router.push(`/staff/requests/documents/${req.id}`)}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {req.requestNo ?? req.id.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                          <FileText className="size-3.5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{getDocType(req)}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {req.title}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                          {req.requesterName?.charAt(0) || 'U'}
                        </div>
                        <span className="text-muted-foreground">
                          {req.requesterName || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">
                      {formatDate(req.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
