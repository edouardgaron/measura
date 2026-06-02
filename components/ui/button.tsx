// components/ui/button.tsx
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils/cn'

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost' | 'link' | 'secondary'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  loading?: boolean
}

// Hover look: solid ink pills, soft grey secondaries, hairline outlines.
const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-neutral-900 text-white hover:bg-neutral-800 active:bg-black focus-visible:ring-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 dark:focus-visible:ring-neutral-100',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500',
  outline:
    'border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 active:bg-neutral-100 focus-visible:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800',
  ghost:
    'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800',
  link:
    'text-neutral-900 underline-offset-4 hover:underline focus-visible:ring-neutral-900 dark:text-neutral-100',
  secondary:
    'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus-visible:ring-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
}

// Fully rounded "pill" sizing to match Hover.
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-xs rounded-full gap-1.5',
  md: 'h-10 px-5 text-sm rounded-full gap-2',
  lg: 'h-12 px-7 text-base rounded-full gap-2',
  icon: 'h-10 w-10 rounded-full',
}

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium whitespace-nowrap',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? <><Spinner />{children}</> : children}
      </Comp>
    )
  }
)

Button.displayName = 'Button'

export { Button }
