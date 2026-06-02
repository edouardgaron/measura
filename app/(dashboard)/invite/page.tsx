// app/(dashboard)/invite/page.tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, CheckCircle2 } from 'lucide-react'

const FIELD =
  'h-12 w-full rounded-xl border border-transparent bg-neutral-100 px-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus-visible:bg-neutral-900 dark:focus-visible:ring-neutral-100'

export default function InvitePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<{ projectId: string } | null>(null)

  const [form, setForm] = React.useState({
    propertyName: '',
    recipientType: 'homeowner',
    recipientName: '',
    leadNumber: '',
    phone: '',
    email: '',
    address: '',
    deliverable: 'measurements',
    captureNow: false,
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.propertyName.trim()) {
      setError('Le nom de la propriété est requis.')
      return
    }
    if (!form.email.trim()) {
      setError('Le courriel du destinataire est requis.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Create the project for this capture request
      const createRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.propertyName.trim(),
          address_line1: form.address.trim() || undefined,
          notes: form.recipientName
            ? `Capture demandée à ${form.recipientName}${form.phone ? ` (${form.phone})` : ''}`
            : undefined,
        }),
      })

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erreur lors de la création du projet.')
      }

      const { project } = await createRes.json()

      // 2. Invite the recipient to capture (client portal upload link)
      const inviteRes = await fetch(`/api/projects/${project.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), role: 'client' }),
      })

      if (!inviteRes.ok) {
        const data = await inviteRes.json().catch(() => ({}))
        throw new Error(data.error ?? "Projet créé mais l'invitation a échoué.")
      }

      setDone({ projectId: project.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Invitation envoyée</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {form.recipientName || form.email} recevra un lien pour capturer la propriété.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push(`/projects/${done.projectId}`)}
            className="inline-flex h-11 items-center rounded-full bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Voir le projet
          </button>
          <button
            onClick={() => router.push('/projects')}
            className="inline-flex h-11 items-center rounded-full bg-neutral-100 px-5 text-sm font-medium text-neutral-800 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            Tous les projets
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => router.back()}
        aria-label="Fermer"
        className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="grid gap-12 py-6 lg:grid-cols-2">
        {/* Left — intro */}
        <div className="lg:pr-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-5xl">
            Inviter à capturer
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            Invitez un propriétaire ou un professionnel à capturer une propriété.
            Un texto et un courriel, avec jusqu&apos;à deux rappels, leur seront
            envoyés. En continuant, vous confirmez avoir consenti à l&apos;envoi de
            ces messages.
          </p>
        </div>

        {/* Right — form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            className={FIELD}
            placeholder="Nom de la propriété"
            value={form.propertyName}
            onChange={(e) => update('propertyName', e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Type de destinataire</label>
            <select
              className={FIELD}
              value={form.recipientType}
              onChange={(e) => update('recipientType', e.target.value)}
            >
              <option value="homeowner">Propriétaire</option>
              <option value="professional">Professionnel</option>
            </select>
          </div>

          <input
            className={FIELD}
            placeholder="Nom du destinataire"
            value={form.recipientName}
            onChange={(e) => update('recipientName', e.target.value)}
          />
          <input
            className={FIELD}
            placeholder="Numéro de dossier (optionnel)"
            value={form.leadNumber}
            onChange={(e) => update('leadNumber', e.target.value)}
          />
          <input
            className={FIELD}
            type="tel"
            placeholder="Numéro de téléphone"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
          />
          <input
            className={FIELD}
            type="email"
            placeholder="Courriel"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
          <input
            className={FIELD}
            placeholder="Adresse"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Type de livrable</label>
            <select
              className={FIELD}
              value={form.deliverable}
              onChange={(e) => update('deliverable', e.target.value)}
            >
              <option value="measurements">Mesures</option>
              <option value="design3d">Design 3D</option>
              <option value="estimate">Estimation</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 pt-1">
            <input
              type="checkbox"
              checked={form.captureNow}
              onChange={(e) => update('captureNow', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 accent-neutral-900"
            />
            <span className="text-sm text-neutral-600 dark:text-neutral-300">
              Capturez maintenant. Payez plus tard. Enregistrez les photos
              maintenant. Commandez et payez quand vous êtes prêt.
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/projects/new')}
              className="text-sm font-semibold text-neutral-900 hover:underline dark:text-neutral-100"
            >
              Téléverser
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-11 items-center rounded-full border border-neutral-200 bg-white px-5 text-sm font-medium text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Annuler la demande
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-neutral-900 px-6 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Envoyer l&apos;invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
