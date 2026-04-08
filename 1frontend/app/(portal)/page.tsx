'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function PortalRootPage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      router.replace('/login')
      return
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const role: string = payload?.role || payload?.roles?.[0] || ''
      if (role === 'ADMIN') router.replace('/admin/dashboard')
      else if (role === 'FACULTY') router.replace('/faculty/dashboard')
      else if (role === 'STAFF') router.replace('/staff/dashboard')
      else router.replace('/student/dashboard')
    } catch {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )
}
