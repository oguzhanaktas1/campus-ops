'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function StudentProfileRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/student/settings') }, [router])
  return null
}
