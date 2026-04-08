'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  trend?: number
  trendLabel?: string
  icon?: React.ReactNode
  className?: string
  valueClassName?: string
}

export function MetricCard({
  title,
  value,
  description,
  trend,
  trendLabel,
  icon,
  className,
  valueClassName,
}: MetricCardProps) {
  const isPositive = trend !== undefined && trend > 0
  const isNegative = trend !== undefined && trend < 0
  const isNeutral = trend === undefined || trend === 0

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-5 shadow-sm flex flex-col gap-3',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && (
          <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className={cn('text-2xl font-bold text-foreground tracking-tight', valueClassName)}>
          {value}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1.5">
          {isPositive && <TrendingUp className="size-3.5 text-emerald-500" />}
          {isNegative && <TrendingDown className="size-3.5 text-destructive" />}
          {isNeutral && <Minus className="size-3.5 text-muted-foreground" />}
          <span
            className={cn(
              'text-xs font-medium',
              isPositive && 'text-emerald-600 dark:text-emerald-400',
              isNegative && 'text-destructive',
              isNeutral && 'text-muted-foreground'
            )}
          >
            {trend > 0 ? `+${trend}%` : `${trend}%`}
          </span>
          {trendLabel && (
            <span className="text-xs text-muted-foreground">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
