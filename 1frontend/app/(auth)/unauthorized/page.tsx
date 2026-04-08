'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 text-center px-4">
      <ShieldAlert className="size-12 text-destructive" />
      <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        You do not have permission to view this page. Please contact your administrator if you believe this is a mistake.
      </p>
      <Link href="/login">
        <Button>Return to Login</Button>
      </Link>
    </div>
  )
}
