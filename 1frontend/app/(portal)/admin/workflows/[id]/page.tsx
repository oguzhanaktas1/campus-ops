'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, AlertTriangle, GitBranch, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminWorkflowDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [workflow, setWorkflow] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchWorkflow = async () => {
      const token = localStorage.getItem('access_token')
      if (!token || !id) return

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      try {
        const res = await fetch(`${backendUrl}/admin/workflows/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          setWorkflow(await res.json())
        } else if (res.status === 404) {
          setWorkflow(null)
        }
      } catch {
        toast.error('Failed to load workflow.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchWorkflow()
  }, [id])

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex flex-col items-center py-16 text-center">
          <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">Workflow not found</p>
          <Link href="/admin/workflows" className="mt-3">
            <Button variant="outline" size="sm">Back to workflows</Button>
          </Link>
        </div>
      </div>
    )
  }

  const steps = workflow.steps || []

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/admin/workflows">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-5 flex items-start gap-4">
        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <GitBranch className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">{workflow.name}</h1>
          {workflow.description && (
            <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{steps.length} steps</span>
            {workflow.isActive !== undefined && (
              <span className={workflow.isActive ? 'text-emerald-600' : 'text-muted-foreground'}>
                {workflow.isActive ? '● Active' : '○ Inactive'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Workflow Steps</h2>
          <div className="space-y-3">
            {steps
              .sort((a: any, b: any) => a.stepOrder - b.stepOrder)
              .map((step: any, i: number) => (
                <div key={step.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="size-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </div>
                    {i < steps.length - 1 && <div className="w-0.5 h-6 bg-border mt-1" />}
                  </div>
                  <div className="pt-0.5 flex-1">
                    <p className="text-sm font-medium text-foreground">{step.stepName}</p>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                      {step.assignedRole && (
                        <span className="bg-muted px-1.5 py-0.5 rounded capitalize">{step.assignedRole.name.toLowerCase()}</span>
                      )}
                      {step.stepType && (
                        <span className="bg-muted px-1.5 py-0.5 rounded capitalize">{step.stepType.toLowerCase()}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
