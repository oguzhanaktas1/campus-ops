'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { getToken } from '@/lib/auth'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000'

function fmt(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' }
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [user, setUser] = useState<any>(null)
  const [allRoles, setAllRoles] = useState<any[]>([])
  const [allFaculties, setAllFaculties] = useState<any[]>([])
  const [allDepartments, setAllDepartments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Role assign dialog
  const [roleDialog, setRoleDialog] = useState(false)
  const [assignForm, setAssignForm] = useState({ roleId: '', facultyId: '', departmentId: '', isPrimary: false })
  const [isSavingRole, setIsSavingRole] = useState(false)

  const fetchUser = async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/users/${id}`, { headers: authHeaders() })
      if (res.ok) setUser(await res.json())
      else toast.error('Failed to load user.')
    } catch {
      toast.error('Network error.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    void fetchUser()
    // load roles + faculties for assign dialog
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

  const handleToggleStatus = async () => {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    try {
      const res = await fetch(`${BACKEND}/admin/users/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setUser((u: any) => ({ ...u, status: newStatus }))
        toast.success(`User ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'}.`)
      } else {
        toast.error('Failed to update status.')
      }
    } catch {
      toast.error('Network error.')
    }
  }

  const handleAssignRole = async () => {
    if (!assignForm.roleId) { toast.error('Select a role.'); return }
    setIsSavingRole(true)
    try {
      const res = await fetch(`${BACKEND}/admin/users/${id}/roles`, {
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
        toast.success('Role assigned.')
        setRoleDialog(false)
        setAssignForm({ roleId: '', facultyId: '', departmentId: '', isPrimary: false })
        await fetchUser()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error((err as any).message ?? 'Failed to assign role.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setIsSavingRole(false)
    }
  }

  const handleRemoveRole = async (roleId: string) => {
    if (!window.confirm('Remove this role assignment?')) return
    try {
      const res = await fetch(`${BACKEND}/admin/users/${id}/roles/${roleId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (res.ok) {
        toast.success('Role removed.')
        await fetchUser()
      } else {
        toast.error('Failed to remove role.')
      }
    } catch {
      toast.error('Network error.')
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
          <p className="text-sm font-medium text-foreground">User not found</p>
          <Link href="/admin/users">
            <Button variant="outline" size="sm" className="mt-3">Back to users</Button>
          </Link>
        </div>
      </div>
    )
  }

  const fullName = user.profile?.fullName || user.email
  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="p-6 space-y-5 max-w-3xl mx-auto pb-20">
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" /> Back
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-4">
        <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground">{fullName}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {(user.roles ?? []).map((r: any) => (
              <span key={r.id} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {r.name}{r.isPrimary ? ' ★' : ''}
              </span>
            ))}
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
          user.status === 'ACTIVE'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
        }`}>
          {user.status}
        </span>
      </div>

      {/* Details */}
      <div className="bg-card border border-border rounded-lg p-5 grid sm:grid-cols-2 gap-4">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Mail className="size-3.5 text-muted-foreground" /> {user.email}
          </p>
        </div>
        {user.phoneNumber && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Phone className="size-3.5 text-muted-foreground" /> {user.phoneNumber}
            </p>
          </div>
        )}
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Joined</p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" /> {fmt(user.createdAt)}
          </p>
        </div>
        {user.lastLoginAt && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Last Login</p>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Shield className="size-3.5 text-muted-foreground" /> {fmt(user.lastLoginAt)}
            </p>
          </div>
        )}
        {user.profile?.title && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Title</p>
            <p className="text-sm font-medium">{user.profile.title}</p>
          </div>
        )}
        {user.profile?.studentNumber && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Student No</p>
            <p className="text-sm font-medium">{user.profile.studentNumber}</p>
          </div>
        )}
        {user.profile?.staffNumber && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Staff No</p>
            <p className="text-sm font-medium">{user.profile.staffNumber}</p>
          </div>
        )}
      </div>

      {/* Role Management */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" /> Role Assignments
          </h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRoleDialog(true)}>
            <Plus className="size-3.5" /> Assign Role
          </Button>
        </div>

        {(user.roles ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles assigned.</p>
        ) : (
          <div className="divide-y divide-border">
            {(user.roles ?? []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{r.name}</span>
                    {r.isPrimary && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">PRIMARY</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.facultyName ? `Faculty: ${r.facultyName}` : ''}
                    {r.departmentName ? ` · Dept: ${r.departmentName}` : ''}
                    {r.unitName ? ` · Unit: ${r.unitName}` : ''}
                    {!r.facultyName && !r.departmentName && !r.unitName ? 'Global scope' : ''}
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
      <div className="flex items-center gap-3">
        <Button
          variant={user.status === 'ACTIVE' ? 'destructive' : 'default'}
          size="sm"
          onClick={handleToggleStatus}
        >
          {user.status === 'ACTIVE' ? 'Suspend User' : 'Activate User'}
        </Button>
      </div>

      {/* Assign Role Dialog */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Role <span className="text-destructive">*</span></Label>
              <Select value={assignForm.roleId} onValueChange={(v) => setAssignForm({ ...assignForm, roleId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Faculty (optional)</Label>
              <Select value={assignForm.facultyId} onValueChange={(v) => setAssignForm({ ...assignForm, facultyId: v, departmentId: '' })}>
                <SelectTrigger>
                  <SelectValue placeholder="No faculty scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— No scope —</SelectItem>
                  {allFaculties.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {assignForm.facultyId && (
              <div className="space-y-1.5">
                <Label>Department (optional)</Label>
                <Select value={assignForm.departmentId} onValueChange={(v) => setAssignForm({ ...assignForm, departmentId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="No department scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— No scope —</SelectItem>
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
                Set as primary role
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog(false)} disabled={isSavingRole}>Cancel</Button>
            <Button onClick={handleAssignRole} disabled={isSavingRole}>
              {isSavingRole && <Loader2 className="mr-2 size-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
