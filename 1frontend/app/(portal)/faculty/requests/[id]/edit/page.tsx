'use client'

import { use, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { RequestRevisionForm } from '@/features/request-revision/RequestRevisionForm'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function buildFormData(data: any) {
  return (
    data.formData ??
    data.domainData?.data ??
    data.itTicket ??
    data.ticket ??
    data.documentRequest ??
    data.appointmentRequest ??
    data.procurementRequest ??
    data.accessRequest ??
    data.eventRequest ??
    data.equipmentRequest ??
    data.roomReservationRequest ??
    data.internshipRequest ??
    {}
  )
}

export default function FacultyRequestEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [initialData, setInitialData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND}/faculty/requests/${id}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        })
        if (!res.ok) throw new Error('Failed to fetch request data')
        const data = await res.json()
        if (data.status !== 'REVISION_REQUESTED') {
          throw new Error('Only requests in revision status can be edited.')
        }
        setInitialData({ ...data, formData: buildFormData(data) })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load request')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!initialData) return null

  return <RequestRevisionForm requestId={id} request={initialData} portal="faculty" />
}
