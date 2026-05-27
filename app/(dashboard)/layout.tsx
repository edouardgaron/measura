// app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
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

  const locale: 'fr' | 'en' = resolvedProfile.locale ?? 'fr'

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <Sidebar role={resolvedProfile.role} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header user={resolvedProfile} locale={locale} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
