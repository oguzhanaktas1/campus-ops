'use client'

import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { getSavedTheme, saveTheme } from '@/lib/i18n'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = getSavedTheme()
    const isDark = saved === 'dark' ||
      (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
    // Cookie'ye de kaydet (ilk açılışta sistem tercihi okunur)
    saveTheme(isDark ? 'dark' : 'light')
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    saveTheme(next ? 'dark' : 'light')
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={toggle}
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}
