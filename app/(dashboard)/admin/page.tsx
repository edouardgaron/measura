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
    { label: 'Total utilisateurs', value: totalUsers ?? 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Entrepreneurs', value: entrepreneurs ?? 0, icon: Shield, color: 'bg-purple-50 text-purple-600' },
    { label: 'Clients', value: clients ?? 0, icon: Users, color: 'bg-green-50 text-green-600' },
    { label: 'Projets totaux', value: totalProjects ?? 0, icon: FolderOpen, color: 'bg-orange-50 text-orange-600' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
          <Shield className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
          <p className="text-gray-500 text-sm">Vue d'ensemble de la plateforme</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${stat.color} mb-3`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Utilisateurs récents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Nom</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Rôle</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Entreprise</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {(recentUsers ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{u.full_name ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-red-100 text-red-700' :
                        u.role === 'entrepreneur' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{u.company_name ?? '—'}</td>
                    <td className="py-3 px-4 text-gray-500">
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
