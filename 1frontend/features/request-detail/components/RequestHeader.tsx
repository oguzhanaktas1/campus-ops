import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PriorityBadge, StatusBadge } from '@/components/status-badge'
import { NT } from '@/components/no-translate'
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
          <Button variant="ghost" size="icon" className="size-8 shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <NT as="p" className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            {detail.requestNo}
          </NT>
          <NT as="h1" className="truncate text-2xl font-semibold text-foreground">
            {detail.title}
          </NT>
          <p className="mt-1 text-sm text-muted-foreground">
            {detail.requestType.name} - Created {formatDate(detail.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={detail.priority} />
        <StatusBadge status={detail.status} />
      </div>
    </div>
  )
}
