'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, Plus, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const STATUS_BADGE: Record<string, string> = {
  SUBMITTED:         'bg-blue-50 text-blue-700 border-blue-200',
  IN_REVIEW:         'bg-yellow-50 text-yellow-700 border-yellow-200',
  WAITING_APPROVAL:  'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED:          'bg-green-50 text-green-700 border-green-200',
  REJECTED:          'bg-red-50 text-red-700 border-red-200',
  COMPLETED:         'bg-gray-50 text-gray-500 border-gray-200',
  CLOSED:            'bg-gray-50 text-gray-500 border-gray-200',
}

function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function StudentEquipmentPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/equipment-requests/my`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (res.ok) setRequests(await res.json())
      } catch {
        toast.error('Failed to load equipment requests.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchRequests()
  }, [])

  if (isLoading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Package className="size-5 text-primary" /> Equipment Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Request campus equipment such as projectors, laptops and cameras.
          </p>
        </div>
        <Link href="/student/equipment/new">
          <Button size="sm" className="gap-2">
            <Plus className="size-4" /> New Request
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {requests.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center opacity-50">
            <AlertCircle className="size-10 mb-3" />
            <p className="text-sm font-medium">No equipment requests yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Submit a request to borrow campus equipment.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((r) => (
              <Link
                key={r.equipmentRequestId ?? r.id}
                href={`/student/equipment/${r.equipmentRequestId ?? r.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {r.equipmentName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.requestNo} · {r.equipmentCategory} · qty {r.quantity}
                    {r.neededFrom && ` · from ${new Date(r.neededFrom).toLocaleDateString()}`}
                    {r.createdAt && ` · ${timeAgo(r.createdAt)}`}
                  </p>
                </div>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full border ml-4 shrink-0',
                  STATUS_BADGE[r.status] ?? STATUS_BADGE.SUBMITTED
                )}>
                  {r.status?.replace(/_/g, ' ')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
