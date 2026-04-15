import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

/**
 * Google Translate'ten korunan alan.
 * Marka adı (CampusFlow), kullanıcı adı/soyadı, e-posta,
 * bio, istek numarası gibi alanlar çevrilmemeli.
 *
 * Kullanım:
 *   <NT>{user.name}</NT>
 *   <NT as="p">{bio}</NT>
 */
interface NTProps extends HTMLAttributes<HTMLElement> {
  as?: keyof JSX.IntrinsicElements
  children: React.ReactNode
}

export function NT({ as: Tag = 'span', children, className, ...props }: NTProps) {
  return (
    // @ts-expect-error — translate is a valid HTML attr, React types may lag
    <Tag
      translate="no"
      className={cn('notranslate', className)}
      {...props}
    >
      {children}
    </Tag>
  )
}
