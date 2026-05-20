'use client'

import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

export interface StaffListTab {
  key: string
  label: string
  count: number
  danger?: boolean
}

const PRIORITIES = ['CRITICAL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'text-red-600',
  URGENT:   'text-red-500',
  HIGH:     'text-orange-500',
  MEDIUM:   'text-amber-500',
  LOW:      'text-slate-500',
}

interface StaffListShellProps {
  title: string
  subtitle?: string
  actionButton?: React.ReactNode

  tabs: StaffListTab[]
  activeTab: string
  onTabChange: (key: string) => void

  search: string
  onSearchChange: (v: string) => void
  searchPlaceholder?: string

  /** Status filter — pass the set of statuses that make sense for this page */
  statusOptions?: string[]
  activeStatus?: string
  onStatusChange?: (s: string) => void

  /** Priority filter — always CRITICAL / URGENT / HIGH / MEDIUM / LOW */
  activePriority?: string
  onPriorityChange?: (p: string) => void

  isLoading: boolean
  totalCount: number
  page: number
  pageSize?: number
  onPageChange: (p: number) => void

  emptyIcon?: React.ReactNode
  emptyTitle: string
  emptyDesc?: string
  children: React.ReactNode
}

const PAGE_SIZE = 20

export function StaffListShell({
  title,
  subtitle,
  actionButton,
  tabs,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  statusOptions,
  activeStatus = '',
  onStatusChange,
  activePriority = '',
  onPriorityChange,
  isLoading,
  totalCount,
  page,
  pageSize = PAGE_SIZE,
  onPageChange,
  emptyIcon,
  emptyTitle,
  emptyDesc,
  children,
}: StaffListShellProps) {
  const totalPages = Math.ceil(totalCount / pageSize)
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to   = Math.min(page * pageSize, totalCount)

  const pageNumbers = getPageNumbers(page, totalPages)

  const hasActiveFilters = !!activeStatus || !!activePriority
  const showStatusFilter   = statusOptions && statusOptions.length > 0 && !!onStatusChange
  const showPriorityFilter = !!onPriorityChange

  const resetFilters = () => {
    onStatusChange?.('')
    onPriorityChange?.('')
    onPageChange(1)
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {actionButton}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { onTabChange(tab.key); onPageChange(1) }}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeTab === tab.key
                ? tab.danger
                  ? 'border-destructive text-destructive'
                  : 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                'ml-1.5 text-xs rounded-full px-1.5 py-0.5 font-medium',
                activeTab === tab.key
                  ? tab.danger
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Search + Filters ──────────────────────────────────── */}
      <div className="space-y-2">
        {/* Search row */}
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              className="pl-9"
              value={search}
              onChange={(e) => { onSearchChange(e.target.value); onPageChange(1) }}
            />
          </div>
          {showStatusFilter && (
            <select
              value={activeStatus}
              onChange={(e) => { onStatusChange!(e.target.value); onPageChange(1) }}
              className={cn(
                'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer shrink-0',
                'min-w-[130px] max-w-[160px]',
                activeStatus ? 'border-primary text-primary font-medium' : 'text-muted-foreground',
              )}
            >
              <option value="">Status: All</option>
              {statusOptions!.map((s) => (
                <option key={s} value={s}>{formatStatusLabel(s)}</option>
              ))}
            </select>
          )}
          {showPriorityFilter && (
            <select
              value={activePriority}
              onChange={(e) => { onPriorityChange!(e.target.value); onPageChange(1) }}
              className={cn(
                'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer shrink-0',
                'min-w-[130px] max-w-[160px]',
                activePriority
                  ? `border-primary font-medium ${PRIORITY_COLORS[activePriority] ?? 'text-primary'}`
                  : 'text-muted-foreground',
              )}
            >
              <option value="">Priority: All</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>

        {/* Active filter badges */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <SlidersHorizontal className="size-3" /> Active filters:
            </span>
            {activeStatus && (
              <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium border border-primary/20">
                {formatStatusLabel(activeStatus)}
                <button onClick={() => { onStatusChange?.(''); onPageChange(1) }} className="hover:opacity-70">
                  <X className="size-3" />
                </button>
              </span>
            )}
            {activePriority && (
              <span className={cn(
                'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border',
                'bg-orange-50 border-orange-200',
                PRIORITY_COLORS[activePriority],
              )}>
                {activePriority}
                <button onClick={() => { onPriorityChange?.(''); onPageChange(1) }} className="hover:opacity-70">
                  <X className="size-3" />
                </button>
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── List card ─────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {emptyIcon && <div className="mb-3 text-muted-foreground/40">{emptyIcon}</div>}
            <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
            {emptyDesc && <p className="text-xs text-muted-foreground mt-1">{emptyDesc}</p>}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">{children}</div>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-muted-foreground">
            {from}–{to} / {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8"
              disabled={page === 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            {pageNumbers.map((p, i) =>
              p === '…' ? (
                <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground select-none">…</span>
              ) : (
                <Button key={p} variant={page === p ? 'default' : 'outline'}
                  size="icon" className="size-8 text-xs"
                  onClick={() => onPageChange(p as number)}>
                  {p}
                </Button>
              )
            )}
            <Button variant="outline" size="icon" className="size-8"
              disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function formatStatusLabel(s: string) {
  return s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}
