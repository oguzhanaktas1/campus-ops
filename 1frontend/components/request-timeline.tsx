'use client'

import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  PlusCircle,
  RotateCcw,
  XCircle,
  FileEdit
} from 'lucide-react'

// 🔥 1. BACKEND'DEN GELEN GERÇEK VERİ TİPİ
export interface TimelineEvent {
  id: string
  status: string
  date: string
  note?: string
}

// 🔥 2. DURUMLARA GÖRE İKON, RENK VE BAŞLIK BELİRLEYEN FONKSİYON
const getEventDetails = (status: string) => {
  const s = status.toUpperCase()
  
  switch (s) {
    case 'SUBMITTED':
      return { 
        icon: <PlusCircle className="size-3.5" />, 
        color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400', 
        label: 'Request Submitted' 
      }
    case 'IN_REVIEW':
      return { 
        icon: <Clock className="size-3.5" />, 
        color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400', 
        label: 'Under Review' 
      }
    case 'WAITING_APPROVAL':
      return { 
        icon: <Clock className="size-3.5" />, 
        color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400', 
        label: 'Waiting for Approval' 
      }
    case 'APPROVED':
      return { 
        icon: <CheckCircle2 className="size-3.5" />, 
        color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400', 
        label: 'Approved' 
      }
    case 'REJECTED':
      return { 
        icon: <XCircle className="size-3.5" />, 
        color: 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400', 
        label: 'Rejected' 
      }
    case 'REVISION_REQUESTED':
      return { 
        icon: <RotateCcw className="size-3.5" />, 
        color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400', 
        label: 'Revision Requested' 
      }
    case 'CANCELLED':
    case 'EXPIRED':
      return { 
        icon: <AlertCircle className="size-3.5" />, 
        color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400', 
        label: s.charAt(0) + s.slice(1).toLowerCase() 
      }
    case 'COMPLETED':
    case 'CLOSED':
      return { 
        icon: <CheckCircle2 className="size-3.5" />, 
        color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400', 
        label: s.charAt(0) + s.slice(1).toLowerCase() 
      }
    default:
      return { 
        icon: <Circle className="size-3.5" />, 
        color: 'bg-muted text-muted-foreground', 
        label: s.replace(/_/g, ' ') 
      }
  }
}

function formatTimestamp(ts: string) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface RequestTimelineProps {
  events: TimelineEvent[]
  className?: string
}

export function RequestTimeline({ events, className }: RequestTimelineProps) {
  if (!events || events.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No timeline history available.</p>
  }

  return (
    <div className={cn('space-y-0', className)}>
      {events.map((event, idx) => {
        const details = getEventDetails(event.status)
        
        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn('size-7 rounded-full flex items-center justify-center flex-shrink-0', details.color)}>
                {details.icon}
              </div>
              {idx < events.length - 1 && (
                <div className="w-px flex-1 bg-border my-1" />
              )}
            </div>
            <div className={cn('pb-4', idx === events.length - 1 && 'pb-0')}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground capitalize">{details.label}</span>
                <span className="text-xs font-medium text-muted-foreground">{formatTimestamp(event.date)}</span>
              </div>
              {event.note && (
                <div className="mt-1.5 p-2.5 rounded-md bg-muted/40 border border-border text-sm text-muted-foreground leading-relaxed">
                  {event.note}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}