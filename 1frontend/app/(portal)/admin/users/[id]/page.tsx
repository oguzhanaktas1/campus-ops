'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Calendar,
  Shield,
  AlertTriangle,
  Plus,
  Trash2,
  User,
  Building2,
  BookOpen,
  MapPin,
  BadgeCheck,
  BadgeX,
  Hash,
  Cake,
  FileText,
  Edit,
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'
import { useI18n } from '@/lib/i18n'
import { AddUserModal } from '@/components/admin/add-user-modal'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
}

function DetailRow({ label, value, icon }: { label: string; value?: React.ReactNode; icon?: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground flex-shrink-0">{icon}</span>}
        {value}
      </p>
    </div>
  )
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { t } = useI18n()

  const [user, setUser] = useState<any>(null)
  const [allRoles, setAllRoles] = useState<any[]>([])
  const [allFaculties, setAllFaculties] = useState<any[]>([])
  const [allDepartments, setAllDepartments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [roleDialog, setRoleDialog] = useState(false)
  const [assignForm, setAssignForm] = useState({ roleId: '', facultyId: '', departmentId: '', isPrimary: false })
  const [isSavingRole, setIsSavingRole] = useState(false)

  const fetchUser = async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/users/${id}`, { headers: authHeaders() })
      if (res.ok) setUser(await res.json())
      else toast.error(t('users.detailFailLoad'))
    } catch {
      toast.error(t('users.detailNetworkError'))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    void fetchUser()
    Promise.all([
      fetch(`${BACKEND}/admin/roles`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${BACKEND}/admin/faculties`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${BACKEND}/admin/departments`, { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([roles, faculties, departments]) => {
        setAllRoles(Array.isArray(roles) ? roles : [])
        setAllFaculties(Array.isArray(faculties) ? faculties : [])
        setAllDepartments(Array.isArray(departments) ? departments : [])
      })
      .catch(() => {})
  }, [id])

  const handleDeleteUser = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`${BACKEND}/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) {
        toast.success(t('users.deleteSuccess'))
        router.push('/admin/users')
      } else {
        toast.error(t('users.deleteFail'))
      }
    } catch {
      toast.error(t('users.detailNetworkError'))
    } finally {
      setIsDeleting(false)
      setIsDeleteOpen(false)
    }
  }

  const handleToggleStatus = async () => {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    try {
      const res = await fetch(`${BACKEND}/admin/users/${user.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setUser((u: any) => ({ ...u, status: newStatus }))
        toast.success(newStatus === 'ACTIVE' ? t('users.detailUserActivated') : t('users.detailUserSuspended'))
      } else {
        toast.error(t('users.detailFailStatus'))
      }
    } catch {
      toast.error(t('users.detailNetworkError'))
    }
  }

  const handleAssignRole = async () => {
    if (!assignForm.roleId) { toast.error(t('users.detailSelectRole')); return }
    setIsSavingRole(true)
    try {
      const res = await fetch(`${BACKEND}/admin/users/${user.id}/roles`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          roleId: assignForm.roleId,
          facultyId: assignForm.facultyId || undefined,
          departmentId: assignForm.departmentId || undefined,
          isPrimary: assignForm.isPrimary,
        }),
      })
      if (res.ok) {
        toast.success(t('users.detailRoleAssigned'))
        setRoleDialog(false)
        setAssignForm({ roleId: '', facultyId: '', departmentId: '', isPrimary: false })
        await fetchUser()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error((err as any).message ?? t('users.detailFailAssignRole'))
      }
    } catch {
      toast.error(t('users.detailNetworkError'))
    } finally {
      setIsSavingRole(false)
    }
  }

  const handleRemoveRole = async (roleId: string) => {
    if (!window.confirm(t('users.detailConfirmRemoveRole'))) return
    try {
      const res = await fetch(`${BACKEND}/admin/users/${user.id}/roles/${roleId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) {
        toast.success(t('users.detailRoleRemoved'))
        await fetchUser()
      } else {
        toast.error(t('users.detailFailRemoveRole'))
      }
    } catch {
      toast.error(t('users.detailNetworkError'))
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex flex-col items-center py-16 text-center">
          <AlertTriangle className="size-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">{t('users.detailNotFound')}</p>
          <Link href="/admin/users">
            <Button variant="outline" size="sm" className="mt-3">{t('users.detailBackToUsers')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  const p = user.profile ?? {}
  const fullName = p.fullName || user.email
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
  const primaryRole = (user.roles ?? []).find((r: any) => r.isPrimary)

  const genderLabel = p.gender === 'MALE' ? t('users.detailGenderMale') : p.gender === 'FEMALE' ? t('users.detailGenderFemale') : p.gender ?? null

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" /> {t('users.detailBack')}
          </Button>
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-card border border-border rounded-lg p-5 flex items-start gap-4">
        <div className="flex-shrink-0">
          {p.avatarUrl ? (
            <div className="size-16 rounded-full overflow-hidden border border-border">
              <Image src={p.avatarUrl} alt={fullName} width={64} height={64} className="object-cover size-full" />
            </div>
          ) : (
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">{fullName}</h1>
              {p.title && <p className="text-sm text-muted-foreground mt-0.5">{p.title}</p>}
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
              user.status === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
            }`}>
              {user.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {(user.roles ?? []).map((r: any) => (
              <span key={r.id} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {r.name}{r.isPrimary ? ' ★' : ''}
              </span>
            ))}
            {user.isEmailVerified ? (
              <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <BadgeCheck className="size-3.5" /> {t('users.detailEmailVerified')}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <BadgeX className="size-3.5" /> {t('users.detailEmailUnverified')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Personal information */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <User className="size-4 text-muted-foreground" /> {t('users.detailPersonalInfo')}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <DetailRow label={t('users.detailEmail')} value={user.email} icon={<Mail className="size-3.5" />} />
          <DetailRow label={t('users.detailPhone')} value={user.phoneNumber} icon={<Phone className="size-3.5" />} />
          <DetailRow label={t('users.detailGender')} value={genderLabel} icon={<User className="size-3.5" />} />
          <DetailRow label={t('users.detailBirthDate')} value={p.birthDate ? fmt(p.birthDate) : null} icon={<Cake className="size-3.5" />} />
          {p.address && (
            <div className="sm:col-span-2 space-y-0.5">
              <p className="text-xs text-muted-foreground">{t('users.detailAddress')}</p>
              <p className="text-sm font-medium flex items-start gap-1.5">
                <MapPin className="size-3.5 text-muted-foreground mt-0.5 flex-shrink-0" /> {p.address}
              </p>
            </div>
          )}
          {p.bio && (
            <div className="sm:col-span-2 space-y-0.5">
              <p className="text-xs text-muted-foreground">{t('users.detailBio')}</p>
              <p className="text-sm font-medium flex items-start gap-1.5">
                <FileText className="size-3.5 text-muted-foreground mt-0.5 flex-shrink-0" /> {p.bio}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Academic / Professional */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" /> {t('users.detailAcademicInfo')}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <DetailRow label={t('users.detailTitle')} value={p.title} icon={<BookOpen className="size-3.5" />} />
          <DetailRow label={t('users.detailStudentNo')} value={p.studentNumber} icon={<Hash className="size-3.5" />} />
          <DetailRow label={t('users.detailStaffNo')} value={p.staffNumber} icon={<Hash className="size-3.5" />} />
          <DetailRow label={t('users.detailFacultyLabel')} value={p.faculty?.name} icon={<Building2 className="size-3.5" />} />
          <DetailRow label={t('users.detailDeptLabel')} value={p.department?.name} icon={<Building2 className="size-3.5" />} />
          <DetailRow label={t('users.detailUnitLabel')} value={p.unit?.name} icon={<Building2 className="size-3.5" />} />
        </div>
      </div>

      {/* Account info */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="size-4 text-muted-foreground" /> {t('users.detailAccountInfo')}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <DetailRow label={t('users.detailJoined')} value={fmt(user.createdAt)} icon={<Calendar className="size-3.5" />} />
          <DetailRow label={t('users.detailLastLogin')} value={user.lastLoginAt ? fmt(user.lastLoginAt) : t('users.detailNever')} icon={<Shield className="size-3.5" />} />
        </div>
      </div>

      {/* Role Management */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" /> {t('users.detailRoleAssignments')}
          </h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRoleDialog(true)}>
            <Plus className="size-3.5" /> {t('users.detailAssignRole')}
          </Button>
        </div>

        {(user.roles ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('users.detailNoRoles')}</p>
        ) : (
          <div className="divide-y divide-border">
            {(user.roles ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                    {r.isPrimary && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{t('users.detailPrimary')}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.facultyName ? `${t('users.detailFacultyLabel')}: ${r.facultyName}` : ''}
                    {r.departmentName ? ` · ${t('users.detailDeptLabel')}: ${r.departmentName}` : ''}
                    {r.unitName ? ` · ${t('users.detailUnitLabel')}: ${r.unitName}` : ''}
                    {!r.facultyName && !r.departmentName && !r.unitName ? t('users.detailGlobalScope') : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemoveRole(r.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsEditModalOpen(true)}>
          <Edit className="size-3.5" /> {t('users.editUser')}
        </Button>
        <Button
          variant={user.status === 'ACTIVE' ? 'destructive' : 'default'}
          size="sm"
          onClick={handleToggleStatus}
        >
          {user.status === 'ACTIVE' ? t('users.detailSuspend') : t('users.detailActivate')}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5 ml-auto"
          onClick={() => setIsDeleteOpen(true)}
        >
          <Trash2 className="size-3.5" /> {t('users.deleteUser')}
        </Button>
      </div>

      {/* Assign Role Dialog */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('users.detailDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('users.detailRoleField')} <span className="text-destructive">*</span></Label>
              <Select value={assignForm.roleId} onValueChange={(v) => setAssignForm({ ...assignForm, roleId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('users.detailSelectRolePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('users.detailFacultyOptional')}</Label>
              <Select value={assignForm.facultyId} onValueChange={(v) => setAssignForm({ ...assignForm, facultyId: v, departmentId: '' })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('users.detailNoFacultyScope')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('users.detailNoScope')}</SelectItem>
                  {allFaculties.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignForm.facultyId && (
              <div className="space-y-1.5">
                <Label>{t('users.detailDeptOptional')}</Label>
                <Select value={assignForm.departmentId} onValueChange={(v) => setAssignForm({ ...assignForm, departmentId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('users.detailNoScope')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('users.detailNoScope')}</SelectItem>
                    {allDepartments
                      .filter((d: any) => d.facultyId === assignForm.facultyId)
                      .map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={assignForm.isPrimary}
                onClick={() => setAssignForm({ ...assignForm, isPrimary: !assignForm.isPrimary })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  assignForm.isPrimary ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span className={`inline-block size-3.5 rounded-full bg-white shadow transition-transform ${assignForm.isPrimary ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <Label className="cursor-pointer" onClick={() => setAssignForm({ ...assignForm, isPrimary: !assignForm.isPrimary })}>
                {t('users.detailSetPrimary')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(false)} disabled={isSavingRole}>{t('users.detailCancel')}</Button>
            <Button onClick={handleAssignRole} disabled={isSavingRole}>
              {isSavingRole && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('users.detailAssign')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.detailDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('users.detailDeleteDesc', { name: user.profile?.fullName ?? user.email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white focus:ring-red-600"
            >
              {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              {t('users.deleteUser')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddUserModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => { void fetchUser() }}
        userToEdit={user ? {
          id: user.id,
          name: user.profile?.fullName ?? user.email,
          email: user.email,
          phoneNumber: user.phoneNumber,
          status: user.status,
          gender: user.profile?.gender,
          birthDate: user.profile?.birthDate,
          studentNumber: user.profile?.studentNumber,
          staffNumber: user.profile?.staffNumber,
          title: user.profile?.title,
          departmentId: user.profile?.departmentId,
          address: user.profile?.address,
          bio: user.profile?.bio,
          avatarUrl: user.profile?.avatarUrl,
          roles: user.roles,
          role: (user.roles ?? []).find((r: any) => r.isPrimary)?.name,
        } : null}
      />
    </div>
  )
}
