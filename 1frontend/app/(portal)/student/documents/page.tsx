'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { FileText, PlusCircle, Clock, Loader2, AlertCircle } from 'lucide-react'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function formatDate(d: string, locale: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function StudentDocumentsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { locale, t } = useI18n()

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('documents.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('documents.subtitle')}</p>
        </div>
        <Link href="/student/documents/new" className="shrink-0">
          <Button size="sm" className="gap-1.5">
            <PlusCircle className="size-3.5" />
            {t('documents.newRequest')}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {['TRANSCRIPT', 'ENROLLMENT_CERTIFICATE', 'STUDENT_CERTIFICATE'].map((type) => (
          <Link key={type} href={`/student/documents/new?type=${type}`}>
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="size-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{type.replace(/_/g, ' ')}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">{t('documents.myRequests')}</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <AlertCircle className="size-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">{t('documents.noRequests')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((req) => (
              <Link
                key={req.id}
                href={`/student/requests/${req.id}`}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{req.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="size-3" />
                    {formatDate(req.createdAt, locale)}
                  </p>
                </div>
                <StatusBadge status={req.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
