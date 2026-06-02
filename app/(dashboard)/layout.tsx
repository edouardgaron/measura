// app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopNav } from '@/components/layout/TopNav'
import type { Profile, UserRole } from '@/lib/supabase/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fall back to a minimal profile shape if the row doesn't exist yet
  const resolvedProfile: Profile = profile ?? {
    id: user.id,
    role: 'entrepreneur' as UserRole,
    full_name: user.user_metadata?.full_name ?? null,
    company_name: user.user_metadata?.company_name ?? null,
    phone: null,
    avatar_url: null,
    locale: 'fr',
    created_at: user.created_at,
    updated_at: user.created_at,
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <TopNav user={resolvedProfile} email={user.email ?? null} />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
