// app/(dashboard)/clients/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, FolderOpen, Mail } from 'lucide-react'
import { getLocale } from '@/lib/i18n/server'
import { makeT } from '@/lib/i18n'

export default async function ClientsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const T = makeT(await getLocale())

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
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{T('clients.title')}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{T('clients.total', { n: clients.length })}</p>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-neutral-500 dark:text-neutral-400" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{T('clients.empty.title')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
            {T('clients.empty.sub')}
          </p>
          <Link href="/projects/new" className="mt-4">
            <Button>{T('clients.empty.cta')}</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.email} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
                      {client.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{client.email}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <FolderOpen className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {T('clients.projects', { n: client.projects.length })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  {client.projects.slice(0, 2).map((proj) => (
                    <Link
                      key={proj.id}
                      href={`/projects/${proj.id}`}
                      className="flex items-center gap-2 text-xs text-neutral-700 hover:text-neutral-900 hover:underline dark:text-neutral-300 dark:hover:text-neutral-100"
                    >
                      <FolderOpen className="h-3 w-3" />
                      {proj.title}
                    </Link>
                  ))}
                  {client.projects.length > 2 && (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      {T('clients.more', { n: client.projects.length - 2 })}
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {T('clients.sendEmail')}
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
