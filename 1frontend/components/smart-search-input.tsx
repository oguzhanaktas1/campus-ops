'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SmartSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
  isLoading?: boolean
  resultCount?: number
  className?: string
}

export function SmartSearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 0,
  isLoading = false,
  resultCount,
  className,
}: SmartSearchInputProps) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => { setLocal(value) }, [value])

  const emit = (v: string) => {
    if (debounceMs > 0) {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => onChange(v), debounceMs)
    } else {
      onChange(v)
    }
  }

  const clear = () => {
    clearTimeout(timer.current)
    setLocal('')
    onChange('')
  }

  return (
    <div className={cn('relative', className)}>
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
        {isLoading
          ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
          : <Search className="size-4 text-muted-foreground" />}
      </div>
      <Input
        value={local}
        onChange={(e) => { setLocal(e.target.value); emit(e.target.value) }}
        onKeyDown={(e) => e.key === 'Escape' && clear()}
        placeholder={placeholder}
        className={cn('pl-9', local && 'pr-16')}
      />
      {local && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {resultCount !== undefined && (
            <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded tabular-nums">
              {resultCount}
            </span>
          )}
          <button
            onClick={clear}
            className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Clear"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
