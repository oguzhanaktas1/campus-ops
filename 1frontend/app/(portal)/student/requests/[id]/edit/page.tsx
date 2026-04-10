'use client'

import { use, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { RequestRevisionForm } from '@/features/request-revision/RequestRevisionForm'

export default function EditRequestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [initialData, setInitialData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRequestData = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        const res = await fetch(`${backendUrl}/student/requests/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          throw new Error('Failed to fetch request data')
        }

        const data = await res.json()
        if (data.status !== 'REVISION_REQUESTED') {
          throw new Error('Only requests in revision can be edited.')
        }

        setInitialData(data)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to fetch request data',
        )
      } finally {
        setIsLoading(false)
      }
    }

    void fetchRequestData()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!initialData) return null

  return <RequestRevisionForm requestId={id} request={initialData} />
}
