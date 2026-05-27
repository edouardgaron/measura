// components/ui/progress.tsx
'use client'

import * as React from 'react'
import * as RadixProgress from '@radix-ui/react-progress'
import { cn } from '@/lib/utils/cn'

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof RadixProgress.Root> {
  /** Value between 0 and 100 */
  value?: number
  /** Show percentage label inside or next to bar */
  showLabel?: boolean
}

const Progress = React.forwardRef<
  React.ElementRef<typeof RadixProgress.Root>,
  ProgressProps
>(({ className, value = 0, showLabel = false, ...props }, ref) => {
  const clamped = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('flex items-center gap-3 w-full', className)}>
      <RadixProgress.Root
        ref={ref}
        value={clamped}
        className={cn(
          'relative h-2 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700'
        )}
        {...props}
      >
        <RadixProgress.Indicator
          className="h-full bg-blue-600 transition-all duration-500 ease-in-out dark:bg-blue-500"
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </RadixProgress.Root>
      {showLabel && (
        <span className="shrink-0 text-xs font-medium tabular-nums text-neutral-600 dark:text-neutral-400 w-9 text-right">
          {clamped}%
        </span>
      )}
    </div>
  )
})

Progress.displayName = RadixProgress.Root.displayName

export { Progress }
