'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { useOptionalT } from '@/lib/optional-t'

interface AddModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddRequestTypeModal({ isOpen, onClose, onSuccess }: AddModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const tt = useOptionalT()
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    category: '',
    description: '',
  })

  // İsmi yazarken "KEY" değerini otomatik oluştur (Örn: "IT Support" -> "IT_SUPPORT")
  const handleNameChange = (val: string) => {
    setFormData({
      ...formData,
      name: val,
      key: val.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

      const res = await fetch(`${backendUrl}/admin/request-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, isActive: true }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || tt('requestTypes.operationFailed', 'Operation failed'))
      }

      toast.success(tt('requestTypes.createSuccess', 'Request Type created successfully!'))
      setFormData({ name: '', key: '', category: '', description: '' }) // Formu sıfırla
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || tt('requestTypes.createFail', 'Failed to create request type.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5 text-primary" /> {tt('requestTypes.addNew', 'Add New Request Type')}
          </DialogTitle>
          <DialogDescription>{tt('requestTypes.addDescription', 'Define a new request category for the system.')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{tt('requestTypes.displayName', 'Display Name')}</Label>
            <Input required placeholder={tt('requestTypes.nameExample', 'e.g. IT Support Ticket')} value={formData.name} onChange={(e) => handleNameChange(e.target.value)} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">{tt('requestTypes.uniqueKeyAuto', 'Unique Key (Auto-Generated)')}</Label>
              <Input required value={formData.key} readOnly className="bg-muted/50 cursor-not-allowed font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label>{tt('common.category', 'Category')}</Label>
              <Input required placeholder={tt('requestTypes.categoryExample', 'e.g. IT, HR, Facilities')} value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{tt('common.description', 'Description')}</Label>
            <Textarea className="h-20" placeholder={tt('requestTypes.descriptionPlaceholder', 'Brief explanation of what this request type is used for...')} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>

          <DialogFooter className="border-t pt-6 mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>{tt('common.cancel', 'Cancel')}</Button>
            <Button type="submit" disabled={isLoading} className="min-w-[120px]">
              {isLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null} {tt('requestTypes.createType', 'Create Type')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
