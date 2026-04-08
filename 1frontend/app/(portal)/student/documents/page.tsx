'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { FileText, PlusCircle, Clock, Loader2 } from 'lucide-react'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function StudentDocumentsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND}/document-requests/my`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setRequests(await res.json())
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Request official documents and transcripts.</p>
        </div>
        <Link href="/student/documents/new">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            New Request
          </Button>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {['TRANSCRIPT', 'ENROLLMENT_CERTIFICATE', 'STUDENT_CERTIFICATE'].map((type) => (
          <Link key={type} href={`/student/documents/new?type=${type}`}>
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="size-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{type.replace(/_/g, ' ')}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Document requests list */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">My Document Requests</h2>
        </div>
        {requests.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <FileText className="size-7 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No document requests yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((req) => (
              <Link key={req.id} href={`/student/requests/${req.id}`}>
                <div className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="size-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{req.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="size-3" />
                        {formatDate(req.createdAt)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
