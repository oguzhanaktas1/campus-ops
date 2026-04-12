'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, GitBranch, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  WORKFLOW_BACKEND as BACKEND,
  workflowAuthHeaders as authHeaders,
  type WorkflowDetail,
} from '@/lib/admin-workflow'

export default function AdminWorkflowDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchWorkflow = async () => {
      if (!id) {
        setWorkflow(null)
        setIsLoading(false)
        return
      }

      try {
        const res = await fetch(`${BACKEND}/admin/workflows/${id}`, {
          headers: authHeaders(),
        })

        if (res.ok) {
          setWorkflow((await res.json()) as WorkflowDetail)
        } else if (res.status === 404) {
          setWorkflow(null)
        } else {
          throw new Error('Failed to load workflow.')
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load workflow.')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchWorkflow()
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
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex flex-col items-center py-16 text-center">
          <AlertTriangle className="mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">Workflow not found</p>
          <Link href="/admin/workflows" className="mt-3">
            <Button variant="outline" size="sm">
              Back to workflows
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const steps = workflow.steps.slice().sort((a, b) => a.stepOrder - b.stepOrder)

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/workflows">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>
      </div>

      <div className="flex items-start gap-4 rounded-lg border border-border bg-card p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <GitBranch className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">{workflow.name}</h1>
          {workflow.description && (
            <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{steps.length} steps</span>
            <span className={workflow.isActive ? 'text-emerald-600' : 'text-muted-foreground'}>
              {workflow.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Workflow Steps</h2>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && <div className="mt-1 h-6 w-0.5 bg-border" />}
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-medium text-foreground">{step.stepName}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {step.assignedRole && (
                      <span className="rounded bg-muted px-1.5 py-0.5 capitalize">
                        {step.assignedRole.name.toLowerCase()}
                      </span>
                    )}
                    {step.stepType && (
                      <span className="rounded bg-muted px-1.5 py-0.5 capitalize">
                        {step.stepType.toLowerCase()}
                      </span>
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
