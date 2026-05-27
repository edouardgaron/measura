// app/(dashboard)/projects/[projectId]/settings/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Trash2, Archive, UserPlus, Crown, Edit3, User } from 'lucide-react'

/* ---------- Schemas ---------- */
const projectSchema = z.object({
  title: z.string().min(2, 'Au moins 2 caractères').max(100),
  address_line1: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_province: z.string().max(100).optional(),
  address_postal: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['draft', 'photos_pending', 'measuring', 'review', 'completed']),
  unit_system: z.enum(['metric', 'imperial']),
})
type ProjectFormValues = z.infer<typeof projectSchema>

const inviteSchema = z.object({ email: z.string().email('Courriel invalide') })
type InviteFormValues = z.infer<typeof inviteSchema>

/* ---------- Types ---------- */
interface Member {
  id: string
  email: string
  role: 'owner' | 'editor' | 'client'
  invite_accepted_at: string | null
}

interface Props {
  params: Promise<{ projectId: string }>
}

/* ---------- Component ---------- */
export default function SettingsPage({ params }: Props) {
  const { projectId } = use(params)
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [dangerLoading, setDangerLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
  })

  const {
    register: registerInvite,
    handleSubmit: handleInviteSubmit,
    reset: resetInvite,
    formState: { errors: inviteErrors },
  } = useForm<InviteFormValues>({ resolver: zodResolver(inviteSchema) })

  /* ---- Load project ---- */
  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) return
      const { project } = await res.json()
      reset({
        title: project.title ?? '',
        address_line1: project.address_line1 ?? '',
        address_city: project.address_city ?? '',
        address_province: project.address_province ?? '',
        address_postal: project.address_postal ?? '',
        notes: project.notes ?? '',
        status: project.status,
        unit_system: project.unit_system,
      })
      setMembers(project.members ?? [])
      setLoading(false)
    }
    load()
  }, [projectId, reset])

  /* ---- Save project ---- */
  async function onSave(values: ProjectFormValues) {
    setSaving(true)
    setSaveSuccess(false)
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    setSaving(false)
    if (res.ok) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  /* ---- Invite client ---- */
  async function onInvite(values: InviteFormValues) {
    setInviteLoading(true)
    setInviteSuccess(null)
    const res = await fetch(`/api/projects/${projectId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: values.email }),
    })
    setInviteLoading(false)
    if (res.ok) {
      const { inviteLink } = await res.json()
      setInviteSuccess(inviteLink)
      resetInvite()
    }
  }

  /* ---- Archive project ---- */
  async function archiveProject() {
    if (!confirm('Archiver ce projet ? Il ne sera plus visible dans la liste active.')) return
    setDangerLoading(true)
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
    setDangerLoading(false)
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* ---- Edit project form ---- */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-gray-900">Informations du projet</h2>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <Field label="Titre *" error={errors.title?.message}>
            <input {...register('title')} className={input()} placeholder="Mon projet" />
          </Field>

          <Field label="Adresse">
            <input {...register('address_line1')} className={input()} placeholder="123 rue Principale" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ville" error={errors.address_city?.message}>
              <input {...register('address_city')} className={input()} placeholder="Montréal" />
            </Field>
            <Field label="Province">
              <input {...register('address_province')} className={input()} placeholder="QC" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Code postal">
              <input {...register('address_postal')} className={input()} placeholder="H1A 1A1" />
            </Field>
            <Field label="Statut" error={errors.status?.message}>
              <select {...register('status')} className={input()}>
                <option value="draft">Brouillon</option>
                <option value="photos_pending">Photos requises</option>
                <option value="measuring">En mesure</option>
                <option value="review">En révision</option>
                <option value="completed">Terminé</option>
              </select>
            </Field>
          </div>

          <Field label="Système d'unités" error={errors.unit_system?.message}>
            <select {...register('unit_system')} className={input()}>
              <option value="metric">Métrique (m / cm)</option>
              <option value="imperial">Impérial (ft / in)</option>
            </select>
          </Field>

          <Field label="Notes">
            <textarea
              {...register('notes')}
              rows={4}
              className={input()}
              placeholder="Notes internes..."
            />
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </button>
            {saveSuccess && (
              <span className="text-sm text-green-600">Modifications enregistrées</span>
            )}
          </div>
        </form>
      </section>

      {/* ---- Invite client ---- */}
      <section id="invite" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold text-gray-900">Inviter un client</h2>
        </div>

        <form onSubmit={handleInviteSubmit(onInvite)} className="flex items-start gap-2">
          <div className="flex-1">
            <input
              {...registerInvite('email')}
              type="email"
              className={input()}
              placeholder="client@exemple.com"
            />
            {inviteErrors.email && (
              <p className="mt-1 text-xs text-red-600">{inviteErrors.email.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={inviteLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer'}
          </button>
        </form>

        {inviteSuccess && (
          <div className="mt-3 rounded-lg bg-green-50 p-3">
            <p className="text-xs font-medium text-green-800">Invitation envoyée ! Lien :</p>
            <p className="mt-1 break-all text-xs text-green-700">{inviteSuccess}</p>
          </div>
        )}
      </section>

      {/* ---- Members list ---- */}
      {members.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Membres du projet</h2>
          <ul className="divide-y divide-gray-100">
            {members.map((member) => {
              const RoleIcon =
                member.role === 'owner' ? Crown : member.role === 'editor' ? Edit3 : User
              const roleLabel =
                member.role === 'owner' ? 'Propriétaire' : member.role === 'editor' ? 'Éditeur' : 'Client'
              return (
                <li key={member.id} className="flex items-center gap-3 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                    {member.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{member.email}</p>
                    <p className="text-xs text-gray-500">
                      {member.invite_accepted_at ? 'Actif' : 'Invitation en attente'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    <RoleIcon className="h-3.5 w-3.5" />
                    {roleLabel}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ---- Danger zone ---- */}
      <section className="rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-red-700">Zone dangereuse</h2>
        <p className="mb-4 text-sm text-gray-500">
          Ces actions sont irréversibles ou difficiles à annuler.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={archiveProject}
            disabled={dangerLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-60 transition-colors"
          >
            {dangerLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Archiver le projet
          </button>
          <button
            disabled={dangerLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors"
            onClick={() => alert('La suppression définitive nécessite une confirmation par courriel.')}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer le projet
          </button>
        </div>
      </section>
    </div>
  )
}

/* --- Helpers --- */
function input() {
  return 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
