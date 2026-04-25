'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Clock, XCircle, RotateCcw } from 'lucide-react'

// 🔥 1. YENİ DURUMLAR EKLENDİ (failed ve warning)
export type StepStatus = 'completed' | 'active' | 'pending' | 'failed' | 'warning'

export interface Step {
  id: number | string
  label: string
  status: StepStatus
  key?: string | null
  stepKey?: string | null
  name?: string | null
  type?: string | null
  isCurrent?: boolean | null
  assignedRole?: string | null
  role?: string | null
  assignedUnit?: { id?: string | null; name?: string | null } | null
  unitName?: string | null
  assignedTo?: {
    id?: string | null
    fullName?: string | null
    email?: string | null
    role?: string | null
  } | null
  assignedToName?: string | null
  actionBy?: {
    id?: string | null
    fullName?: string | null
    email?: string | null
    role?: string | null
  } | null
  actionByName?: string | null
  actionTaken?: string | null
  actionNote?: string | null
  startedAt?: string | null
  completedAt?: string | null
  actedAt?: string | null
  dueAt?: string | null
  slaHours?: number | null
  isOverdue?: boolean | null
}

interface WorkflowStepIndicatorProps {
  steps: Step[]
  className?: string
}

export function WorkflowStepIndicator({ steps, className }: WorkflowStepIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-0', className)}>
      {steps.map((step, idx) => (
        <div key={step.id} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div
              className={cn(
                'size-8 rounded-full flex items-center justify-center border-2 transition-colors',
                step.status === 'completed' && 'bg-emerald-500 border-emerald-500 text-white',
                step.status === 'active' && 'bg-primary border-primary text-primary-foreground',
                step.status === 'pending' && 'bg-background border-border text-muted-foreground',
                step.status === 'failed' && 'bg-destructive border-destructive text-destructive-foreground', // Kırmızı (Red/İptal)
                step.status === 'warning' && 'bg-amber-500 border-amber-500 text-white' // Sarı (Revize)
              )}
            >
              {step.status === 'completed' ? (
                <CheckCircle2 className="size-4" />
              ) : step.status === 'active' ? (
                <Clock className="size-4" />
              ) : step.status === 'failed' ? (
                <XCircle className="size-4" />
              ) : step.status === 'warning' ? (
                <RotateCcw className="size-4" />
              ) : (
                <Circle className="size-4" />
              )}
            </div>
            <span
              className={cn(
                'text-xs font-medium text-center leading-tight max-w-[80px] mt-1',
                step.status === 'completed' && 'text-emerald-600 dark:text-emerald-400',
                step.status === 'active' && 'text-primary',
                step.status === 'pending' && 'text-muted-foreground',
                step.status === 'failed' && 'text-destructive',
                step.status === 'warning' && 'text-amber-600 dark:text-amber-500'
              )}
            >
              {step.label}
            </span>
          </div>
          {/* Çizgi: Sadece mevcut adım tamamlandıysa yeşil yap, yoksa gri/soluk kalsın */}
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'flex-1 h-0.5 mb-5 mx-1 transition-colors',
                step.status === 'completed' ? 'bg-emerald-400' : 'bg-border'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
