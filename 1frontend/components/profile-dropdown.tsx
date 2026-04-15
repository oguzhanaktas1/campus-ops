'use client'

import { useRouter } from 'next/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, Settings } from 'lucide-react'
import type { User as UserType } from '@/lib/mock-data'
import { apiLogout, clearAuth } from '@/lib/auth'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NT } from '@/components/no-translate'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

interface ProfileDropdownProps {
  user: UserType
  settingsHref?: string
}

export function ProfileDropdown({ user, settingsHref = '/student/settings' }: ProfileDropdownProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await apiLogout()
    clearAuth()
    router.push('/login')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2 h-8 px-2">
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <NT className="text-sm font-medium hidden sm:block max-w-[120px] truncate">{user.name}</NT>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <NT as="p" className="text-sm font-medium">{user.name}</NT>
            <NT as="p" className="text-xs text-muted-foreground">{user.email}</NT>
            {user.department && (
              <NT as="p" className="text-xs text-muted-foreground">{user.department}</NT>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(settingsHref)} className="cursor-pointer">
          <Settings className="size-4 mr-2" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="size-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
