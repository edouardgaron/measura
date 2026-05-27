// components/ui/separator.tsx
'use client'

import * as React from 'react'
import * as RadixSeparator from '@radix-ui/react-separator'
import { cn } from '@/lib/utils/cn'

const Separator = React.forwardRef<
  React.ElementRef<typeof RadixSeparator.Root>,
  React.ComponentPropsWithoutRef<typeof RadixSeparator.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <RadixSeparator.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-neutral-200 dark:bg-neutral-800',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className
    )}
    {...props}
  />
))

Separator.displayName = RadixSeparator.Root.displayName

export { Separator }
