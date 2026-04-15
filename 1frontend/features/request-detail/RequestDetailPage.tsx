'use client'

import { Loader2 } from 'lucide-react'
import { RequestHeader } from '@/features/request-detail/components/RequestHeader'
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
import { useRequestDetail } from '@/features/request-detail/hooks/useRequestDetail'
import type { RequestPortal } from '@/features/request-detail/types'

export function RequestDetailPage({
  portal,
  requestId,
}: {
  portal: RequestPortal
  requestId: string
}) {
  const { detail, isLoading, setDetail } = useRequestDetail(requestId, portal)

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Request not found.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 pb-20">
      <RequestHeader detail={detail} />

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

        <div className="space-y-6">
          <RequestActionPanel detail={detail} onDetailChange={setDetail} />
          <RequestQuickFactsCard detail={detail} />
          <RelatedEntitiesCard detail={detail} />
        </div>
      </div>
    </div>
  )
}
