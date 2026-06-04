'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  UserPlus, MoreHorizontal, ShieldCheck, GraduationCap, Users, Briefcase, Loader2, Edit, Trash2, Download, AlertCircle, ChevronLeft, ChevronRight
} from 'lucide-react'
import { SmartSearchInput } from '@/components/smart-search-input'
import { AddUserModal } from '@/components/admin/add-user-modal'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import { getToken } from '@/lib/auth'
import { StatusBadge } from '@/components/status-badge'
import { useI18n } from '@/lib/i18n'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { TopScrollTable } from '@/components/ui/top-scroll-table'

type Role = 'student' | 'faculty' | 'staff' | 'admin' | 'organizer'
type RoleFilter = Role | 'all'

const PAGE_SIZE = 20

const roleConfig: Record<Role, { label: string; icon: React.ReactNode; className: string }> = {
  student:   { label: 'Student',   icon: <GraduationCap className="size-3.5" />, className: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800' },
  faculty:   { label: 'Faculty',   icon: <Users className="size-3.5" />,         className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' },
  staff:     { label: 'Staff',     icon: <Briefcase className="size-3.5" />,     className: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' },
  admin:     { label: 'Admin',     icon: <ShieldCheck className="size-3.5" />,   className: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800' },
  organizer: { label: 'Organizer', icon: <Briefcase className="size-3.5" />,     className: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-800' },
}

interface DbUser {
  id: string
  name: string
  email: string
  phoneNumber?: string
  department: string
  role: Role
  roles?: Array<{ id: string; name: string; isPrimary?: boolean }>
  status: string
  createdAt: string
  title?: string
  staffNumber?: string
  studentNumber?: string
  gender?: string
  bio?: string
  birthDate?: string
}

interface PagedResult {
  data: DbUser[]
  total: number
  page: number
  totalPages: number
  roleCounts?: Partial<Record<RoleFilter, number>>
}

export default function AdminUsersPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [result, setResult] = useState<PagedResult>({ data: [], total: 0, page: 1, totalPages: 1, roleCounts: {} })
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<DbUser | null>(null)
  const [userToDelete, setUserToDelete] = useState<DbUser | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const load = useCallback(async (pg: number, q: string, role: RoleFilter) => {
    setIsLoading(true)
    try {
      const token = getToken()
      const params = new URLSearchParams({ page: String(pg), limit: String(PAGE_SIZE) })
      if (q)           params.set('search', q)
      if (role !== 'all') params.set('role', role)
      const res = await fetch(`${backendUrl}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setResult(await res.json())
    } catch (err) {
      console.error('API Hatası:', err)
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl])

  // initial fetch
  useEffect(() => { load(1, '', 'all') }, [load])

  // search — debounce 400ms, page'i 1'e sıfırla
  const handleSearch = (val: string) => {
    setSearch(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setPage(1)
      load(1, val, roleFilter)
    }, 400)
  }

  // rol filtresi — anında, page 1'e sıfırla
  const handleRoleFilter = (role: RoleFilter) => {
    setRoleFilter(role)
    setPage(1)
    load(1, search, role)
  }

  // sayfa değişimi
  const handlePageChange = (pg: number) => {
    setPage(pg)
    load(pg, search, roleFilter)
  }

  const openAddModal  = () => { setUserToEdit(null); setIsModalOpen(true) }
  const openEditModal = (user: DbUser) => { setUserToEdit(user); setIsModalOpen(true) }

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      users.length > 0 && prev.length === users.length ? [] : users.map((user) => user.id),
    )
  }

  const toggleSelectUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return
    setIsDeleting(true)
    try {
      const token = getToken()
      await fetch(`${backendUrl}/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.success(t('users.deleteSuccess'))
      setSelectedIds((prev) => prev.filter((id) => id !== userToDelete.id))
      load(page, search, roleFilter)
    } catch {
      toast.error(t('users.deleteFail'))
    } finally {
      setIsDeleting(false)
      setUserToDelete(null)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return
    setIsDeleting(true)
    try {
      const token = getToken()
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`${backendUrl}/admin/users/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }).then((res) => {
            if (!res.ok) throw new Error(`Failed to delete user ${id}`)
          }),
        ),
      )
      toast.success(t('users.bulkDeleteSuccess', { count: selectedIds.length }))
      setSelectedIds([])
      setIsBulkDeleteOpen(false)
      load(page, search, roleFilter)
    } catch {
      toast.error(t('users.bulkDeleteFail'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportPdf = (user: DbUser) => {
    try {
      const doc = new jsPDF()
      doc.setFontSize(22)
      doc.setTextColor(15, 23, 42)
      doc.text('System Access Credentials', 20, 20)
      doc.setDrawColor(200, 200, 200)
      doc.line(20, 26, 190, 26)
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text('Welcome to CampusFlow! Please keep this document secure.', 20, 34)
      doc.text('You must change your temporary password upon your first login.', 20, 40)
      doc.setFontSize(12)
      doc.setTextColor(50, 50, 50)
      let yPos = 55
      const lineHeight = 10
      const addDetail = (label: string, value?: string | null) => {
        if (value && value.trim() !== '') {
          doc.setFont('helvetica', 'bold')
          doc.text(`${label}:`, 20, yPos)
          doc.setFont('helvetica', 'normal')
          doc.text(value, 65, yPos)
          yPos += lineHeight
        }
      }
      addDetail('Full Name', user.name)
      addDetail('Email Address', user.email)
      const defaultPassword = 'ChangeMe123!'
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(220, 38, 38)
      doc.text('Temporary Password:', 20, yPos)
      doc.setFont('helvetica', 'normal')
      doc.text(defaultPassword, 65, yPos)
      doc.setTextColor(50, 50, 50)
      yPos += lineHeight
      addDetail('Phone Number', user.phoneNumber)
      addDetail('Department', user.department || 'N/A')
      addDetail('Account Status', user.status.toUpperCase())
      if (user.role === 'student')      addDetail('Student ID', user.studentNumber)
      else if (user.role === 'faculty') { addDetail('Title', user.title); addDetail('Faculty ID', user.staffNumber) }
      else if (user.role === 'staff')   { addDetail('Title', user.title); addDetail('Staff ID', user.staffNumber) }
      else if (user.role === 'admin')   addDetail('Admin ID', user.staffNumber)
      addDetail('Gender', user.gender)
      if (user.bio) addDetail('Bio', user.bio)
      addDetail('Account Created', user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown')
      yPos += 10
      doc.setDrawColor(220, 38, 38)
      doc.setFillColor(254, 242, 242)
      doc.rect(20, yPos, 170, 20, 'FD')
      doc.setFontSize(10)
      doc.setTextColor(220, 38, 38)
      doc.setFont('helvetica', 'bold')
      doc.text('SECURITY WARNING:', 25, yPos + 7)
      doc.setFont('helvetica', 'normal')
      doc.text('Do not share this document with anyone. Log in to the system and', 25, yPos + 13)
      doc.text('update your password immediately from your profile settings.', 25, yPos + 18)
      doc.setFontSize(10)
      doc.setTextColor(150, 150, 150)
      doc.text(`Generated by CampusFlow Admin on ${new Date().toLocaleDateString()}`, 20, 280)
      const filename = `${user.name.replace(/\s+/g, '_').toLowerCase()}_credentials.pdf`
      doc.save(filename)
      toast.success(t('users.pdfSuccess', { filename }))
    } catch {
      toast.error(t('users.pdfFail'))
    }
  }

  const { data: users, total, totalPages, roleCounts = {} } = result
  const start = (page - 1) * PAGE_SIZE + 1
  const end   = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto pb-20 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('users.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total > 0 ? t('users.showingOf', { start, end, total }) : t('users.noUsers')}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAddModal}>
          <UserPlus className="size-3.5" /> {t('users.addUser')}
        </Button>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {t('users.usersSelected', { count: selectedIds.length })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} disabled={isDeleting}>
              {t('common.clear')}
            </Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setIsBulkDeleteOpen(true)} disabled={isDeleting}>
              <Trash2 className="size-3.5" /> {t('common.deleteSelected')}
            </Button>
          </div>
        </div>
      )}

      {/* Role tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-0 overflow-x-auto">
        {(['all', 'student', 'faculty', 'staff', 'organizer', 'admin'] as RoleFilter[]).map((r) => (
          <button
            key={r}
            onClick={() => handleRoleFilter(r)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap',
              roleFilter === r ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <span>{r === 'all' ? 'All' : roleConfig[r as Role].label}</span>
            <span
              className={cn(
                'ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                roleFilter === r ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              {roleCounts[r] ?? (r === 'all' ? total : 0)}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <SmartSearchInput
        value={search}
        onChange={handleSearch}
        placeholder={t('users.searchPlaceholder')}
        debounceMs={400}
        isLoading={isLoading && search.length > 0}
        resultCount={search.trim() ? total : undefined}
      />

      {/* Table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-6 border-b border-border">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        )}
        <TopScrollTable>
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-5 py-3 text-left w-12">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border cursor-pointer"
                  checked={users.length > 0 && selectedIds.length === users.length}
                  onChange={toggleSelectAll}
                  aria-label={t('common.selectAll')}
                />
              </th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">{t('users.colUser')}</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">{t('users.colDepartment')}</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">{t('users.colRole')}</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">{t('users.colStatus')}</th>
              <th className="px-5 py-3 text-right font-semibold text-muted-foreground">{t('users.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => {
              const roleCfg = roleConfig[user.role]
              const secondaryRoles = (user.roles ?? []).filter((item) => !item.isPrimary).map((item) => item.name)
              const identifier = user.role === 'student' ? user.studentNumber : user.staffNumber
              return (
                <tr
                  key={user.id}
                  className="hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input, button, [role=menuitem], [data-radix-popper-content-wrapper]')) return
                    router.push(`/admin/users/${identifier ?? user.id}`)
                  }}
                >
                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border cursor-pointer"
                      checked={selectedIds.includes(user.id)}
                      onChange={() => toggleSelectUser(user.id)}
                      aria-label={`Select ${user.name}`}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold uppercase flex-shrink-0">
                        {user.name ? user.name.substring(0, 2) : '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{user.name}</p>
                          {user.status === 'suspended' && <AlertCircle className="size-3 text-destructive" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground truncate max-w-[200px]">{user.department}</td>
                  <td className="px-5 py-3.5">
                    <div className="space-y-1">
                      <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border w-fit', roleCfg?.className)}>
                        {roleCfg?.icon} {roleCfg?.label}
                      </span>
                      {secondaryRoles.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">{secondaryRoles.join(', ')}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={user.status} /></td>
                  <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openEditModal(user)} className="cursor-pointer">
                          <Edit className="mr-2 size-4" /> {t('users.editUser')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportPdf(user)} className="cursor-pointer">
                          <Download className="mr-2 size-4" /> {t('users.exportPdf')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setUserToDelete(user)} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50">
                          <Trash2 className="mr-2 size-4" /> {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </TopScrollTable>

        {!isLoading && users.length === 0 && (
          <div className="text-center py-12">
            <Users className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('users.noUsers')}</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 flex-wrap">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page <= 1 || isLoading}
            onClick={() => handlePageChange(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          {(() => {
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
            const maxPages = isMobile ? 3 : 7
            const pages: (number | '...')[] = []
            if (totalPages <= maxPages) {
              for (let i = 1; i <= totalPages; i++) pages.push(i)
            } else if (page <= 2) {
              pages.push(1, 2, 3, '...', totalPages)
            } else if (page >= totalPages - 1) {
              pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages)
            } else {
              pages.push(1, '...', page, '...', totalPages)
            }
            return pages.map((p, i) =>
              p === '...' ? (
                <span key={`e-${i}`} className="px-1 text-xs text-muted-foreground select-none">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="icon"
                  className="size-8 text-xs"
                  disabled={isLoading}
                  onClick={() => handlePageChange(p as number)}
                >
                  {p}
                </Button>
              )
            )
          })()}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page >= totalPages || isLoading}
            onClick={() => handlePageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => load(page, search, roleFilter)}
        userToEdit={userToEdit}
      />

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('users.confirmDeleteDesc', { name: userToDelete?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              {t('users.deleteUser')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.confirmBulkDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('users.confirmBulkDeleteDesc', { count: selectedIds.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteConfirm} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              {t('common.deleteSelected')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
