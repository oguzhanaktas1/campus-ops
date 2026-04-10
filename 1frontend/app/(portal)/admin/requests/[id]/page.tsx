'use client'

import { useParams } from 'next/navigation'
import { RequestDetailPage } from '@/features/request-detail/RequestDetailPage'

export default function AdminRequestDetailRoute() {
  const params = useParams()
  return <RequestDetailPage portal="admin" requestId={params.id as string} />
}
