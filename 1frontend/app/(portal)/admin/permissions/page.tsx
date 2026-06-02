'use client'

import { useState, useEffect, useCallback } from 'react'
import { TopScrollTable } from '@/components/ui/top-scroll-table'
import { Input } from '@/components/ui/input'
import { Search, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/lib/i18n'

interface Permission {
  id: string
  name: string
  description: string
}

export default function PermissionsPage() {
  const { t } = useI18n()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'

  const fetchPermissions = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${backendUrl}/admin/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setPermissions(await res.json())
      else toast.error(t('permissions.noPermissions'))
    } catch (error) {
      console.error('API Error:', error)
      toast.error(t('permissions.noPermissions'))
    } finally {
      setIsLoading(false)
    }
  }, [backendUrl, t])

  useEffect(() => { fetchPermissions() }, [fetchPermissions])

  // Group permissions by their prefix (e.g. "users.read" → "users")
  const getGroup = (name: string) => {
    const parts = name.split('.')
    return parts.length > 1 ? parts[0].toUpperCase() : 'GENERAL'
  }

  const filtered = permissions.filter(
    (p) =>
      search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()),
  )

  // Build grouped structure for display
  const groups = filtered.reduce<Record<string, Permission[]>>((acc, perm) => {
    const group = getGroup(perm.name)
    if (!acc[group]) acc[group] = []
    acc[group].push(perm)
    return acc
  }, {})

  const sortedGroupKeys = Object.keys(groups).sort()

  if (isLoading)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('permissions.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('permissions.countSubtitle', { count: permissions.length, suffix: permissions.length !== 1 ? 's' : '' })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted border border-border text-xs text-muted-foreground font-medium">
          <ShieldCheck className="size-3.5" />
          {t('permissions.systemDefined')}
        </div>
      </div>

      {/* Search + Stats bar */}
      <div className="flex items-center gap-4 bg-card border border-border p-3 rounded-lg shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('permissions.searchDetailed')}
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4 text-sm ml-auto">
          <span className="text-muted-foreground">
            {t('permissions.shown', { shown: filtered.length, total: permissions.length })}
          </span>
          <span className="text-muted-foreground">
            {t('permissions.groups', { count: sortedGroupKeys.length, suffix: sortedGroupKeys.length !== 1 ? 's' : '' })}
          </span>
        </div>
      </div>

      {/* Grouped permission cards */}
      {sortedGroupKeys.length > 0 ? (
        <div className="space-y-4">
          {sortedGroupKeys.map((group) => (
            <div key={group} className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
              {/* Group header */}
              <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center gap-2">
                <div className="size-5 rounded flex items-center justify-center bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
                  <ShieldCheck className="size-3" />
                </div>
                <span className="text-xs font-bold tracking-wider text-muted-foreground">{group}</span>
                <span className="ml-auto text-xs text-muted-foreground">{t('permissions.permissionCount', { count: groups[group].length, suffix: groups[group].length !== 1 ? 's' : '' })}</span>
              </div>

              {/* Permissions in group */}
              <TopScrollTable>
              <table className="w-full text-sm min-w-[600px]">
                <tbody className="divide-y divide-border">
                  {groups[group].map((perm) => (
                    <tr key={perm.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 w-1/3">
                        <code className="text-xs font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded border border-border">
                          {perm.name}
                        </code>
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        {perm.description || <span className="italic text-muted-foreground/60">{t('permissions.noDescription')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </TopScrollTable>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-card border border-border rounded-lg shadow-sm">
          <ShieldCheck className="size-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('permissions.noSearchResults')}</p>
        </div>
      )}
    </div>
  )
}
