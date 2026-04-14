import Image from 'next/image'
import { cn } from '@/lib/utils'

interface CampusFlowLogoProps {
  containerClassName?: string
  imageClassName?: string
  priority?: boolean
}

export function CampusFlowLogo({
  containerClassName,
  imageClassName,
  priority = false,
}: CampusFlowLogoProps) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-lg',
        containerClassName
      )}
    >
      <Image
        src="/campusflow-logo.svg"
        alt="CampusFlow logo"
        width={64}
        height={64}
        priority={priority}
        className={cn('h-auto w-[82%] object-contain', imageClassName)}
      />
    </div>
  )
}
