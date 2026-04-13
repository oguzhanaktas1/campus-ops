'use client'

import Link from 'next/link'
import { ClipboardList, PartyPopper, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OrganizerDashboardPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">Organizer Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your event plans and published events.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/organizer/plans" className="bg-card border border-border rounded-xl p-5 hover:bg-muted/30 transition-colors flex items-start gap-4">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Event Plans</p>
            <p className="text-xs text-muted-foreground mt-0.5">Create and manage your event preparation plans.</p>
          </div>
        </Link>

        <Link href="/organizer/events" className="bg-card border border-border rounded-xl p-5 hover:bg-muted/30 transition-colors flex items-start gap-4">
          <div className="p-2 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <PartyPopper className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Published Events</p>
            <p className="text-xs text-muted-foreground mt-0.5">View and manage your published campus events.</p>
          </div>
        </Link>
      </div>

      <div className="flex justify-start">
        <Link href="/organizer/plans/new">
          <Button className="gap-2"><Plus className="size-4" /> New Event Plan</Button>
        </Link>
      </div>
    </div>
  )
}
