// app/(dashboard)/clients/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, FolderOpen, Mail } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'

export default async function ClientsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Récupérer tous les membres de projets (clients) liés aux projets de l'entrepreneur
  const { data: members } = await supabase
    .from('project_members')
    .select(`
      *,
      projects!inner(id, title, owner_id)
    `)
    .eq('projects.owner_id', user.id)
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  // Dédupliquer par email
  const clientMap = new Map<string, {
    email: string
    name: string | null
    projects: Array<{ id: string, title: string }>
    lastActivity: string
  }>()

  for (const m of (members ?? [])) {
    const proj = m.projects as unknown as { id: string, title: string }
    if (!clientMap.has(m.email)) {
      clientMap.set(m.email, {
        email: m.email,
        name: null,
        projects: [{ id: proj.id, title: proj.title }],
        lastActivity: m.created_at,
      })
    } else {
      clientMap.get(m.email)!.projects.push({ id: proj.id, title: proj.title })
    }
  }

  const clients = Array.from(clientMap.values())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">{clients.length} client{clients.length !== 1 ? 's' : ''} au total</p>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Aucun client pour l'instant</h2>
          <p className="text-gray-500 mt-1 max-w-sm">
            Vos clients apparaîtront ici une fois que vous les aurez invités à un projet.
          </p>
          <Link href="/dashboard/projects/new" className="mt-4">
            <Button>Créer un projet</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.email} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-700">
                      {client.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{client.email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {client.projects.length} projet{client.projects.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  {client.projects.slice(0, 2).map((proj) => (
                    <Link
                      key={proj.id}
                      href={`/dashboard/projects/${proj.id}`}
                      className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <FolderOpen className="h-3 w-3" />
                      {proj.title}
                    </Link>
                  ))}
                  {client.projects.length > 2 && (
                    <span className="text-xs text-gray-400">
                      +{client.projects.length - 2} autres projets
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100">
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Envoyer un courriel
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
