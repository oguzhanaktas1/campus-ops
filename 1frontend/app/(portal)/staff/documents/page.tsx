'use client'

import { useEffect, useState, useCallback } from 'react'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { StaffListShell } from '@/components/staff/staff-list-shell'
import { StaffRequestRow, formatDate } from '@/components/staff/staff-request-row'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
const PAGE_SIZE = 20
const ALL_STATUSES = ['SUBMITTED', 'IN_REVIEW', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED']

export default function StaffDocumentsPage() {
  const { t } = useI18n()
  const [documents, setDocuments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeStatus, setActiveStatus] = useState('')
  const [activePriority, setActivePriority] = useState('')

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/document-requests/inbox`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (res.ok) setDocuments(await res.json())
      else setDocuments([])
    } catch {
      toast.error(t('pages.documentsLoadFail'))
      setDocuments([])
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => { void fetchDocuments() }, [fetchDocuments])

  const filtered = documents.filter((r) => {
    if (activeStatus && r.status?.toUpperCase() !== activeStatus) return false
    if (activePriority && r.priority !== activePriority) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.title?.toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      (r.requesterName ?? '').toLowerCase().includes(q) ||
      r.documentType?.toLowerCase().includes(q)
    )
  })

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <StaffListShell
      title={t('nav.documents')}
      subtitle={`${documents.length} document request(s)`}
      search={search}
      onSearchChange={(v) => { setSearch(v); setPage(1) }}
      searchPlaceholder={t('common.search')}
      statusOptions={ALL_STATUSES}
      activeStatus={activeStatus}
      onStatusChange={(s) => { setActiveStatus(s); setPage(1) }}
      activePriority={activePriority}
      onPriorityChange={(p) => { setActivePriority(p); setPage(1) }}
      isLoading={isLoading}
      totalCount={filtered.length}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={setPage}
      emptyIcon={<FileText className="size-8" />}
      emptyTitle={t('pages.noDocumentRequests')}
    >
      {paged.map((r) => (
        <StaffRequestRow
          key={r.id}
          href={`/staff/requests/documents/${r.id}`}
          title={r.title || r.documentType?.replace(/_/g, ' ') || 'Document Request'}
          requestNo={r.requestNo}
          badge={r.documentType?.replace(/_/g, ' ')}
          metaLeft={[
            r.requesterName,
            r.deliveryMethod,
            r.createdAt ? formatDate(r.createdAt) : undefined,
          ]}
          status={r.status}
          priority={r.priority}
        />
      ))}
    </StaffListShell>
  )
}
