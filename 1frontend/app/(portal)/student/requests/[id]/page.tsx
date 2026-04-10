'use client'

import { use } from 'react'
import { RequestDetailPage } from '@/features/request-detail/RequestDetailPage'

export default function StudentRequestDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <RequestDetailPage portal="student" requestId={id} />
}
