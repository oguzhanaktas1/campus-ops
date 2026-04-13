'use client'

import { use } from 'react'
import { RequestDetailPage } from '@/features/request-detail/RequestDetailPage'

export default function OrganizerRequestDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <RequestDetailPage portal="organizer" requestId={id} />
}
