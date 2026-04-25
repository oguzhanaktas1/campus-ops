'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/status-badge'
import { Search, Loader2, MessageSquare, AlertCircle, User, Clock, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const categorySlugMap: Record<string, string> = {
  IT_SUPPORT: 'it-support',
  ADMINISTRATIVE: 'administrative',
  INVENTORY: 'inventory',
  CAMPUS_SERVICES: 'campus-services',
  STUDENT_LIFE: 'student-life',
}

const TABS = [
  { id: 'unassigned', label: 'Needs Assignment' },
  { id: 'active', label: 'Active' },
  { id: 'all', label: 'All Requests' },
  { id: 'closed', label: 'Closed' },
]

const priorityClass: Record<string, string> = {
  HIGH: 'border-red-200 text-red-600 bg-red-50',
  URGENT: 'border-red-200 text-red-600 bg-red-50',
  MEDIUM: 'border-amber-200 text-amber-600 bg-amber-50',
  LOW: 'bg-muted text-muted-foreground',
}

const TERMINAL_STATUSES = new Set(['APPROVED', 'REJECTED', 'COMPLETED', 'CLOSED', 'CANCELLED'])

export default function StaffRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'unassigned' | 'active' | 'closed'>('unassigned')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchRequests = async () => {
      setIsLoading(true)
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

        const res = await fetch(`${backendUrl}/staff/requests?filter=${activeTab}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.ok) setRequests(await res.json())
      } catch {
        toast.error('Could not load requests.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()
  }, [activeTab])

  const filteredRequests = requests.filter(r => {
    const q = searchQuery.toLowerCase()
    return (
      r.title?.toLowerCase().includes(q) ||
      r.requestNo?.toLowerCase().includes(q) ||
      r.requesterName?.toLowerCase().includes(q) ||
      r.typeName?.toLowerCase().includes(q)
    )
  })

  const handleRowClick = (req: any) => {
    const slug = categorySlugMap[req.category] || 'general'
    router.push(`/staff/requests/${slug}/${req.id}`)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-foreground">Inbox</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and manage incoming campus requests.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ID, title, or name..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-muted/50 p-1 rounded-lg border border-border w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-all',
              activeTab === tab.id
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
          {filteredRequests.map(req => (
            <div
              key={req.id}
              onClick={() => handleRowClick(req)}
              className="bg-card border border-border rounded-lg p-5 shadow-sm hover:border-primary/50 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                  {req.title}
                </h3>
                <div className="flex gap-2 shrink-0">
                  {req.priority && (
                    <Badge
                      variant="outline"
                      className={priorityClass[req.priority] || 'bg-muted text-muted-foreground'}
                    >
                      {req.priority}
                    </Badge>
                  )}
                  <StatusBadge status={req.status} />
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap mt-3">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {formatDate(req.createdAt)}
                </span>

                <span className="text-xs text-muted-foreground border-l border-border pl-4">
                  Type: <span className="font-medium text-foreground">{req.typeName}</span>
                </span>

                <span className="flex items-center gap-1 text-xs text-muted-foreground border-l border-border pl-4">
                  <User className="size-3.5" />
                  From:{' '}
                  <span className="font-medium text-foreground ml-1">{req.requesterName}</span>
                </span>

                {req.assignedTo ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground border-l border-border pl-4">
                    <User className="size-3.5" />
                    Assigned to:{' '}
                    <span className="font-medium text-foreground ml-1">{req.assignedTo}</span>
                  </span>
                ) : !TERMINAL_STATUSES.has(req.status) ? (
                  <span className="flex items-center gap-1 text-xs text-amber-600 font-medium border-l border-border pl-4">
                    <UserPlus className="size-3.5" /> Unassigned
                  </span>
                ) : null}

                {req.commentCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-primary font-medium border-l border-border pl-4">
                    <MessageSquare className="size-3.5" /> {req.commentCount} Comments
                  </span>
                )}
              </div>
            </div>
          ))}

          {filteredRequests.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-dashed rounded-lg">
              <AlertCircle className="size-10 text-muted-foreground/50 mb-3" />
              <h3 className="text-sm font-semibold text-foreground">No requests found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery
                  ? 'Try adjusting your search query.'
                  : 'There are no requests in this category.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
