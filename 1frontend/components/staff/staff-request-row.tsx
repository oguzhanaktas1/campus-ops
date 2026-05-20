'use client'

import Link from 'next/link'
import { Clock, User, CheckCircle2, AlertTriangle } from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'

export function formatRel(ts: string | null | undefined) {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

interface StaffRequestRowProps {
  href: string
  title: string
  requestNo?: string | null
  badge?: string | null
  metaLeft?: (string | null | undefined)[]
  assignee?: string | null
  unassigned?: boolean
  status: string
  priority?: string | null
  isOverdue?: boolean
}

export function StaffRequestRow({
  href,
  title,
  requestNo,
  badge,
  metaLeft = [],
  assignee,
  unassigned,
  status,
  priority,
  isOverdue,
}: StaffRequestRowProps) {
  return (
    <Link href={href}>
      <div className={cn(
        'px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer',
        isOverdue && 'bg-destructive/5 hover:bg-destructive/10',
      )}>
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              {requestNo && (
                <span className="text-xs text-muted-foreground font-mono">{requestNo}</span>
              )}
              {badge && (
                <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded font-medium">
                  {badge}
                </span>
              )}
              {isOverdue && (
                <span className="text-[10px] border border-destructive/20 bg-destructive/10 px-1.5 py-0.5 rounded text-destructive font-bold uppercase tracking-wide">
                  Overdue
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
              {metaLeft.filter(Boolean).map((m, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i === 0 && <User className="size-3" />}
                  {i === 1 && <Clock className="size-3" />}
                  {m}
                </span>
              ))}
              {assignee ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="size-3" /> {assignee}
                </span>
              ) : unassigned ? (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <AlertTriangle className="size-3" /> Unassigned
                </span>
              ) : null}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <StatusBadge status={status} />
            {priority && <PriorityBadge priority={priority} />}
          </div>
        </div>
      </div>
    </Link>
  )
}
