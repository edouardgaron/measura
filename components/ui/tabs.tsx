// components/ui/tabs.tsx
'use client'

import * as React from 'react'
import * as RadixTabs from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils/cn'

const Tabs = RadixTabs.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List>
>(({ className, ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn(
      'flex items-end gap-0 border-b border-neutral-200 dark:border-neutral-800',
      className
    )}
    {...props}
  />
))
TabsList.displayName = RadixTabs.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(({ className, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium',
      'text-neutral-500 transition-colors duration-150',
      'hover:text-neutral-900 dark:hover:text-neutral-100',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset',
      'disabled:pointer-events-none disabled:opacity-50',
      // Active indicator via bottom border
      'border-b-2 border-transparent -mb-px',
      'data-[state=active]:border-blue-600 data-[state=active]:text-blue-600',
      'dark:data-[state=active]:border-blue-400 dark:data-[state=active]:text-blue-400',
      'dark:text-neutral-400',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = RadixTabs.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className, ...props }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = RadixTabs.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
