'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GraduationCap, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiLogin, resolvePortalPath, setAuth } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form stateleri
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = await apiLogin(email, password)

      setAuth(data.access_token, data.user)
      toast.success('Giriş başarılı, yönlendiriliyorsunuz...')

      router.push(resolvePortalPath(data.user))
    } catch (err: any) {
      const errorMessage = err.message || 'Bir hata oluştu'
      setError(errorMessage) // İstersen formun üstündeki kırmızı kutuda kalsın
      toast.error(errorMessage) // 🔥 TOAST MESAJI OLARAK DA FIRLAT 🔥
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sol Panel (Aynı kaldı) */}
      <div className="hidden lg:flex w-1/2 bg-sidebar flex-col justify-between p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <GraduationCap className="size-5 text-sidebar-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-sidebar-foreground">CampusOps</span>
        </Link>
        <div>
          <blockquote className="text-sidebar-foreground/90 text-lg font-medium leading-relaxed mb-6">
            "CampusOps transformed how we handle administrative workflows. What used to take days now takes hours."
          </blockquote>
          <div>
            <p className="text-sidebar-foreground font-semibold text-sm">Dr. Margaret Liu</p>
            <p className="text-sidebar-foreground/60 text-sm">Provost, Westfield University</p>
          </div>
        </div>
        <p className="text-sidebar-foreground/40 text-xs">Smart Campus Operations Platform</p>
      </div>

      {/* Sağ Panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Link href="/" className="lg:hidden flex items-center gap-2 mb-6">
              <div className="size-7 rounded bg-primary flex items-center justify-center">
                <GraduationCap className="size-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground">CampusOps</span>
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
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
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
