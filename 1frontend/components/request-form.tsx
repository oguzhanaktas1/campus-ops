'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Loader2, FileText, X, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  getRevisionFieldMode,
  type RevisionPolicy,
} from '@/lib/revision-policy'

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'date' | 'time' | 'number' | 'select' | 'faculty-select';
  required: boolean;
  options?: { label: string; value: string }[];
  gridCols?: 1 | 2;
}

export interface RequestTypeOption {
  key: string;
  name: string;
  category?: string; // 🔥 Backend'den gelen kategori (ACADEMIC, IT_SUPPORT vb.)
  formSchemaJson: FormField[] | null;
}

export interface FacultyOption {
  id: string;
  profile: { fullName: string; title: string | null; department: { name: string } | null; } | null;
}

interface RequestFormProps {
  initialData?: any; 
  isEditMode?: boolean;
  defaultType?: string; 
  revisionPolicy?: RevisionPolicy | null;
}

const IT_CATEGORIES = [
  'Hardware',
  'Software',
  'Network / Connectivity',
  'Account / Access',
  'Printer / Peripheral',
  'Email / Collaboration',
  'Security',
  'Other',
]

const EQUIPMENT_CATEGORIES = [
  'Laboratory Equipment',
  'Computer Hardware',
  'Audio/Visual Equipment',
  'Furniture',
  'Office Supplies',
  'Measurement Instruments',
  'Safety Equipment',
  'Other',
]

export function RequestForm({
  initialData,
  isEditMode = false,
  defaultType,
  revisionPolicy,
}: RequestFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [requestTypes, setRequestTypes] = useState<RequestTypeOption[]>([])
  const [faculties, setFaculties] = useState<FacultyOption[]>([])
  const [isLoadingTypes, setIsLoadingTypes] = useState(true)

  const [files, setFiles] = useState<File[]>([])
  const [existingFiles, setExistingFiles] = useState<any[]>([])
  const [filesToDelete, setFilesToDelete] = useState<string[]>([])

  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('')

  const [equipState, setEquipState] = useState({
    equipmentName: '',
    equipmentCategory: '',
    quantity: '1',
    purpose: '',
    neededFrom: '',
    neededUntil: '',
    urgencyReason: '',
  })

  const [itState, setItState] = useState({
    category: '',
    subcategory: '',
    affectedSystem: '',
    locationText: '',
  })

  const [formData, setFormData] = useState<Record<string, any>>({
    typeKey: defaultType || '',
    title: '',
    priority: 'MEDIUM',
    description: '',
  })

  useEffect(() => {
    if (isEditMode && initialData) {
      setFormData({
        typeKey: initialData.type || '',
        title: initialData.title || '',
        priority: initialData.priority || 'MEDIUM',
        description: initialData.description || '',
        ...(initialData.dynamicData || {})
      })
      
      if (initialData.assignedFacultyId) {
        setSelectedFacultyId(initialData.assignedFacultyId)
      } else if (initialData.assignments && initialData.assignments.length > 0) {
         setSelectedFacultyId(initialData.assignments[0].assignedTo?.id || '')
      }

      if (initialData.attachments && initialData.attachments.length > 0) {
        setExistingFiles(initialData.attachments)
      }

    } else if (defaultType && !isEditMode) {
      setFormData(prev => ({ ...prev, typeKey: defaultType }))
    }
  }, [initialData, isEditMode, defaultType])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('access_token')
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
        
        const [typesRes, facRes] = await Promise.all([
          fetch(`${backendUrl}/student/request-types`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${backendUrl}/student/faculty-members`, { headers: { Authorization: `Bearer ${token}` } })
        ])

        if (typesRes.ok) setRequestTypes(await typesRes.json())
        if (facRes.ok) setFaculties(await facRes.json())
      } catch (err) {
        console.error('API Hatası:', err)
      } finally {
        setIsLoadingTypes(false)
      }
    }
    fetchData()
  }, [])

  // 🔥 KATEGORİ BAZLI DİNAMİK YÖNLENDİRME MANTIĞI 🔥
  const selectedType = requestTypes.find(rt => rt.key === formData.typeKey)
  const dynamicFields = selectedType?.formSchemaJson || []

  // Dedicated type detections
  const isEquipmentType = selectedType?.key === 'EQUIPMENT' || selectedType?.category === 'EQUIPMENT'
  const isItTicketType = selectedType?.key === 'IT_SUPPORT' || selectedType?.category === 'IT_SUPPORT'

  // SADECE İdari Personele (Staff/IT) gidecek KESİN KATEGORİLER:
  const staffCategories = [
    'IT_SUPPORT',
    'INVENTORY',
    'ADMINISTRATIVE',
    'CAMPUS_SERVICES',
    'STUDENT_LIFE',
    'EQUIPMENT',
  ];

  // Kategori bu listedeyse Staff çözer. Değilse (Academic vs) Hoca şart.
  const isStaffRouted = selectedType ? staffCategories.includes(selectedType.category || '') || isEquipmentType || isItTicketType : false;
  const requiresFaculty = selectedType ? !isStaffRouted : false;

  const handleChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }))
  }

  const getFieldMode = (fieldId: string) =>
    isEditMode ? getRevisionFieldMode(revisionPolicy, fieldId) : 'editable'

  const isFieldLocked = (fieldId: string) => getFieldMode(fieldId) === 'locked'

  const handleTypeChange = (val: string) => {
    handleChange('typeKey', val);
    // Tür değiştiğinde, eğer yeni tür Staff'a gidecekse seçili hocayı temizle
    const newSelectedType = requestTypes.find(rt => rt.key === val);
    const newIsStaffRouted = newSelectedType ? staffCategories.includes(newSelectedType.category || '') : false;
    
    if (newIsStaffRouted) {
      setSelectedFacultyId('');
    }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files!)])
    }
  }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }
  
  const removeNewFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index))
  
  const removeExistingFile = (fileId: string) => {
    setExistingFiles(prev => prev.filter(f => f.id !== fileId))
    setFilesToDelete(prev => [...prev, fileId])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (!formData.typeKey) {
      setError('Please select a request type.')
      setIsLoading(false)
      return
    }

    // 🔥 Hoca zorunluysa kontrol et
    if (requiresFaculty && !selectedFacultyId) {
      setError('This academic request requires you to assign a faculty member.')
      setIsLoading(false)
      return
    }

    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

      // ── IT TICKET PATH ─────────────────────────────────────────────────────
      if (isItTicketType && !isEditMode) {
        if (!itState.category) {
          setError('Please select an IT category.')
          setIsLoading(false)
          return
        }
        const res = await fetch(`${backendUrl}/it-tickets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: formData.title?.trim() || `${itState.category} Issue`,
            description: formData.description?.trim() || undefined,
            priority: formData.priority || 'MEDIUM',
            category: itState.category,
            subcategory: itState.subcategory?.trim() || undefined,
            affectedSystem: itState.affectedSystem?.trim() || undefined,
            locationText: itState.locationText?.trim() || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { message?: string }
          throw new Error(err.message || 'Failed to submit IT ticket.')
        }
        toast.success('IT support ticket submitted successfully!')
        router.push('/student/requests')
        return
      }

      // ── EQUIPMENT REQUEST PATH ──────────────────────────────────────────────
      if (isEquipmentType && !isEditMode) {
        if (!equipState.equipmentName.trim()) {
          setError('Equipment name is required.')
          setIsLoading(false)
          return
        }
        if (!equipState.equipmentCategory) {
          setError('Equipment category is required.')
          setIsLoading(false)
          return
        }
        if (!equipState.purpose.trim()) {
          setError('Purpose is required.')
          setIsLoading(false)
          return
        }

        const res = await fetch(`${backendUrl}/equipment-requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            equipmentName: equipState.equipmentName.trim(),
            equipmentCategory: equipState.equipmentCategory,
            quantity: Math.max(1, parseInt(equipState.quantity) || 1),
            purpose: equipState.purpose.trim(),
            description: formData.description?.trim() || undefined,
            priority: formData.priority || 'MEDIUM',
            neededFrom: equipState.neededFrom || undefined,
            neededUntil: equipState.neededUntil || undefined,
            urgencyReason: equipState.urgencyReason?.trim() || undefined,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { message?: string }
          throw new Error(err.message || 'Failed to submit equipment request.')
        }
        toast.success('Equipment request submitted successfully!')
        router.push('/student/requests')
        return
      }

      // ── GENERIC REQUEST PATH ────────────────────────────────────────────────
      const submitData = new FormData()

      Object.entries(formData).forEach(([key, value]) => {
        if (isEditMode) {
          if (key === 'typeKey') return
          if (isFieldLocked(key)) return
        }
        submitData.append(key, String(value))
      })

      // Sadece Hoca ataması gereken durumlarda ID'yi gönderiyoruz
      if (!isEditMode && requiresFaculty && selectedFacultyId) {
        submitData.append('facultyUserId', selectedFacultyId)
      }

      if (filesToDelete.length > 0) {
        submitData.append('deletedFileIds', JSON.stringify(filesToDelete))
      }

      files.forEach((file) => submitData.append('attachments', file))

      const endpoint = isEditMode ? `${backendUrl}/student/requests/${initialData.id}` : `${backendUrl}/student/requests`
      const method = isEditMode ? 'PUT' : 'POST'

      const res = await fetch(endpoint, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: submitData
      })

      if (!res.ok) throw new Error((await res.json()).message || `Failed to ${isEditMode ? 'update' : 'submit'} request.`)

      toast.success(`Request ${isEditMode ? 'updated' : 'submitted'} successfully!`)
      router.push('/student/requests')
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm p-6">
      {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-md mb-5 font-medium">{error}</p>}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        
        <div className="space-y-1.5">
          <Label>Request Type <span className="text-destructive">*</span></Label>
          <Select value={formData.typeKey || ""} onValueChange={handleTypeChange} required disabled={isLoadingTypes || isEditMode}>
            <SelectTrigger className={isEditMode ? "bg-muted/50 cursor-not-allowed opacity-80" : ""}><SelectValue placeholder={isLoadingTypes ? "Loading..." : "Select request type..."} /></SelectTrigger>
            <SelectContent>
              {requestTypes.map((rt) => (
                <SelectItem key={rt.key} value={rt.key}>{rt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isEquipmentType && (
          <div className="space-y-1.5">
            <Label htmlFor="title">Request Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              placeholder="Brief title..."
              required={!isEquipmentType}
              value={formData.title}
              onChange={(e) => handleChange(e.target.id, e.target.value)}
              disabled={isEditMode}
              className={isEditMode ? "bg-muted/50 cursor-not-allowed opacity-80" : ""}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={formData.priority} onValueChange={(val) => handleChange('priority', val)} disabled={isEditMode}>
              <SelectTrigger className={isEditMode ? "bg-muted/50 cursor-not-allowed opacity-80" : ""}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 🔥 DİNAMİK ATAMA ALANI 🔥 */}
          {!formData.typeKey ? (
             <div className="space-y-1.5 opacity-50">
               <Label>Assignee</Label>
               <Input disabled value="Select request type first" className="bg-muted cursor-not-allowed text-muted-foreground" />
             </div>
          ) : isStaffRouted ? (
             <div className="space-y-1.5">
               <Label>Assignee</Label>
               <div className="flex items-center gap-2 h-10 w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed">
                  <Server className="size-4 shrink-0 text-primary/70" />
                  Routed to Staff / IT Queue
               </div>
             </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Assign to Faculty <span className="text-destructive">*</span></Label>
              <Select
                value={selectedFacultyId}
                onValueChange={setSelectedFacultyId}
                disabled={isLoadingTypes || isEditMode}
                required={requiresFaculty}
              >
                <SelectTrigger className={cn(!selectedFacultyId ? "text-muted-foreground" : "", isEditMode ? "bg-muted/50 cursor-not-allowed opacity-80" : "")}>
                  <SelectValue placeholder="Select a faculty member..." />
                </SelectTrigger>
                <SelectContent>
                  {faculties.map((fac) => (
                    <SelectItem key={fac.id} value={fac.id}>
                      {fac.profile?.title ? `${fac.profile.title} ` : ''}
                      {fac.profile?.fullName}
                      {fac.profile?.department?.name ? ` (${fac.profile.department.name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ── IT TICKET FIELDS ─────────────────────────────────────────────── */}
        {isItTicketType && !isEditMode && (
          <div className="grid grid-cols-2 gap-4 bg-amber-500/5 p-5 rounded-lg border border-amber-500/20">
            <div className="col-span-2 mb-1">
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">IT Ticket Details</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Help us route your request faster.</p>
            </div>

            <div className="space-y-1.5">
              <Label>IT Category <span className="text-destructive">*</span></Label>
              <Select
                value={itState.category}
                onValueChange={(v) => setItState(p => ({ ...p, category: v }))}
              >
                <SelectTrigger className="border-amber-500/20 bg-background">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {IT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="itSubcategory">Subcategory</Label>
              <Input
                id="itSubcategory"
                placeholder="e.g. VPN, Outlook, Printer driver..."
                value={itState.subcategory}
                onChange={(e) => setItState(p => ({ ...p, subcategory: e.target.value }))}
                className="border-amber-500/20 focus-visible:ring-amber-500/40 bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="affectedSystem">Affected System / App</Label>
              <Input
                id="affectedSystem"
                placeholder="e.g. Campus WiFi, Banner, Lab PC-12..."
                value={itState.affectedSystem}
                onChange={(e) => setItState(p => ({ ...p, affectedSystem: e.target.value }))}
                className="border-amber-500/20 focus-visible:ring-amber-500/40 bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="locationText">Location</Label>
              <Input
                id="locationText"
                placeholder="e.g. Building A, Room 301..."
                value={itState.locationText}
                onChange={(e) => setItState(p => ({ ...p, locationText: e.target.value }))}
                className="border-amber-500/20 focus-visible:ring-amber-500/40 bg-background"
              />
            </div>
          </div>
        )}

        {/* ── EQUIPMENT FIELDS ─────────────────────────────────────────────── */}
        {isEquipmentType && !isEditMode && (
          <div className="grid grid-cols-2 gap-4 bg-blue-500/5 p-5 rounded-lg border border-blue-500/20">
            <div className="col-span-2 mb-1">
              <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">Equipment Details</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Specify what equipment you need and why.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="equipmentName">Equipment Name <span className="text-destructive">*</span></Label>
              <Input
                id="equipmentName"
                placeholder="e.g. Oscilloscope, Projector..."
                value={equipState.equipmentName}
                onChange={(e) => setEquipState(p => ({ ...p, equipmentName: e.target.value }))}
                className="border-blue-500/20 focus-visible:ring-blue-500/40 bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select
                value={equipState.equipmentCategory}
                onValueChange={(v) => setEquipState(p => ({ ...p, equipmentCategory: v }))}
              >
                <SelectTrigger className="border-blue-500/20 bg-background">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity <span className="text-destructive">*</span></Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={equipState.quantity}
                onChange={(e) => setEquipState(p => ({ ...p, quantity: e.target.value }))}
                className="border-blue-500/20 focus-visible:ring-blue-500/40 bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="purpose">Purpose / Usage <span className="text-destructive">*</span></Label>
              <Input
                id="purpose"
                placeholder="Describe how it will be used..."
                value={equipState.purpose}
                onChange={(e) => setEquipState(p => ({ ...p, purpose: e.target.value }))}
                className="border-blue-500/20 focus-visible:ring-blue-500/40 bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="neededFrom">Needed From</Label>
              <Input
                id="neededFrom"
                type="date"
                value={equipState.neededFrom}
                onChange={(e) => setEquipState(p => ({ ...p, neededFrom: e.target.value }))}
                className="border-blue-500/20 focus-visible:ring-blue-500/40 bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="neededUntil">Needed Until</Label>
              <Input
                id="neededUntil"
                type="date"
                value={equipState.neededUntil}
                onChange={(e) => setEquipState(p => ({ ...p, neededUntil: e.target.value }))}
                className="border-blue-500/20 focus-visible:ring-blue-500/40 bg-background"
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="urgencyReason">Urgency Reason (if urgent)</Label>
              <Input
                id="urgencyReason"
                placeholder="Why is this request urgent? (optional)"
                value={equipState.urgencyReason}
                onChange={(e) => setEquipState(p => ({ ...p, urgencyReason: e.target.value }))}
                className="border-blue-500/20 focus-visible:ring-blue-500/40 bg-background"
              />
            </div>
          </div>
        )}

        {/* DİNAMİK ALANLAR */}
        {dynamicFields.length > 0 && (
          <div className="grid grid-cols-2 gap-4 bg-primary/5 p-5 rounded-lg border border-primary/20">
            <div className="col-span-2 mb-1 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-primary">Form Details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isEditMode ? "Update the requested information below based on faculty feedback." : "Please fill out the required information for this request type."}
                </p>
              </div>
            </div>
            
            {dynamicFields.map((field: FormField) => (
              <div key={field.id} className={field.gridCols === 1 ? "col-span-1" : "col-span-2"}>
                <Label htmlFor={field.id} className="mb-1.5 block">
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </Label>
                
                {['text', 'date', 'time', 'number'].includes(field.type) && (
              <Input 
                    id={field.id} 
                    type={field.type} 
                    required={field.required} 
                    value={formData[field.id] || ''} 
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    disabled={isFieldLocked(field.id)}
                    className={cn(
                      "border-primary/20 focus-visible:ring-primary/50 bg-background",
                      isFieldLocked(field.id) && "bg-muted/50 cursor-not-allowed opacity-80"
                    )} 
                  />
                )}

                {field.type === 'select' && field.options && (
                  <Select
                    value={formData[field.id] || ""}
                    onValueChange={(val) => handleChange(field.id, val)}
                    required={field.required}
                    disabled={isFieldLocked(field.id)}
                  >
                    <SelectTrigger className={cn(
                      "border-primary/20 focus:ring-primary/50 bg-background",
                      isFieldLocked(field.id) && "bg-muted/50 cursor-not-allowed opacity-80"
                    )}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {field.options.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}

              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="description">Additional Notes / Description <span className="text-destructive">*</span></Label>
          </div>
          <Textarea 
            id="description" 
            placeholder="Provide details about your request..." 
            className={cn(
              "min-h-[120px] resize-none",
              isEditMode ? "border-primary/20 focus-visible:ring-primary/50 bg-primary/5" : "",
              isFieldLocked('description') && "bg-muted/50 cursor-not-allowed opacity-80"
            )} 
            required 
            value={formData.description} 
            onChange={(e) => handleChange(e.target.id, e.target.value)}
            disabled={isFieldLocked('description')}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Attachments (optional)</Label>
          </div>

          {existingFiles.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Currently Uploaded:</p>
              {existingFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2.5 bg-muted/40 border border-border rounded-md">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="text-sm text-foreground truncate max-w-[200px] sm:max-w-xs">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{file.size}</span>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); removeExistingFile(file.id); }}><X className="size-4" /></Button>
                </div>
              ))}
            </div>
          )}

          <input type="file" multiple hidden ref={fileInputRef} onChange={handleFileSelect} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
          <div 
            onClick={() => fileInputRef.current?.click()} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            className={cn("border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 text-center cursor-pointer transition-colors", isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50", isEditMode && "bg-primary/5 border-primary/20")}
          >
            <Upload className={cn("size-6", isDragging ? "text-primary" : "text-muted-foreground")} />
            <p className="text-sm text-muted-foreground">Drop files here or <span className="text-primary font-medium">browse</span></p>
            <p className="text-xs text-muted-foreground">PDF, DOC, JPG up to 10MB</p>
          </div>
          
           {files.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Files to Upload:</p>
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <FileText className="size-4 shrink-0 text-emerald-600" />
                    <span className="text-sm text-foreground truncate max-w-[200px] sm:max-w-xs">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); removeNewFile(index); }}><X className="size-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-border">
          <Button type="submit" className="flex-1 sm:flex-none" disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 animate-spin mr-2" />} 
            {isEditMode ? 'Save & Resubmit' : 'Submit Request'}
          </Button>
          <Link href="/student/requests">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
