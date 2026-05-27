// components/auth/AuthGuard.tsx
import { redirect } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/supabase/types'

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: UserRole
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  client: 0,
  entrepreneur: 1,
  admin: 2,
}

function hasRequiredRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export async function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (requiredRole) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null; error: unknown }

    const userRole: UserRole = (profileData?.role as UserRole | undefined) ?? 'client'

    if (!hasRequiredRole(userRole, requiredRole)) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Access Denied
            </h1>
            <p className="mt-2 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
              You do not have permission to view this page. This area requires{' '}
              <strong className="font-semibold capitalize text-neutral-700 dark:text-neutral-300">
                {requiredRole}
              </strong>{' '}
              access or higher.
            </p>
          </div>
          <a
            href="/dashboard"
            className="mt-2 text-sm font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
          >
            Return to Dashboard
          </a>
        </div>
      )
    }
  }

  return <>{children}</>
}
