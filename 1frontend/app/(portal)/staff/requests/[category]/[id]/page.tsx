'use client'

import { useParams } from 'next/navigation'
import { RequestDetailPage } from '@/features/request-detail/RequestDetailPage'

export default function StaffRequestAliasDetailRoute() {
  const params = useParams()
  return <RequestDetailPage portal="staff" requestId={params.id as string} />
}
