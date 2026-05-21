import Link from 'next/link'
import { ArrowLeft, User, Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PriorityBadge, StatusBadge } from '@/components/status-badge'
import type { RequestDetailViewModel } from '@/features/request-detail/types'
import { formatDate } from '@/features/request-detail/utils'

export function RequestHeader({
  detail,
  backHref: customBackHref,
}: {
  detail: RequestDetailViewModel
  backHref?: string
}) {
  const backHref =
    customBackHref ??
    (detail.portal === 'staff' ? '/staff/requests' : `/${detail.portal}/requests`)

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon" className="size-8 shrink-0 mt-0.5">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] tracking-wider text-muted-foreground bg-muted/70 px-2 py-0.5 rounded">
              {detail.requestNo}
            </span>
            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              {detail.requestType.name}
            </span>
          </div>

          <h1 className="text-xl font-bold text-foreground leading-snug">
            {detail.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDate(detail.submittedAt ?? detail.createdAt)}
            </span>
            {detail.requester?.fullName ? (
              <span className="flex items-center gap-1">
                <User className="size-3" />
                {detail.requester.fullName}
              </span>
            ) : null}
            {detail.dueAt ? (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <Clock className="size-3" />
                Due {formatDate(detail.dueAt)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <PriorityBadge priority={detail.priority} />
        <StatusBadge status={detail.status} />
      </div>
    </div>
  )
}
