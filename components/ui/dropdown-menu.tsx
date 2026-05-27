// components/ui/dropdown-menu.tsx
'use client'

import * as React from 'react'
import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const DropdownMenu = RadixDropdownMenu.Root
const DropdownMenuTrigger = RadixDropdownMenu.Trigger
const DropdownMenuGroup = RadixDropdownMenu.Group
const DropdownMenuPortal = RadixDropdownMenu.Portal
const DropdownMenuSub = RadixDropdownMenu.Sub
const DropdownMenuRadioGroup = RadixDropdownMenu.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <RadixDropdownMenu.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm',
      'text-neutral-700 outline-none dark:text-neutral-300',
      'focus:bg-neutral-100 data-[state=open]:bg-neutral-100',
      'dark:focus:bg-neutral-800 dark:data-[state=open]:bg-neutral-800',
      inset && 'pl-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-4 w-4" />
  </RadixDropdownMenu.SubTrigger>
))
DropdownMenuSubTrigger.displayName = RadixDropdownMenu.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.SubContent>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.SubContent>
>(({ className, ...props }, ref) => (
  <RadixDropdownMenu.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[8rem] overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-lg',
      'dark:border-neutral-800 dark:bg-neutral-900',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
      'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
      'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName = RadixDropdownMenu.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <RadixDropdownMenu.Portal>
    <RadixDropdownMenu.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[10rem] overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-lg',
        'dark:border-neutral-800 dark:bg-neutral-900',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
        'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </RadixDropdownMenu.Portal>
))
DropdownMenuContent.displayName = RadixDropdownMenu.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Item>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <RadixDropdownMenu.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm',
      'text-neutral-700 outline-none transition-colors dark:text-neutral-300',
      'focus:bg-neutral-100 focus:text-neutral-900 dark:focus:bg-neutral-800 dark:focus:text-neutral-100',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = RadixDropdownMenu.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <RadixDropdownMenu.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm',
      'text-neutral-700 outline-none transition-colors dark:text-neutral-300',
      'focus:bg-neutral-100 focus:text-neutral-900 dark:focus:bg-neutral-800 dark:focus:text-neutral-100',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <RadixDropdownMenu.ItemIndicator>
        <Check className="h-4 w-4" />
      </RadixDropdownMenu.ItemIndicator>
    </span>
    {children}
  </RadixDropdownMenu.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = RadixDropdownMenu.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.RadioItem>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.RadioItem>
>(({ className, children, ...props }, ref) => (
  <RadixDropdownMenu.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm',
      'text-neutral-700 outline-none transition-colors dark:text-neutral-300',
      'focus:bg-neutral-100 focus:text-neutral-900 dark:focus:bg-neutral-800 dark:focus:text-neutral-100',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <RadixDropdownMenu.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </RadixDropdownMenu.ItemIndicator>
    </span>
    {children}
  </RadixDropdownMenu.RadioItem>
))
DropdownMenuRadioItem.displayName = RadixDropdownMenu.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Label>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <RadixDropdownMenu.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = RadixDropdownMenu.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof RadixDropdownMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>
>(({ className, ...props }, ref) => (
  <RadixDropdownMenu.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-neutral-200 dark:bg-neutral-800', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = RadixDropdownMenu.Separator.displayName

function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest text-neutral-400 dark:text-neutral-500', className)}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut'

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
