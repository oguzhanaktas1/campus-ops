'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Clock, Loader2, MessageSquare, User, AlertCircle } from 'lucide-react'
import { PriorityBadge, StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { SmartSearchInput } from '@/components/smart-search-input'
import { smartFilter } from '@/lib/smart-search'

const STATUS_TABS = [
  { id: 'all',                labelKey: 'requests.all' },
  { id: 'submitted',          labelKey: 'requests.submitted' },
  { id: 'in_review',          labelKey: 'requests.inReview' },
  { id: 'waiting_approval',   labelKey: 'requests.waitingApproval' },
  { id: 'revision_requested', labelKey: 'requests.revisionRequested' },
  { id: 'approved',           labelKey: 'requests.approved' },
  { id: 'rejected',           labelKey: 'requests.rejected' },
  { id: 'completed',          labelKey: 'requests.completed' },
]

interface RequestItem {
  id: string
  title: string
  type: string
  typeName: string
  status: string
  priority: string
  createdAt: string
  assignedToName: string | null
  currentAssigneeName?: string | null
  commentCount: number
}

const formatTitle = (str: string) =>
  str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default function RequestsListingPage() {
  const searchParams = useSearchParams()
  const { locale, t } = useI18n()
  const filterType = searchParams.get('type')
  const filterCategory = searchParams.get('category')

  const [requests, setRequests] = useState<RequestItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setIsLoading(true)
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        let url = `${backendUrl}/student/requests?`
        if (filterType) url += `type=${filterType}&`
        if (filterCategory) url += `category=${filterCategory}&`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } })
        if (res.ok) setRequests(await res.json())
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }
    fetchRequests()
  }, [filterType, filterCategory])

  let pageTitle = t('requests.allRequests')
  if (filterType) {
    pageTitle = requests.length > 0 ? requests[0].typeName : formatTitle(filterType)
  } else if (filterCategory) {
    pageTitle = formatTitle(filterCategory) + 'S'
  }

  const pageSubtitle = (filterType || filterCategory)
    ? t('requests.manageYour', { title: pageTitle.toLowerCase() })
    : t('requests.subtitle')

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })

  const filtered = (() => {
    const byStatus = requests.filter((r) =>
      statusFilter === 'all' || r.status.toLowerCase() === statusFilter
    )
    if (!searchQuery.trim()) return byStatus
    return smartFilter(byStatus, searchQuery, [
      { getValue: (r: RequestItem) => r.title, weight: 2 },
      { getValue: (r: RequestItem) => r.typeName, weight: 1 },
      { getValue: (r: RequestItem) => r.currentAssigneeName ?? r.assignedToName, weight: 0.8 },
    ])
  })()

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{pageSubtitle}</p>
        </div>
        <SmartSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('requests.searchPlaceholder')}
          resultCount={searchQuery.trim() ? filtered.length : undefined}
          className="w-full sm:w-64 shrink-0"
        />
      </div>

      <div className="flex flex-wrap gap-1 bg-muted/50 p-1 rounded-lg border border-border w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-all',
              statusFilter === tab.id
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('requests.noRequestsFound')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery || statusFilter !== 'all'
                ? t('requests.adjustSearch')
                : t('requests.noneCreated', { title: pageTitle.toLowerCase() })}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((req) => {
              const assignee = req.currentAssigneeName || req.assignedToName
              return (
                <Link
                  key={req.id}
                  href={`/student/requests/${req.id}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{req.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(req.createdAt)}
                      </span>
                      {!filterType && (
                        <span>{req.typeName}</span>
                      )}
                      {assignee && (
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {assignee}
                        </span>
                      )}
                      {req.commentCount > 0 && (
                        <span className="flex items-center gap-1 text-primary font-medium">
                          <MessageSquare className="size-3" />
                          {t('requests.comments', { count: req.commentCount })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <PriorityBadge priority={req.priority} />
                    <StatusBadge status={req.status} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
