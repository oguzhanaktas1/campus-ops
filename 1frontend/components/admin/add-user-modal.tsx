'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, UserCircle, Briefcase, MapPin } from 'lucide-react'
import { toast } from 'sonner'

interface Role {
  id: string
  name: string
}

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userToEdit?: any
}

export function AddUserModal({ isOpen, onClose, onSuccess, userToEdit }: AddUserModalProps) {
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingRoles, setIsFetchingRoles] = useState(false)
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phoneNumber: '',
    status: 'ACTIVE',
    firstName: '',
    lastName: '',
    gender: 'MALE',
    birthDate: '',
    studentNumber: '',
    staffNumber: '',
    title: '',
    departmentId: '', 
    address: '',
    bio: '', 
    roleId: '',
    roleName: ''
  })

  const fetchRoles = async (): Promise<Role[]> => {
    try {
      setIsFetchingRoles(true)
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/admin/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setRoles(data)
        return data
      }
      return []
    } catch (err) {
      console.error('Roles fetch failed', err)
      return []
    } finally {
      setIsFetchingRoles(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchRoles().then((fetchedRoles) => {
        if (userToEdit) {
          const nameParts = userToEdit.name ? userToEdit.name.split(' ') : ['']
          const matchedRole = fetchedRoles.find(r => r.name.toLowerCase() === userToEdit.role?.toLowerCase())
          
          setFormData({
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            email: userToEdit.email || '',
            password: '', 
            phoneNumber: userToEdit.phoneNumber || '',
            status: userToEdit.status ? userToEdit.status.toUpperCase() : 'ACTIVE',
            gender: userToEdit.gender ? userToEdit.gender.toUpperCase() : 'MALE',
            birthDate: userToEdit.birthDate ? new Date(userToEdit.birthDate).toISOString().split('T')[0] : '',
            studentNumber: userToEdit.studentNumber || '',
            staffNumber: userToEdit.staffNumber || '',
            title: userToEdit.title || '',
            departmentId: userToEdit.department || userToEdit.departmentId || '', 
            address: userToEdit.address || '',
            bio: userToEdit.bio || '', 
            roleId: matchedRole?.id || '',
            roleName: matchedRole?.name.toUpperCase() || ''
          })
        } else {
          setFormData({
            email: '', password: '', phoneNumber: '', status: 'ACTIVE',
            firstName: '', lastName: '', gender: 'MALE', birthDate: '',
            studentNumber: '', staffNumber: '', title: '', departmentId: '',
            address: '', bio: '', roleId: '', roleName: ''
          })
        }
      })
    }
  }, [isOpen, userToEdit])

  const handleRoleChange = (roleId: string) => {
    const role = roles.find(r => r.id === roleId)
    const newRoleName = role?.name.toUpperCase() || ''
    
    setFormData(prev => {
      // Yeni kopyayı oluşturuyoruz
      const updated = { ...prev, roleId, roleName: newRoleName }

      // Rol STUDENT değilse öğrenci numarasını sıfırla
      if (newRoleName !== 'STUDENT') updated.studentNumber = ''

      // Rol FACULTY veya STAFF değilse staff no ve unvanı sıfırla
      if (!['FACULTY', 'STAFF'].includes(newRoleName)) {
        updated.staffNumber = ''
        updated.title = ''
      }

      // Rol ADMIN ise departman ve bio'yu sıfırla (Adminlerin bu bilgilere ihtiyacı yok)
      if (newRoleName === 'ADMIN') {
        updated.departmentId = ''
        updated.bio = ''
      }

      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const method = userToEdit ? 'PUT' : 'POST'
      const url = userToEdit 
        ? `${backendUrl}/admin/users/${userToEdit.id}` 
        : `${backendUrl}/admin/users`

      const payload = { 
        ...formData, 
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        department: formData.departmentId 
      }
      
      // Şifre boşsa payload'dan çıkart ki güncellenmesin
      if (userToEdit && !payload.password) {
        delete (payload as any).password
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Action failed')
      }

      toast.success(userToEdit ? 'User successfully updated' : 'User successfully created')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Operation failed. Check inputs.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {userToEdit ? 'Edit System User' : 'Create New User Account'}
          </DialogTitle>
          <DialogDescription>Fill all profile and credential details according to the system schema.</DialogDescription>
        </DialogHeader>

        {isFetchingRoles ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading system roles...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            
            {/* Section 1: Credentials & Primary Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                <UserCircle className="size-4" /> Account Credentials
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>{userToEdit ? 'New Password (Optional)' : 'Initial Password'}</Label>
                  <Input type="text" required={!userToEdit} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Section 2: Role & Institutional Info */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-amber-600">
                <Briefcase className="size-4" /> Role & Identity
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>System Role</Label>
                  <Select value={formData.roleId} onValueChange={handleRoleChange} disabled={roles.length === 0}>
                    <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
                    <SelectContent>
                      {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account Status</Label>
                  <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 🔥 DİNAMİK ALANLAR: ADMIN DEĞİLSE DEPARTMAN ÇIKAR 🔥 */}
                {formData.roleName !== 'ADMIN' && formData.roleName !== '' && (
                  <div className="space-y-2 col-span-2">
                    <Label className="text-amber-600">Department Name / ID</Label>
                    <Input placeholder="e.g. Computer Engineering" value={formData.departmentId} onChange={e => setFormData({...formData, departmentId: e.target.value})} />
                  </div>
                )}

                {/* 🔥 ÖĞRENCİ NUMARASI 🔥 */}
                {formData.roleName === 'STUDENT' && (
                  <div className="space-y-2 col-span-2">
                    <Label className="text-blue-600">Student Number (Unique)</Label>
                    <Input required placeholder="e.g. 20240001" value={formData.studentNumber} onChange={e => setFormData({...formData, studentNumber: e.target.value})} />
                  </div>
                )}

                {/* 🔥 STAFF VE FACULTY NUMARASI & UNVAN 🔥 */}
                {(formData.roleName === 'FACULTY' || formData.roleName === 'STAFF') && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-amber-600">Staff Number</Label>
                      <Input required placeholder="e.g. STF-99" value={formData.staffNumber} onChange={e => setFormData({...formData, staffNumber: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-600">Academic/Work Title</Label>
                      <Input placeholder="e.g. Prof. Dr. / Senior Lead" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section 3: Profile Details */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-600">
                <MapPin className="size-4" /> Personal Details
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select value={formData.gender} onValueChange={v => setFormData({...formData, gender: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                      <SelectItem value="PREFER_NOT_TO_SAY">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Birth Date</Label>
                  <Input type="date" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Phone Number</Label>
                  <Input placeholder="+90 ..." value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Home/Work Address</Label>
                  <Textarea className="h-20" placeholder="Full address..." value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>

                {/* 🔥 BIO SADECE ADMIN DEĞİLSE ÇIKAR 🔥 */}
                {formData.roleName !== 'ADMIN' && formData.roleName !== '' && (
                  <div className="space-y-2 col-span-2">
                    <Label>Short Biography (Bio)</Label>
                    <Textarea className="h-20" placeholder="A short bio about the user..." value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="border-t pt-6">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isLoading || isFetchingRoles || roles.length === 0} className="min-w-[120px]">
                {isLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {userToEdit ? 'Update Account' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}