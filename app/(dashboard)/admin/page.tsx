// app/(dashboard)/admin/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FolderOpen, Shield, Database } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const [
    { count: totalUsers },
    { count: totalProjects },
    { count: entrepreneurs },
    { count: clients },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'entrepreneur'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
  ])

  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  const stats = [
    { label: 'Total utilisateurs', value: totalUsers ?? 0, icon: Users, color: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200' },
    { label: 'Entrepreneurs', value: entrepreneurs ?? 0, icon: Shield, color: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400' },
    { label: 'Clients', value: clients ?? 0, icon: Users, color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
    { label: 'Projets totaux', value: totalProjects ?? 0, icon: FolderOpen, color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 flex items-center justify-center">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Administration</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Vue d'ensemble de la plateforme</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <CardContent className="p-5">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${stat.color} mb-3`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stat.value}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
            <Database className="h-5 w-5" />
            Utilisateurs récents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">Nom</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">Rôle</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">Entreprise</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {(recentUsers ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="py-3 px-4 font-medium text-neutral-900 dark:text-neutral-100">{u.full_name ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                        u.role === 'entrepreneur' ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400' :
                        'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-500 dark:text-neutral-400">{u.company_name ?? '—'}</td>
                    <td className="py-3 px-4 text-neutral-500 dark:text-neutral-400">
                      {new Date(u.created_at).toLocaleDateString('fr-CA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
