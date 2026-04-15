'use client'

import { useLanguage } from '@/contexts/language-context'
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Languages, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  variant?: 'icon' | 'full'
  className?: string
}

export function LanguageSwitcher({ variant = 'icon', className }: LanguageSwitcherProps) {
  const { locale, switchLocale } = useLanguage()
  const current = LOCALE_LABELS[locale]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'icon' ? 'icon' : 'sm'}
          className={cn('size-8', variant === 'full' && 'w-auto px-2 gap-1.5', className)}
          aria-label="Change language"
        >
          <Languages className="size-4" />
          {variant === 'full' && (
            <span className="text-xs font-semibold uppercase">{locale}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {LOCALES.map((l: Locale) => {
          const info = LOCALE_LABELS[l]
          return (
            <DropdownMenuItem
              key={l}
              onClick={() => switchLocale(l)}
              className={cn('cursor-pointer gap-2', locale === l && 'font-semibold')}
            >
              <span className="text-base">{info.flag}</span>
              {info.label}
              {locale === l && <Check className="size-3.5 ml-auto text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
