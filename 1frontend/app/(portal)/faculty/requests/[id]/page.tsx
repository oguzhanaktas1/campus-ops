'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  RelatedEntitiesCard,
  RequestMetaCard,
  RequestQuickFactsCard,
  WorkflowCurrentStepCard,
} from '@/features/request-detail/components/RequestCards'
import {
  RequestActionPanel,
  RequestAttachmentsPanel,
  RequestCommentsPanel,
  RequestTimelineTabs,
} from '@/features/request-detail/components/RequestPanels'
import { DomainDetailPanel } from '@/features/request-detail/domain-panels/DomainDetailPanel'
import { RequestHeader } from '@/features/request-detail/components/RequestHeader'
import { useRequestDetail } from '@/features/request-detail/hooks/useRequestDetail'
import { useI18n } from '@/lib/i18n'

const FACULTY_BACK_PATHS = new Set([
  '/faculty/requests',
  '/faculty/approvals',
  '/faculty/internships',
  '/faculty/appointments',
  '/faculty/events',
  '/faculty/documents',
  '/faculty/equipment',
  '/faculty/reservations',
  '/faculty/procurement',
  '/faculty/tickets',
  '/faculty/access-requests',
])

function getSafeBackHref(value: string | null) {
  if (!value) return '/faculty/requests'
  const path = value.split('?')[0]
  return FACULTY_BACK_PATHS.has(path) ? value : '/faculty/requests'
}

export default function FacultyRequestDetailRoute() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const requestId = params.id as string
  const backHref = getSafeBackHref(searchParams.get('from'))
  const { detail, isLoading, setDetail } = useRequestDetail(requestId, 'faculty')

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex h-[70vh] items-center justify-center p-6">
        <div className="max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
          <FileText className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-foreground">{t('detail.requestNotFound')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('detail.requestUnavailable')}
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={backHref}>{t('common.back')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-muted/10">
      <div className="mx-auto max-w-7xl space-y-6 p-6 pb-20">
        <div className="flex items-center justify-end gap-4">
          <p className="text-xs text-muted-foreground">
            {t('detail.facultyRequestDetail')}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <RequestHeader detail={detail} backHref={backHref} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_340px]">
          <div className="space-y-6">
            <WorkflowCurrentStepCard detail={detail} />
            <RequestMetaCard detail={detail} />
            <DomainDetailPanel detail={detail} />
            <RequestAttachmentsPanel detail={detail} />
            <RequestCommentsPanel
              detail={detail}
              onCommentAdded={(comments) => setDetail({ ...detail, comments })}
            />
            <RequestTimelineTabs detail={detail} />
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <RequestActionPanel detail={detail} onDetailChange={setDetail} />
            <RequestQuickFactsCard detail={detail} />
            <RelatedEntitiesCard detail={detail} />
          </aside>
        </div>
      </div>
    </div>
  )
}
