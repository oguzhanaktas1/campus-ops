'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  Paperclip,
  Search,
  ShieldX,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { CommentThread } from '@/components/comment-thread'
import { RequestTimeline } from '@/components/request-timeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getToken } from '@/lib/auth'
import type { RequestDetailViewModel } from '@/features/request-detail/types'

export function RequestAttachmentsPanel({
  detail,
}: {
  detail: RequestDetailViewModel
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
      </CardHeader>
      <CardContent>
        {detail.attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments uploaded.</p>
        ) : (
          <div className="space-y-3">
            {detail.attachments.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Paperclip className="size-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{file.size}</p>
                  </div>
                </div>
                {file.url ? (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={file.url} target="_blank" rel="noreferrer">
                      <Download className="size-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function RequestCommentsPanel({
  detail,
  onCommentAdded,
}: {
  detail: RequestDetailViewModel
  onCommentAdded: (nextComments: RequestDetailViewModel['comments']) => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddComment = async (text: string) => {
    const token = getToken()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
    if (!token) return

    setIsSubmitting(true)
    try {
      const response = await fetch(
        `${backendUrl}/student/requests/${detail.id}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        },
      )

      if (!response.ok) throw new Error('comment failed')

      const created = await response.json()
      onCommentAdded([
        ...detail.comments,
        {
          id: String(created.id ?? `tmp-${Date.now()}`),
          author:
            created.author ??
            created.user?.profile?.fullName ??
            created.user?.email ??
            'You',
          authorRole:
            created.authorRole ??
            created.user?.primaryRoles?.[0]?.role?.name?.toLowerCase() ??
            detail.portal,
          content: created.content ?? created.commentText ?? text,
          createdAt: String(created.createdAt ?? new Date().toISOString()),
        },
      ])
    } catch {
      toast.error('Could not post comment')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isSubmitting ? 'Comments - Sending...' : 'Comments'}</CardTitle>
      </CardHeader>
      <CardContent>
        <CommentThread
          comments={detail.comments as any}
          onAddComment={handleAddComment}
        />
      </CardContent>
    </Card>
  )
}

export function RequestTimelineTabs({
  detail,
}: {
  detail: RequestDetailViewModel
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline & Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="status">
          <TabsList className="mb-4 grid w-full grid-cols-4">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
          <TabsContent value="status">
            <RequestTimeline events={detail.statusHistory as any} />
          </TabsContent>
          <TabsContent value="assignments">
            {detail.currentAssignee ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                Current assignee:{' '}
                <span className="font-medium">{detail.currentAssignee.fullName}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No assignment history available.
              </p>
            )}
          </TabsContent>
          <TabsContent value="approvals">
            <p className="text-sm text-muted-foreground">
              Approval history is not aggregated by the current backend contract yet.
            </p>
          </TabsContent>
          <TabsContent value="audit">
            <RequestTimeline events={detail.timeline as any} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export function RequestActionPanel({
  detail,
  onDetailChange,
}: {
  detail: RequestDetailViewModel
  onDetailChange: (detail: RequestDetailViewModel) => void
}) {
  if (detail.portal === 'student') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.status === 'REVISION_REQUESTED' ? (
            <Button asChild className="w-full">
              <Link
                href={`/student/requests/${detail.id}/edit?type=${detail.requestType.key}`}
              >
                Revise Submission
              </Link>
            </Button>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Student actions stay scoped to comments, file uploads, revision, and
            request visibility.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (detail.portal === 'faculty') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/faculty/approvals">Open Decision Queue</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Approval and revision decisions remain centralized in the faculty
            approval flow.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (detail.portal === 'admin') {
    return <AdminActionPanel detail={detail} />
  }

  return <StaffActionPanel detail={detail} onDetailChange={onDetailChange} />
}

function AdminActionPanel({ detail }: { detail: RequestDetailViewModel }) {
  const router = useRouter()
  const [isClosing, setIsClosing] = useState(false)

  const handleForceClose = async () => {
    const token = getToken()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
    if (!token) return

    setIsClosing(true)
    try {
      const response = await fetch(`${backendUrl}/admin/requests/${detail.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('delete failed')

      toast.success('Request closed')
      router.push('/admin/requests')
    } catch {
      toast.error('Failed to close request')
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={handleForceClose}
          disabled={isClosing}
        >
          {isClosing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ShieldX className="size-4" />
          )}
          Force Close
        </Button>
        <p className="text-sm text-muted-foreground">
          Admin actions retain override behavior inside the shared shell.
        </p>
      </CardContent>
    </Card>
  )
}

function StaffActionPanel({
  detail,
  onDetailChange,
}: {
  detail: RequestDetailViewModel
  onDetailChange: (detail: RequestDetailViewModel) => void
}) {
  const [faculty, setFaculty] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<any | null>(null)
  const [search, setSearch] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const token = getToken()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
    if (!token) return

    const run = async () => {
      try {
        const response = await fetch(`${backendUrl}/staff/faculty-members`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('faculty failed')
        setFaculty(await response.json())
      } catch {
        toast.error('Faculty list could not be loaded')
      }
    }

    void run()
  }, [])

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    return faculty.filter((item) => {
      const name = item.profile?.fullName ?? item.fullName ?? ''
      const email = item.email ?? ''
      return (
        name.toLowerCase().includes(query) || email.toLowerCase().includes(query)
      )
    })
  }, [faculty, search])

  const handleAssign = async () => {
    const token = getToken()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'
    if (!token || !selected) return

    setIsAssigning(true)
    try {
      const response = await fetch(`${backendUrl}/staff/requests/${detail.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assigneeId: selected.id }),
      })

      if (!response.ok) throw new Error('assign failed')

      toast.success('Request assigned')
      onDetailChange({
        ...detail,
        status: 'IN_REVIEW',
        currentAssignee: {
          id: selected.id,
          fullName: selected.profile?.fullName ?? selected.fullName ?? 'Assigned user',
          email: selected.email ?? null,
        },
      })
      setSelected(null)
    } catch {
      toast.error('Assignment failed')
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4" ref={dropdownRef}>
        {detail.currentAssignee ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
            <UserCheck className="size-5 text-emerald-700" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Current Assignee
              </p>
              <p className="text-sm font-semibold text-foreground">
                {detail.currentAssignee.fullName}
              </p>
            </div>
          </div>
        ) : selected ? (
          <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  Ready to Assign
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {selected.profile?.fullName ?? selected.fullName}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setSelected(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleAssign}
              disabled={isAssigning}
            >
              {isAssigning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Confirm Assignment
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No assignee yet. Select a faculty member to move this request into
            review.
          </div>
        )}

        {!detail.currentAssignee && !selected ? (
          <div className="relative">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setIsOpen((value) => !value)}
            >
              <span className="flex items-center gap-2">
                <UserPlus className="size-4" />
                Select Faculty
              </span>
              <ChevronDown className="size-4" />
            </Button>

            {isOpen ? (
              <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-lg border bg-background shadow-lg">
                <div className="border-b p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                    <input
                      className="w-full rounded-md border bg-muted/40 py-2 pl-8 pr-3 text-sm outline-none"
                      placeholder="Search faculty..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto p-1">
                  {filtered.length > 0 ? (
                    filtered.map((item) => (
                      <button
                        key={item.id}
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"
                        onClick={() => {
                          setSelected(item)
                          setIsOpen(false)
                        }}
                      >
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {(item.profile?.fullName ?? item.fullName ?? '?').charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.profile?.fullName ?? item.fullName ?? 'Unknown'}
                          </p>
                          {item.profile?.department?.name ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {item.profile.department.name}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">
                      No faculty found.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
