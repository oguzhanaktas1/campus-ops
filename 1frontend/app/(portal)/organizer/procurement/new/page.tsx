'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const CATEGORIES = [
  'Laboratory Equipment',
  'Office Supply',
  'Software / License',
  'Service Purchase',
  'Furniture',
  'Technical Equipment',
  'Other',
]

export default function OrganizerNewProcurementPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    itemName: '',
    itemCategory: 'Laboratory Equipment',
    quantity: '1',
    unitPriceEstimate: '',
    vendorPreference: '',
    justification: '',
    budgetCode: '',
    priority: 'MEDIUM',
  })

  const setValue = (key: string, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.itemName.trim()) {
      toast.error('Item name is required.')
      return
    }

    if (!form.justification.trim()) {
      toast.error('Justification is required.')
      return
    }

    const quantity = Number(form.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error('Quantity must be at least 1.')
      return
    }

    const unitPriceEstimate = form.unitPriceEstimate.trim()
      ? Number(form.unitPriceEstimate)
      : undefined

    if (
      unitPriceEstimate !== undefined &&
      (Number.isNaN(unitPriceEstimate) || unitPriceEstimate < 0)
    ) {
      toast.error('Unit price estimate must be a valid positive number.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`${BACKEND}/procurement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          itemName: form.itemName.trim(),
          itemCategory: form.itemCategory,
          quantity,
          unitPriceEstimate,
          vendorPreference: form.vendorPreference.trim() || undefined,
          justification: form.justification.trim(),
          budgetCode: form.budgetCode.trim() || undefined,
          priority: form.priority,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to submit request.')

      toast.success(`Procurement request ${data.requestNo} submitted.`)
      router.push(`/organizer/requests/${data.requestId}`)
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Link href="/organizer/procurement">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            New Procurement Request
          </h1>
          <p className="text-sm text-muted-foreground">
            Create a request for purchasing an item or service.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-card border border-border rounded-xl shadow-sm p-6 space-y-5"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>
              Item Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.itemName}
              onChange={(e) => setValue('itemName', e.target.value)}
              placeholder="e.g. 15 laptops for software lab"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <select
              value={form.itemCategory}
              onChange={(e) => setValue('itemCategory', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Priority <span className="text-destructive">*</span>
            </Label>
            <select
              value={form.priority}
              onChange={(e) => setValue('priority', e.target.value)}
              className="w-full bg-background border border-input rounded-md px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>
              Quantity <span className="text-destructive">*</span>
            </Label>
            <Input
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setValue('quantity', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Unit Price Estimate</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.unitPriceEstimate}
              onChange={(e) => setValue('unitPriceEstimate', e.target.value)}
              placeholder="e.g. 1200"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Vendor Preference</Label>
            <Input
              value={form.vendorPreference}
              onChange={(e) => setValue('vendorPreference', e.target.value)}
              placeholder="Preferred vendor or supplier"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Budget Code</Label>
            <Input
              value={form.budgetCode}
              onChange={(e) => setValue('budgetCode', e.target.value)}
              placeholder="Optional budget or cost center code"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            Justification <span className="text-destructive">*</span>
          </Label>
          <textarea
            rows={5}
            value={form.justification}
            onChange={(e) => setValue('justification', e.target.value)}
            placeholder="Explain why this purchase is needed, who will use it, and what outcome it supports."
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShoppingCart className="size-4" />
            )}
            Submit Request
          </Button>
          <Link href="/organizer/procurement">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
