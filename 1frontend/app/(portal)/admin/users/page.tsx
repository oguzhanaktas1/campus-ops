'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Search, UserPlus, MoreHorizontal, ShieldCheck, GraduationCap, Users, Briefcase, Loader2, Edit, Trash2, Download, AlertCircle
} from 'lucide-react'
import { AddUserModal } from '@/components/admin/add-user-modal'
import { toast } from 'sonner'
import jsPDF from 'jspdf'

// Shadcn UI Componentleri
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

type Role = 'student' | 'faculty' | 'staff' | 'admin' | 'organizer'
type RoleFilter = Role | 'all'

const roleConfig: Record<Role, { label: string; icon: React.ReactNode; className: string }> = {
  student: { label: 'Student', icon: <GraduationCap className="size-3.5" />, className: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800' },
  faculty: { label: 'Faculty', icon: <Users className="size-3.5" />, className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800' },
  staff: { label: 'Staff', icon: <Briefcase className="size-3.5" />, className: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800' },
  admin: { label: 'Admin', icon: <ShieldCheck className="size-3.5" />, className: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800' },
  organizer: { label: 'Organizer', icon: <Briefcase className="size-3.5" />, className: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:border-fuchsia-800' },
}

// 🔥 STATÜ RENKLERİ İÇİN YARDIMCI BİLEŞEN 🔥
const StatusBadge = ({ status }: { status: string }) => {
  const s = status?.toUpperCase() || 'UNKNOWN'
  if (s === 'ACTIVE') return <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold tracking-wider">ACTIVE</span>
  if (s === 'SUSPENDED') return <span className="px-2 py-1 rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 text-[10px] font-bold tracking-wider">SUSPENDED</span>
  if (s === 'INACTIVE') return <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-[10px] font-bold tracking-wider">INACTIVE</span>
  if (s === 'PENDING') return <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-[10px] font-bold tracking-wider">PENDING</span>
  return <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-[10px] font-bold tracking-wider">{s}</span>
}

interface DbUser {
  id: string;
  name: string; 
  email: string; 
  phoneNumber?: string; 
  department: string; 
  role: Role; 
  roles?: Array<{ id: string; name: string; isPrimary?: boolean }>;
  status: string; 
  createdAt: string; 
  title?: string; 
  staffNumber?: string; 
  studentNumber?: string; 
  gender?: string; 
  bio?: string;
  birthDate?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<DbUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userToEdit, setUserToEdit] = useState<DbUser | null>(null)
  const [userToDelete, setUserToDelete] = useState<DbUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/admin/users`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setUsers(await res.json())
    } catch (error) {
      console.error('API Hatası:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const openAddModal = () => { setUserToEdit(null); setIsModalOpen(true); }
  const openEditModal = (user: DbUser) => { setUserToEdit(user); setIsModalOpen(true); }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem('access_token')
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      await fetch(`${backendUrl}/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchUsers(); 
      toast.success("User deleted successfully!")
    } catch (error) {
      console.error("Silme hatası", error)
      toast.error("Failed to delete user.")
    } finally {
      setIsDeleting(false);
      setUserToDelete(null);
    }
  }

  const handleExportPdf = (user: DbUser) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); 
      doc.text("System Access Credentials", 20, 20); 
      
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 26, 190, 26);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Welcome to CampusFlow! Please keep this document secure.", 20, 34);
      doc.text("You must change your temporary password upon your first login.", 20, 40);

      doc.setFontSize(12);
      doc.setTextColor(50, 50, 50);
      
      let yPos = 55; 
      const lineHeight = 10;

      const addDetail = (label: string, value?: string | null) => {
        if (value && value.trim() !== '') {
          doc.setFont("helvetica", "bold");
          doc.text(`${label}:`, 20, yPos);
          doc.setFont("helvetica", "normal");
          doc.text(value, 65, yPos);
          yPos += lineHeight;
        }
      };

      addDetail("Full Name", user.name);
      addDetail("Email Address", user.email);
      
      const defaultPassword = "ChangeMe123!"; 
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38); 
      doc.text("Temporary Password:", 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(defaultPassword, 65, yPos);
      doc.setTextColor(50, 50, 50); 
      yPos += lineHeight;

      addDetail("Phone Number", user.phoneNumber);
      addDetail("Department", user.department || "N/A");
      addDetail("Account Status", user.status.toUpperCase()); // Statü eklendi
      
      if (user.role === 'student') {
        addDetail("Student ID", user.studentNumber);
      } else if (user.role === 'faculty') {
        addDetail("Title", user.title);
        addDetail("Faculty ID", user.staffNumber); 
      } else if (user.role === 'staff') {
        addDetail("Title", user.title);
        addDetail("Staff ID", user.staffNumber);
      } else if (user.role === 'admin') {
        addDetail("Admin ID", user.staffNumber);
      }

      addDetail("Gender", user.gender);
      if (user.bio) addDetail("Bio", user.bio);

      const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown";
      addDetail("Account Created", createdDate);

      yPos += 10;
      doc.setDrawColor(220, 38, 38);
      doc.setFillColor(254, 242, 242);
      doc.rect(20, yPos, 170, 20, "FD");
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.setFont("helvetica", "bold");
      doc.text("SECURITY WARNING:", 25, yPos + 7);
      doc.setFont("helvetica", "normal");
      doc.text("Do not share this document with anyone. Log in to the system and", 25, yPos + 13);
      doc.text("update your password immediately from your profile settings.", 25, yPos + 18);

      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated by CampusFlow Admin on ${new Date().toLocaleDateString()}`, 20, 280);

      const filename = `${user.name.replace(/\s+/g, '_').toLowerCase()}_credentials.pdf`;
      doc.save(filename);
      toast.success(`${filename} has been downloaded!`);
    } catch (error) {
      console.error("PDF Export error:", error);
      toast.error("Failed to export PDF.");
    }
  }

  const filtered = users.filter((u) => {
    const matchesSearch = search === '' || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const roleCounts: Record<RoleFilter, number> = {
    all: users.length, student: users.filter(u => u.role === 'student').length,
    faculty: users.filter(u => u.role === 'faculty').length, staff: users.filter(u => u.role === 'staff').length, admin: users.filter(u => u.role === 'admin').length, organizer: users.filter(u => u.role === 'organizer').length,
  }

  if (isLoading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto pb-20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} users across all roles.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAddModal}>
          <UserPlus className="size-3.5" /> Add User
        </Button>
      </div>

      <div className="flex items-center gap-1 border-b border-border pb-0 overflow-x-auto">
        {(['all', 'student', 'faculty', 'staff', 'organizer', 'admin'] as RoleFilter[]).map((r) => (
          <button key={r} onClick={() => setRoleFilter(r)} className={cn('px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap', roleFilter === r ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {r === 'all' ? 'All' : roleConfig[r as Role].label}
            <span className={cn('ml-1.5 text-xs rounded-full px-1.5 py-0.5 font-medium', roleFilter === r ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{roleCounts[r]}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Search users by name or email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">User</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Department</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Role</th>
              <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Status</th>
              <th className="px-5 py-3 text-right font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((user) => {
              const roleCfg = roleConfig[user.role]
              const secondaryRoles = (user.roles ?? [])
                .filter((item) => !item.isPrimary)
                .map((item) => item.name)
              return (
                <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold uppercase flex-shrink-0">
                        {user.name ? user.name.substring(0,2) : '?'}
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
                      {secondaryRoles.length > 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          {secondaryRoles.join(', ')}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openEditModal(user)} className="cursor-pointer">
                          <Edit className="mr-2 size-4" /> Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportPdf(user)} className="cursor-pointer">
                          <Download className="mr-2 size-4" /> Export PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setUserToDelete(user)} className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50">
                          <Trash2 className="mr-2 size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Users className="size-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No users found.</p>
          </div>
        )}
      </div>

      <AddUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchUsers} userToEdit={userToEdit} />

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete <b>{userToDelete?.name}</b>'s account and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
