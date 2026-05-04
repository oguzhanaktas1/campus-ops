'use client'

import { useI18n, type Locale } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n()

  return (
    <div className={cn('flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5', className)}>
      {(['tr', 'en'] as Locale[]).map((lang) => (
        <Button
          key={lang}
          variant="ghost"
          size="sm"
          onClick={() => setLocale(lang)}
          className={cn(
            'h-6 px-2 text-xs font-semibold uppercase tracking-wider transition-all rounded-sm',
            locale === lang
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {lang}
        </Button>
      ))}
    </div>
  )
}
