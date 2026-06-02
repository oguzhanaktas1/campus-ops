import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react'
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
    <div className="flex flex-col gap-3 min-w-0">

      {/* Row 1: back button + request-no + type + badges (desktop) */}
      <div className="flex items-center gap-2 min-w-0">
        <Link href={backHref} className="shrink-0">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
          <span className="font-mono text-[11px] tracking-wider text-muted-foreground bg-muted/70 px-2 py-0.5 rounded whitespace-nowrap">
            {detail.requestNo}
          </span>
          <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 truncate max-w-[160px] sm:max-w-none">
            {detail.requestType.name}
          </span>
        </div>

        {/* Badges — right side on all screens */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <PriorityBadge priority={detail.priority} />
          <StatusBadge status={detail.status} />
        </div>
      </div>

      {/* Row 2: Title */}
      <h1 className="text-base sm:text-xl font-bold text-foreground leading-snug pl-10 break-words min-w-0">
        {detail.title}
      </h1>

      {/* Row 3: Meta — date / requester / due */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pl-10">
        <span className="flex items-center gap-1 whitespace-nowrap">
          <Calendar className="size-3 shrink-0" />
          {formatDate(detail.submittedAt ?? detail.createdAt)}
        </span>
        {detail.requester?.fullName ? (
          <span className="flex items-center gap-1 min-w-0">
            <User className="size-3 shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-none">{detail.requester.fullName}</span>
          </span>
        ) : null}
        {detail.dueAt ? (
          <span className="flex items-center gap-1 text-amber-600 font-medium whitespace-nowrap">
            <Clock className="size-3 shrink-0" />
            Due {formatDate(detail.dueAt)}
          </span>
        ) : null}
      </div>
    </div>
  )
}
