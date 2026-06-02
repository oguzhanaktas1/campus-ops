'use client'

import { useRef, useEffect } from 'react'

export function TopScrollTable({ children }: { children: React.ReactNode }) {
  const topRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const phantomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const top = topRef.current
    const bottom = bottomRef.current
    const phantom = phantomRef.current
    if (!top || !bottom || !phantom) return

    const updateWidth = () => {
      phantom.style.width = `${bottom.scrollWidth}px`
    }
    updateWidth()

    const ro = new ResizeObserver(updateWidth)
    ro.observe(bottom)

    const syncFromTop = () => { bottom.scrollLeft = top.scrollLeft }
    const syncFromBottom = () => { top.scrollLeft = bottom.scrollLeft }

    top.addEventListener('scroll', syncFromTop, { passive: true })
    bottom.addEventListener('scroll', syncFromBottom, { passive: true })

    return () => {
      ro.disconnect()
      top.removeEventListener('scroll', syncFromTop)
      bottom.removeEventListener('scroll', syncFromBottom)
    }
  }, [])

  return (
    <div>
      <div
        ref={topRef}
        className="overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40"
      >
        <div ref={phantomRef} style={{ height: 1 }} />
      </div>
      <div ref={bottomRef} className="overflow-x-auto">
        {children}
      </div>
    </div>
  )
}
