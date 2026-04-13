'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { getStoredUser, resolvePortalPath } from '@/lib/auth'

export default function PortalRootPage() {
  const router = useRouter()

  useEffect(() => {
    const user = getStoredUser()
    if (!user) {
      router.replace('/login')
      return
    }
    router.replace(resolvePortalPath(user))
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )
}
