// components/ui/badge.tsx
import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { makeT, type Locale, type TranslationKey } from '@/lib/i18n'
import type { ProjectStatus } from '@/lib/supabase/types'

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'outline'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  default:
    'bg-neutral-900 text-white border-transparent',
  secondary:
    'bg-neutral-100 text-neutral-700 border-transparent dark:bg-neutral-800 dark:text-neutral-300',
  success:
    'bg-green-100 text-green-800 border-transparent dark:bg-green-900/30 dark:text-green-400',
  warning:
    'bg-amber-100 text-amber-800 border-transparent dark:bg-amber-900/30 dark:text-amber-400',
  destructive:
    'bg-red-100 text-red-800 border-transparent dark:bg-red-900/30 dark:text-red-400',
  outline:
    'bg-transparent text-neutral-700 border-neutral-300 dark:text-neutral-300 dark:border-neutral-700',
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        'transition-colors',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  )
}

/** Map a ProjectStatus to the appropriate badge variant */
export function statusVariant(status: ProjectStatus): BadgeVariant {
  const map: Record<ProjectStatus, BadgeVariant> = {
    draft: 'secondary',
    photos_pending: 'warning',
    measuring: 'default',
    review: 'warning',
    completed: 'success',
    archived: 'outline',
  }
  return map[status]
}

// Hover-style solid status pills (used as overlays on project cards).
const STATUS_PILL: Record<ProjectStatus, string> = {
  draft: 'bg-neutral-700 text-white',
  photos_pending: 'bg-violet-600 text-white',
  measuring: 'bg-neutral-900 text-white',
  review: 'bg-amber-500 text-white',
  completed: 'bg-emerald-600 text-white',
  archived: 'bg-neutral-400 text-white',
}

/** Render a project status as a solid Hover-style pill */
export function StatusBadge({
  status,
  className,
  locale = 'fr',
}: {
  status: ProjectStatus
  className?: string
  locale?: Locale
}) {
  const t = makeT(locale)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold shadow-sm',
        STATUS_PILL[status],
        className
      )}
    >
      {t(`projects.status.${status}` as TranslationKey)}
    </span>
  )
}

export { Badge }
