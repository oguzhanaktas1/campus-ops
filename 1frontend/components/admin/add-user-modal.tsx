'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Briefcase, Camera, Loader2, MapPin, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'

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

const EMPTY_FORM = {
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
  primaryRoleId: '',
  primaryRoleName: '',
  roleIds: [] as string[],
  avatarUrl: '',
}

const PRIMARY_ROLE_NAMES = ['STUDENT', 'FACULTY', 'STAFF', 'ADMIN', 'ORGANIZER']

export function AddUserModal({
  isOpen,
  onClose,
  onSuccess,
  userToEdit,
}: AddUserModalProps) {
  const { t } = useI18n()
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingRoles, setIsFetchingRoles] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)

  const fetchRoles = async (): Promise<Role[]> => {
    try {
      setIsFetchingRoles(true)
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/admin/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return []
      const data = await res.json()
      setRoles(data)
      return data
    } catch (err) {
      console.error('Roles fetch failed', err)
      return []
    } finally {
      setIsFetchingRoles(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return

    fetchRoles().then((fetchedRoles) => {
      if (!userToEdit) {
        setFormData(EMPTY_FORM)
        return
      }

      const nameParts = userToEdit.name ? userToEdit.name.split(' ') : ['']
      const primaryRole = Array.isArray(userToEdit.roles)
        ? userToEdit.roles.find((role: any) => role.isPrimary)
        : null
      const matchedRole =
        primaryRole ??
        fetchedRoles.find((role) => role.name.toLowerCase() === userToEdit.role?.toLowerCase())
      const assignedRoleIds = Array.isArray(userToEdit.roles)
        ? userToEdit.roles.map((role: any) => role.id)
        : matchedRole?.id
          ? [matchedRole.id]
          : []

      setFormData({
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        email: userToEdit.email || '',
        password: '',
        phoneNumber: userToEdit.phoneNumber || '',
        status: userToEdit.status ? userToEdit.status.toUpperCase() : 'ACTIVE',
        gender: userToEdit.gender ? userToEdit.gender.toUpperCase() : 'MALE',
        birthDate: userToEdit.birthDate
          ? new Date(userToEdit.birthDate).toISOString().split('T')[0]
          : '',
        studentNumber: userToEdit.studentNumber || '',
        staffNumber: userToEdit.staffNumber || '',
        title: userToEdit.title || '',
        departmentId: userToEdit.department || userToEdit.departmentId || '',
        address: userToEdit.address || '',
        bio: userToEdit.bio || '',
        primaryRoleId: matchedRole?.id || '',
        primaryRoleName: matchedRole?.name?.toUpperCase() || '',
        roleIds: assignedRoleIds,
        avatarUrl: userToEdit.avatarUrl || '',
      })
    })
  }, [isOpen, userToEdit])

  const handlePrimaryRoleChange = (roleId: string) => {
    const role = roles.find((item) => item.id === roleId)
    const primaryRoleName = role?.name.toUpperCase() || ''
    const primaryRoleIds = roles
      .filter((item) => PRIMARY_ROLE_NAMES.includes(item.name.toUpperCase()))
      .map((item) => item.id)

    setFormData((prev) => {
      const next = {
        ...prev,
        primaryRoleId: roleId,
        primaryRoleName,
        roleIds: Array.from(
          new Set([
            roleId,
            ...prev.roleIds.filter((id) => id === roleId || !primaryRoleIds.includes(id)),
          ]),
        ),
      }

      if (primaryRoleName !== 'STUDENT') next.studentNumber = ''

      if (!['FACULTY', 'STAFF', 'ADMIN', 'ORGANIZER'].includes(primaryRoleName)) {
        next.staffNumber = ''
        next.title = ''
      }

      if (primaryRoleName === 'ADMIN') {
        next.departmentId = ''
        next.bio = ''
      }

      return next
    })
  }

  const toggleAdditionalRole = (roleId: string) => {
    setFormData((prev) => {
      if (roleId === prev.primaryRoleId) return prev
      return {
        ...prev,
        roleIds: prev.roleIds.includes(roleId)
          ? prev.roleIds.filter((id) => id !== roleId)
          : [...prev.roleIds, roleId],
      }
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

      const payload: Record<string, unknown> = {
        ...formData,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        department: formData.departmentId,
        primaryRoleId: formData.primaryRoleId,
        roleIds: formData.roleIds,
      }

      if (userToEdit && !formData.password) {
        delete payload.password
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Action failed')
      }

      toast.success(userToEdit ? t('users.modalUserUpdated') : t('users.modalUserCreated'))
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || t('users.modalOpFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {userToEdit ? t('users.modalTitleEdit') : t('users.modalTitleCreate')}
          </DialogTitle>
          <DialogDescription>
            {t('users.modalDesc')}
          </DialogDescription>
        </DialogHeader>

        {isFetchingRoles ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('users.modalLoadingRoles')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-2">
              <label htmlFor="avatar-upload" className="cursor-pointer group relative">
                <div className="size-24 rounded-full border-2 border-dashed border-muted-foreground/40 overflow-hidden bg-muted flex items-center justify-center group-hover:border-primary transition-colors">
                  {formData.avatarUrl ? (
                    <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="size-12 text-muted-foreground/50" />
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="size-6 text-white" />
                  </div>
                </div>
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    setFormData((prev) => ({ ...prev, avatarUrl: ev.target?.result as string }))
                  }
                  reader.readAsDataURL(file)
                }}
              />
              <p className="text-xs text-muted-foreground">{t('users.modalUploadPhoto')}</p>
              {formData.avatarUrl ? (
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => setFormData((prev) => ({ ...prev, avatarUrl: '' }))}
                >
                  {t('users.modalRemovePhoto')}
                </button>
              ) : null}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                <UserCircle className="size-4" /> {t('users.modalSectionCredentials')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('users.modalFirstName')}</Label>
                  <Input required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('users.modalLastName')}</Label>
                  <Input required value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('users.modalEmail')}</Label>
                  <Input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{userToEdit ? t('users.modalPasswordEdit') : t('users.modalPassword')}</Label>
                  <Input type="text" required={!userToEdit} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-amber-600">
                <Briefcase className="size-4" /> {t('users.modalSectionRole')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('users.modalPrimaryRole')}</Label>
                  <Select value={formData.primaryRoleId} onValueChange={handlePrimaryRoleChange} disabled={roles.length === 0}>
                    <SelectTrigger><SelectValue placeholder={t('users.modalSelectPrimaryRole')} /></SelectTrigger>
                    <SelectContent>
                      {roles
                        .filter((role) => PRIMARY_ROLE_NAMES.includes(role.name.toUpperCase()))
                        .map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('users.modalAccountStatus')}</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{t('users.modalStatusActive')}</SelectItem>
                      <SelectItem value="INACTIVE">{t('users.modalStatusInactive')}</SelectItem>
                      <SelectItem value="SUSPENDED">{t('users.modalStatusSuspended')}</SelectItem>
                      <SelectItem value="PENDING">{t('users.modalStatusPending')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>{t('users.modalAdditionalRoles')}</Label>
                  <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                    {roles
                      .filter(
                        (role) =>
                          role.id !== formData.primaryRoleId &&
                          !PRIMARY_ROLE_NAMES.includes(role.name.toUpperCase()),
                      )
                      .map((role) => (
                        <label key={role.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.roleIds.includes(role.id)}
                            onChange={() => toggleAdditionalRole(role.id)}
                          />
                          <span>{role.name}</span>
                        </label>
                      ))}
                  </div>
                </div>

                {formData.primaryRoleName !== 'ADMIN' && formData.primaryRoleName !== '' ? (
                  <div className="space-y-2 col-span-2">
                    <Label className="text-amber-600">{t('users.modalDepartment')}</Label>
                    <Input placeholder={t('users.modalDepartmentPlaceholder')} value={formData.departmentId} onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })} />
                  </div>
                ) : null}

                {formData.primaryRoleName === 'STUDENT' ? (
                  <div className="space-y-2 col-span-2">
                    <Label className="text-blue-600">{t('users.modalStudentNumber')}</Label>
                    <Input required placeholder={t('users.modalStudentNumberPlaceholder')} value={formData.studentNumber} onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })} />
                  </div>
                ) : null}

                {['FACULTY', 'STAFF', 'ADMIN', 'ORGANIZER'].includes(formData.primaryRoleName) ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-amber-600">{t('users.modalStaffNumber')}</Label>
                      <Input required placeholder={t('users.modalStaffNumberPlaceholder')} value={formData.staffNumber} onChange={(e) => setFormData({ ...formData, staffNumber: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-amber-600">{t('users.modalAcademicTitle')}</Label>
                      <Input placeholder={t('users.modalAcademicTitlePlaceholder')} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-600">
                <MapPin className="size-4" /> {t('users.modalSectionPersonal')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('users.modalGender')}</Label>
                  <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">{t('users.modalGenderMale')}</SelectItem>
                      <SelectItem value="FEMALE">{t('users.modalGenderFemale')}</SelectItem>
                      <SelectItem value="OTHER">{t('users.modalGenderOther')}</SelectItem>
                      <SelectItem value="PREFER_NOT_TO_SAY">{t('users.modalGenderPrefer')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('users.modalBirthDate')}</Label>
                  <Input type="date" value={formData.birthDate} onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>{t('users.modalPhone')}</Label>
                  <Input placeholder={t('users.modalPhonePlaceholder')} value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>{t('users.modalAddress')}</Label>
                  <Textarea className="h-20" placeholder={t('users.modalAddressPlaceholder')} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                </div>
                {formData.primaryRoleName !== 'ADMIN' && formData.primaryRoleName !== '' ? (
                  <div className="space-y-2 col-span-2">
                    <Label>{t('users.modalBio')}</Label>
                    <Textarea className="h-20" placeholder={t('users.modalBioPlaceholder')} value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} />
                  </div>
                ) : null}
              </div>
            </div>

            <DialogFooter className="border-t pt-6">
              <Button type="button" variant="ghost" onClick={onClose}>{t('users.modalCancel')}</Button>
              <Button type="submit" disabled={isLoading || isFetchingRoles || roles.length === 0} className="min-w-[120px]">
                {isLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                {userToEdit ? t('users.modalUpdate') : t('users.modalCreate')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
