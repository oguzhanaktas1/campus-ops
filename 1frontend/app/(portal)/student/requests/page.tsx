'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Clock, Loader2, MessageSquare, AlertCircle, User, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusColor: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  in_review: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  waiting_approval: 'bg-violet-50 text-violet-700 border-violet-200',
  revision_requested: 'bg-orange-50 text-orange-700 border-orange-200',
}

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'in_review', label: 'In Review' },
  { id: 'waiting_approval', label: 'Waiting Approval' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'completed', label: 'Completed' },
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
  str.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())

export default function RequestsListingPage() {
  const searchParams = useSearchParams()
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
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

        let url = `${backendUrl}/student/requests?`
        if (filterType) url += `type=${filterType}&`
        if (filterCategory) url += `category=${filterCategory}&`

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (res.ok) setRequests(await res.json())
      } catch (error) {
        console.error('Talepler çekilemedi:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()
  }, [filterType, filterCategory])

  let pageTitle = 'All Requests'
  if (filterType) {
    pageTitle = requests.length > 0 ? requests[0].typeName : formatTitle(filterType)
  } else if (filterCategory) {
    pageTitle = formatTitle(filterCategory) + 'S'
  }

  const pageSubtitle = (filterType || filterCategory)
    ? `Manage your ${pageTitle.toLowerCase()}`
    : 'Overview of all your campus requests'

  const filtered = requests.filter(r => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      r.title.toLowerCase().includes(q) ||
      r.typeName.toLowerCase().includes(q) ||
      (r.currentAssigneeName || r.assignedToName || '').toLowerCase().includes(q)
    const matchesStatus =
      statusFilter === 'all' || r.status.toLowerCase() === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{pageSubtitle}</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search title, type, assignee..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 bg-muted/50 p-1 rounded-lg border border-border w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-all',
              statusFilter === tab.id
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const assigneeToShow = req.currentAssigneeName || req.assignedToName

            return (
              <Link key={req.id} href={`/student/requests/${req.id}`} className="block">
                <div className="bg-card border border-border rounded-lg p-5 shadow-sm hover:border-primary/50 transition-colors">
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                    <h3 className="text-base font-semibold text-foreground">{req.title}</h3>
                    <div className="flex gap-2">
                      <Badge
                        variant="outline"
                        className={
                          req.priority === 'HIGH' || req.priority === 'URGENT'
                            ? 'border-red-200 text-red-600 bg-red-50'
                            : 'bg-muted'
                        }
                      >
                        {req.priority}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={statusColor[req.status.toLowerCase()] || statusColor['pending']}
                      >
                        {req.status.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap mt-3">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3.5" />
                      {new Date(req.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>

                    {!filterType && (
                      <span className="text-xs text-muted-foreground border-l border-border pl-4">
                        Type:{' '}
                        <span className="font-medium text-foreground">{req.typeName}</span>
                      </span>
                    )}

                    {assigneeToShow && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground border-l border-border pl-4">
                        <User className="size-3.5" /> Assigned to:{' '}
                        <span className="font-medium text-foreground">{assigneeToShow}</span>
                      </span>
                    )}

                    {req.commentCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-primary font-medium border-l border-border pl-4">
                        <MessageSquare className="size-3.5" /> {req.commentCount} Comments
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-dashed rounded-lg">
              <AlertCircle className="size-10 text-muted-foreground/50 mb-3" />
              <h3 className="text-sm font-semibold text-foreground">No requests found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your search or filter.'
                  : `You haven't created any ${pageTitle.toLowerCase()} yet.`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
