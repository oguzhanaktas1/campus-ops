'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GraduationCap, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { AuthI18nProvider } from '@/components/auth/auth-i18n-provider'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useI18n } from '@/lib/i18n'

function ForgotPasswordPageInner() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        toast.error(t('forgot.sendFail'))
      }
    } catch {
      toast.error(t('forgot.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="size-10 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="size-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t('forgot.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('forgot.subtitle')}
          </p>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 p-6 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800 text-center">
            <CheckCircle2 className="size-8 text-emerald-600" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('forgot.sentTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('forgot.sentDescription')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('common.emailAddress')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('forgot.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin mr-2" />}
              {t('forgot.submit')}
            </Button>
          </form>
        )}

        <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-3.5" />
          {t('common.backToLogin')}
        </Link>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <AuthI18nProvider>
      <ForgotPasswordPageInner />
    </AuthI18nProvider>
  )
}
