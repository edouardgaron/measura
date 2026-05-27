// components/ui/input.tsx
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, type = 'text', ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          className={cn(
            'h-9 w-full rounded-md border px-3 py-2 text-sm',
            'bg-white text-neutral-900 placeholder:text-neutral-400',
            'border-neutral-300 shadow-sm',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:border-blue-500',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-50',
            'dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700 dark:placeholder:text-neutral-500',
            'dark:focus-visible:ring-blue-400 dark:disabled:bg-neutral-800',
            error && 'border-red-500 focus-visible:ring-red-500 dark:border-red-500',
            className
          )}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-xs text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p
            id={`${inputId}-helper`}
            className="text-xs text-neutral-500 dark:text-neutral-400"
          >
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
