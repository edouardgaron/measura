// components/ui/select.tsx
'use client'

import * as React from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const Select = RadixSelect.Root
const SelectGroup = RadixSelect.Group
const SelectValue = RadixSelect.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger>
>(({ className, children, ...props }, ref) => (
  <RadixSelect.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm',
      'text-neutral-900 placeholder:text-neutral-400',
      'transition-colors duration-150',
      'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
      'dark:focus:ring-blue-400',
      '[&>span]:line-clamp-1',
      className
    )}
    {...props}
  >
    {children}
    <RadixSelect.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
    </RadixSelect.Icon>
  </RadixSelect.Trigger>
))
SelectTrigger.displayName = RadixSelect.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof RadixSelect.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <RadixSelect.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </RadixSelect.ScrollUpButton>
))
SelectScrollUpButton.displayName = RadixSelect.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof RadixSelect.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <RadixSelect.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </RadixSelect.ScrollDownButton>
))
SelectScrollDownButton.displayName = RadixSelect.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Content>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <RadixSelect.Portal>
    <RadixSelect.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg',
        'dark:border-neutral-800 dark:bg-neutral-900',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      {...props}
    >
      <SelectScrollUpButton />
      <RadixSelect.Viewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </RadixSelect.Viewport>
      <SelectScrollDownButton />
    </RadixSelect.Content>
  </RadixSelect.Portal>
))
SelectContent.displayName = RadixSelect.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Label>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Label>
>(({ className, ...props }, ref) => (
  <RadixSelect.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400', className)}
    {...props}
  />
))
SelectLabel.displayName = RadixSelect.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(({ className, children, ...props }, ref) => (
  <RadixSelect.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm',
      'text-neutral-700 outline-none dark:text-neutral-300',
      'focus:bg-neutral-100 focus:text-neutral-900 dark:focus:bg-neutral-800 dark:focus:text-neutral-100',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <RadixSelect.ItemIndicator>
        <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </RadixSelect.ItemIndicator>
    </span>
    <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
  </RadixSelect.Item>
))
SelectItem.displayName = RadixSelect.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof RadixSelect.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixSelect.Separator>
>(({ className, ...props }, ref) => (
  <RadixSelect.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-neutral-200 dark:bg-neutral-800', className)}
    {...props}
  />
))
SelectSeparator.displayName = RadixSelect.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
