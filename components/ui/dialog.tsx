// components/ui/dialog.tsx
'use client'

import * as React from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const Dialog = RadixDialog.Root
const DialogTrigger = RadixDialog.Trigger
const DialogClose = RadixDialog.Close
const DialogPortal = RadixDialog.Portal

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Overlay>
>(({ className, ...props }, ref) => (
  <RadixDialog.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out',
      'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = RadixDialog.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Content>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <RadixDialog.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
        'w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-6 shadow-xl',
        'dark:border-neutral-800 dark:bg-neutral-900',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        'duration-200',
        className
      )}
      {...props}
    >
      {children}
      <RadixDialog.Close
        className={cn(
          'absolute right-4 top-4 rounded-md p-1',
          'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          'disabled:pointer-events-none'
        )}
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </RadixDialog.Close>
    </RadixDialog.Content>
  </DialogPortal>
))
DialogContent.displayName = RadixDialog.Content.displayName

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 mb-4', className)}
      {...props}
    />
  )
}
DialogHeader.displayName = 'DialogHeader'

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 mt-6 sm:flex-row sm:justify-end',
        className
      )}
      {...props}
    />
  )
}
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Title>
>(({ className, ...props }, ref) => (
  <RadixDialog.Title
    ref={ref}
    className={cn('text-lg font-semibold text-neutral-900 dark:text-neutral-100', className)}
    {...props}
  />
))
DialogTitle.displayName = RadixDialog.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof RadixDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RadixDialog.Description>
>(({ className, ...props }, ref) => (
  <RadixDialog.Description
    ref={ref}
    className={cn('text-sm text-neutral-500 dark:text-neutral-400', className)}
    {...props}
  />
))
DialogDescription.displayName = RadixDialog.Description.displayName

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
}
