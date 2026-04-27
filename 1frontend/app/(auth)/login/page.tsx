'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CampusFlowLogo } from '@/components/campusflow-logo'
import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiLogin, resolvePortalPath, setAuth } from '@/lib/auth'
import { ThemeToggle } from '@/components/theme-toggle'

export default function LoginPage() {
  const router = useRouter()

  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [capsLock, setCapsLock] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await apiLogin(email, password)
      setAuth(data.access_token, data.user)
      toast.success('Login successful, redirecting...')
      router.push(resolvePortalPath(data.user))
    } catch (err: any) {
      const msg = err.message || 'An error occurred'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sol panel */}
      <div className="hidden lg:flex w-1/2 bg-sidebar flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <CampusFlowLogo containerClassName="size-9" priority />
          <span className="text-xl font-bold text-sidebar-foreground">CampusFlow</span>
        </Link>
        <div>
          <blockquote className="text-sidebar-foreground/90 text-lg font-medium leading-relaxed mb-6">
            "CampusFlow transformed how we handle administrative workflows. What used to take days now takes hours."
          </blockquote>
          <div>
            <p className="text-sidebar-foreground font-semibold text-sm">Dr. Margaret Liu</p>
            <p className="text-sidebar-foreground/60 text-sm">Provost, Westfield University</p>
          </div>
        </div>
        <p className="text-sidebar-foreground/40 text-xs">Smart Campus Operations Platform</p>
      </div>

      {/* Sağ panel */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Tema + Dil toggle — sağ üst köşe */}
        <div className="absolute top-4 right-4 flex items-center gap-1">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Link href="/" className="lg:hidden flex items-center gap-2 mb-6">
              <CampusFlowLogo containerClassName="size-7" priority />
              <span className="font-bold text-foreground">CampusFlow</span>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@campus.edu.tr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  required
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pr-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                  onBlur={() => setCapsLock(false)}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {capsLock && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Caps Lock is on
                </p>
              )}
            </div>

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
