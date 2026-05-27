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

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-blue-600 text-white shadow hover:bg-blue-700 active:bg-blue-800 focus-visible:ring-blue-500',
  destructive:
    'bg-red-600 text-white shadow hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500',
  outline:
    'border border-neutral-300 bg-white text-neutral-900 shadow-sm hover:bg-neutral-50 active:bg-neutral-100 focus-visible:ring-blue-500',
  ghost:
    'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-blue-500',
  link:
    'text-blue-600 underline-offset-4 hover:underline focus-visible:ring-blue-500',
  secondary:
    'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 focus-visible:ring-blue-500',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
  md: 'h-9 px-4 text-sm rounded-md gap-2',
  lg: 'h-11 px-6 text-base rounded-lg gap-2',
  icon: 'h-9 w-9 rounded-md',
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
