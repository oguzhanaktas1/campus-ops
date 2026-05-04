'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'
import { AuthI18nProvider } from '@/components/auth/auth-i18n-provider'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useI18n } from '@/lib/i18n'

function UnauthorizedPageInner() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 text-center px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <ShieldAlert className="size-12 text-destructive" />
      <h1 className="text-2xl font-bold text-foreground">{t('unauthorized.title')}</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        {t('unauthorized.description')}
      </p>
      <Link href="/login">
        <Button>{t('unauthorized.returnToLogin')}</Button>
      </Link>
    </div>
  )
}

export default function UnauthorizedPage() {
  return (
    <AuthI18nProvider>
      <UnauthorizedPageInner />
    </AuthI18nProvider>
  )
}
