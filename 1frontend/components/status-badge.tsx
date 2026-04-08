'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

// Veritabanındaki Enum'ların küçük harfli hallerini kapsayacak şekilde genişletildi
const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' },
  submitted: { label: 'Submitted', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800' },
  in_review: { label: 'In Review', className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800' },
  under_review: { label: 'Under Review', className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800' },
  waiting_approval: { label: 'Waiting Approval', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800' },
  in_progress: { label: 'In Progress', className: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800' },
  completed: { label: 'Completed', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' },
  revision_requested: { label: 'Revision Needed', className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-border' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground border-border' },
  expired: { label: 'Expired', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800' },
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-muted text-muted-foreground border-border' },
  medium: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' },
  high: { label: 'High', className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800' },
  urgent: { label: 'Urgent', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  // Veritabanından gelen BÜYÜK HARFLİ değeri güvenlice küçük harfe çeviriyoruz
  const safeStatus = status?.toLowerCase() || 'pending'
  const config = statusConfig[safeStatus]

  // Eğer veritabanına yeni bir statü eklersek ve buraya yazmayı unutursak, uygulamanın çökmesini engeller
  if (!config) {
    return (
      <Badge variant="outline" className={cn('text-xs font-medium', className)}>
        {status || 'Unknown'}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  )
}

interface PriorityBadgeProps {
  priority: string
  className?: string
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  // Veritabanından gelen BÜYÜK HARFLİ değeri güvenlice küçük harfe çeviriyoruz
  const safePriority = priority?.toLowerCase() || 'medium'
  const config = priorityConfig[safePriority]

  if (!config) return null

  return (
    <Badge
      variant="outline"
      className={cn('text-xs font-medium', config.className, className)}
    >
      {config.label}
    </Badge>
  )
}