// components/ui/avatar.tsx
'use client'

import * as React from 'react'
import * as RadixAvatar from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils/cn'

const Avatar = React.forwardRef<
  React.ElementRef<typeof RadixAvatar.Root>,
  React.ComponentPropsWithoutRef<typeof RadixAvatar.Root>
>(({ className, ...props }, ref) => (
  <RadixAvatar.Root
    ref={ref}
    className={cn(
      'relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full',
      className
    )}
    {...props}
  />
))
Avatar.displayName = RadixAvatar.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof RadixAvatar.Image>,
  React.ComponentPropsWithoutRef<typeof RadixAvatar.Image>
>(({ className, ...props }, ref) => (
  <RadixAvatar.Image
    ref={ref}
    className={cn('aspect-square h-full w-full object-cover', className)}
    {...props}
  />
))
AvatarImage.displayName = RadixAvatar.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof RadixAvatar.Fallback>,
  React.ComponentPropsWithoutRef<typeof RadixAvatar.Fallback>
>(({ className, ...props }, ref) => (
  <RadixAvatar.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full',
      'bg-blue-600 text-white text-sm font-semibold select-none',
      'dark:bg-blue-700',
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = RadixAvatar.Fallback.displayName

/** Derive up-to-2-character initials from a display name */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export interface UserAvatarProps {
  src?: string | null
  name?: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
}

/** Convenience component that handles image + initials fallback */
function UserAvatar({ src, name, className, size = 'md' }: UserAvatarProps) {
  return (
    <Avatar className={cn(sizeMap[size], className)}>
      {src && <AvatarImage src={src} alt={name ?? 'User avatar'} />}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  )
}

export { Avatar, AvatarImage, AvatarFallback, UserAvatar }
