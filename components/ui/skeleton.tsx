// components/ui/skeleton.tsx
import { cn } from '@/lib/utils/cn'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render as a circle (useful for avatars) */
  circle?: boolean
}

function Skeleton({ className, circle = false, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-neutral-200 dark:bg-neutral-800',
        circle ? 'rounded-full' : 'rounded-md',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
