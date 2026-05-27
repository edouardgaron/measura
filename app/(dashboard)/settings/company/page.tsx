// app/(dashboard)/settings/company/page.tsx
'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Save,
  Upload,
  Building2,
  Users,
  CreditCard,
  Ruler,
  Percent,
  DollarSign,
  UserPlus,
  Loader2,
  X,
  Crown,
  Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toast'
import type { Company, CompanyMember, CompanyMemberRole } from '@/lib/supabase/types'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const companySchema = z.object({
  name:          z.string().min(1, 'Le nom est requis').max(100),
  phone:         z.string().max(20).optional().or(z.literal('')),
  email:         z.string().email('Courriel invalide').optional().or(z.literal('')),
  website:       z.string().url('URL invalide').optional().or(z.literal('')),
  address_line1: z.string().max(200).optional().or(z.literal('')),
  address_city:  z.string().max(100).optional().or(z.literal('')),
  address_province: z.string().max(100).optional().or(z.literal('')),
  address_postal:   z.string().max(20).optional().or(z.literal('')),
})

type CompanyForm = z.infer<typeof companySchema>

// ─── Section nav ──────────────────────────────────────────────────────────────

type SectionId = 'info' | 'logo' | 'taxes' | 'pricing' | 'units' | 'members' | 'subscription'

const SECTIONS: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'info',         label: 'Informations',    icon: Building2 },
  { id: 'logo',         label: 'Logo',             icon: Upload },
  { id: 'taxes',        label: 'Taxes',            icon: Percent },
  { id: 'pricing',      label: 'Prix par défaut',  icon: DollarSign },
  { id: 'units',        label: 'Unités',           icon: Ruler },
  { id: 'members',      label: 'Membres',          icon: Users },
  { id: 'subscription', label: 'Abonnement',       icon: CreditCard },
]

const ROLE_LABELS: Record<CompanyMemberRole, string> = {
  owner:     'Propriétaire',
  admin:     'Admin',
  employee:  'Employé',
  estimator: 'Estimateur',
  inspector: 'Inspecteur',
}

// ─── Member row ───────────────────────────────────────────────────────────────

type MemberWithProfile = Omit<CompanyMember, 'profile'> & {
  profile?: { id: string; full_name: string | null; avatar_url: string | null }
}

function MemberRow({ member }: { member: MemberWithProfile }) {
  const name = member.profile?.full_name ?? member.user_id
  const initials = (member.profile?.full_name ?? 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        {!member.is_active && (
          <p className="text-xs text-yellow-600">Invitation en attente</p>
        )}
      </div>
      <div className="shrink-0">
        <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
          {ROLE_LABELS[member.role]}
        </Badge>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CompanySettingsPage() {
  const supabase = React.useMemo(() => createClient(), [])

  const [activeSection, setActiveSection] = React.useState<SectionId>('info')
  const [company, setCompany] = React.useState<Company | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)

  // Logo state
  const [logoUploading, setLogoUploading] = React.useState(false)
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null)
  const [logoDragging, setLogoDragging] = React.useState(false)

  // Invite
  const [inviteEmail, setInviteEmail] = React.useState('')
  const [inviting, setInviting] = React.useState(false)

  // Tax local state (synced from company)
  const [taxGst, setTaxGst] = React.useState(5)
  const [taxQst, setTaxQst] = React.useState(9.975)
  const [laborRate, setLaborRate] = React.useState(60)
  const [markupPct, setMarkupPct] = React.useState(20)
  const [unitSystem, setUnitSystem] = React.useState<'metric' | 'imperial'>('metric')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanyForm>({ resolver: zodResolver(companySchema) })

  // ── Load company ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch('/api/company')
      const json = await res.json()

      if (json.company) {
        const c: Company = json.company
        setCompany(c)
        reset({
          name:             c.name,
          phone:            c.phone ?? '',
          email:            c.email ?? '',
          website:          c.website ?? '',
          address_line1:    c.address_line1 ?? '',
          address_city:     c.address_city ?? '',
          address_province: c.address_province ?? '',
          address_postal:   c.address_postal ?? '',
        })
        setTaxGst(c.tax_gst ?? 5)
        setTaxQst(c.tax_qst ?? 9.975)
        setLaborRate(c.default_labor_rate ?? 60)
        setMarkupPct(c.default_markup ?? 20)
        setUnitSystem(c.unit_system ?? 'metric')
      }

      setLoading(false)
    }
    load()
  }, [reset])

  // ── Create company (first-time) ───────────────────────────────────────────
  async function handleCreate() {
    setCreating(true)
    const res = await fetch('/api/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Mon entreprise' }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast({ variant: 'error', title: 'Erreur', description: json.error })
    } else {
      setCompany(json.company)
      reset({ name: json.company.name, phone: '', email: '', website: '', address_line1: '', address_city: '', address_province: '', address_postal: '' })
    }
    setCreating(false)
  }

  // ── Patch company ─────────────────────────────────────────────────────────
  async function patchCompany(patch: Record<string, unknown>) {
    if (!company) return
    const res = await fetch(`/api/company/${company.id}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const json = await res.json()
    if (!res.ok) {
      toast({ variant: 'error', title: 'Erreur', description: json.error })
    } else {
      setCompany(json.company)
      toast({ variant: 'success', title: 'Sauvegardé' })
    }
  }

  // ── Company info submit ───────────────────────────────────────────────────
  async function onSubmitInfo(values: CompanyForm) {
    await patchCompany({
      name:             values.name,
      phone:            values.phone || null,
      email:            values.email || null,
      website:          values.website || null,
      address_line1:    values.address_line1 || null,
      address_city:     values.address_city || null,
      address_province: values.address_province || null,
      address_postal:   values.address_postal || null,
    })
  }

  // ── Logo upload ───────────────────────────────────────────────────────────
  async function handleLogoFile(file: File) {
    if (!company) return
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'error', title: 'Fichier invalide', description: 'Veuillez sélectionner une image.' })
      return
    }
    const preview = URL.createObjectURL(file)
    setLogoPreview(preview)
    setLogoUploading(true)

    const ext = file.name.split('.').pop() ?? 'png'
    const path = `company-logos/${company.id}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      toast({ variant: 'error', title: 'Erreur upload', description: uploadError.message })
      setLogoUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    await patchCompany({ logo_url: urlData.publicUrl })
    setLogoUploading(false)
  }

  // ── Invite member ─────────────────────────────────────────────────────────
  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    // TODO: wire to actual invite API + email
    toast({ variant: 'info', title: 'Invitation envoyée', description: inviteEmail.trim() })
    setInviteEmail('')
    setInviting(false)
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!company) {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucune entreprise configurée</h2>
        <p className="text-gray-500 mb-6">
          Créez votre profil d&apos;entreprise pour accéder à toutes les fonctionnalités de devis et de rapports.
        </p>
        <Button onClick={handleCreate} loading={creating} className="gap-2">
          <Plus className="h-4 w-4" />
          Créer mon entreprise
        </Button>
      </div>
    )
  }

  const members = (company.members ?? []) as MemberWithProfile[]

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres de l&apos;entreprise</h1>
        <p className="text-gray-500 mt-1">Configurez votre profil d&apos;entreprise, taxes et préférences</p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200">
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeSection === s.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          )
        })}
      </div>

      {/* ── 1. Informations ── */}
      {activeSection === 'info' && (
        <Card>
          <CardHeader>
            <CardTitle>Informations entreprise</CardTitle>
            <CardDescription>Apparaissent sur vos devis et rapports PDF</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmitInfo)} className="space-y-4">
              <Input
                label="Nom de l'entreprise *"
                error={errors.name?.message}
                {...register('name')}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Téléphone"
                  type="tel"
                  placeholder="+1 (514) 000-0000"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
                <Input
                  label="Courriel"
                  type="email"
                  placeholder="info@entreprise.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </div>
              <Input
                label="Site web"
                type="url"
                placeholder="https://www.entreprise.com"
                error={errors.website?.message}
                {...register('website')}
              />
              <Input
                label="Adresse"
                placeholder="123 rue Principale"
                {...register('address_line1')}
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Ville"
                  {...register('address_city')}
                />
                <Input
                  label="Province"
                  placeholder="QC"
                  {...register('address_province')}
                />
                <Input
                  label="Code postal"
                  placeholder="H1A 0A1"
                  {...register('address_postal')}
                />
              </div>
              <Button type="submit" loading={isSubmitting} className="gap-2">
                <Save className="h-4 w-4" />
                Sauvegarder
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── 2. Logo ── */}
      {activeSection === 'logo' && (
        <Card>
          <CardHeader>
            <CardTitle>Logo de l&apos;entreprise</CardTitle>
            <CardDescription>Apparaît sur vos rapports PDF et votre portail client</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(logoPreview ?? company.logo_url) && (
              <div className="flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreview ?? company.logo_url!}
                  alt="Logo"
                  className="h-20 w-auto max-w-[200px] rounded-lg border border-gray-200 object-contain p-1 bg-white"
                />
                <button
                  type="button"
                  onClick={() => { setLogoPreview(null); patchCompany({ logo_url: null }) }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div
              onDragOver={(e) => { e.preventDefault(); setLogoDragging(true) }}
              onDragLeave={() => setLogoDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setLogoDragging(false)
                const file = e.dataTransfer.files[0]
                if (file) handleLogoFile(file)
              }}
              className={[
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 cursor-pointer transition-colors',
                logoDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
              ].join(' ')}
            >
              {logoUploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              ) : (
                <>
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-700">Glissez votre logo ici</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, SVG jusqu&apos;à 5 Mo</p>
                  <label className="mt-3 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
                    Choisir un fichier
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }}
                    />
                  </label>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 3. Taxes ── */}
      {activeSection === 'taxes' && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration des taxes</CardTitle>
            <CardDescription>Taxes applicables sur vos devis et factures</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">TPS — Taxe fédérale</p>
                  <p className="text-xs text-gray-500">Taxe sur les produits et services du Canada</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={taxGst}
                    min={0}
                    max={100}
                    step={0.001}
                    onChange={(e) => setTaxGst(parseFloat(e.target.value) || 0)}
                    className="w-20 h-8 rounded-md border border-gray-300 px-2 text-sm text-right"
                  />
                  <span className="text-sm text-gray-600">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">TVQ — Taxe provinciale QC</p>
                  <p className="text-xs text-gray-500">Taxe de vente du Québec</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={taxQst}
                    min={0}
                    max={100}
                    step={0.001}
                    onChange={(e) => setTaxQst(parseFloat(e.target.value) || 0)}
                    className="w-20 h-8 rounded-md border border-gray-300 px-2 text-sm text-right"
                  />
                  <span className="text-sm text-gray-600">%</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
              Total combiné : <strong>{(taxGst + taxQst).toFixed(3)} %</strong>
            </div>

            <Button onClick={() => patchCompany({ tax_gst: taxGst, tax_qst: taxQst })} className="gap-2">
              <Save className="h-4 w-4" />
              Sauvegarder les taxes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── 4. Prix par défaut ── */}
      {activeSection === 'pricing' && (
        <Card>
          <CardHeader>
            <CardTitle>Prix par défaut</CardTitle>
            <CardDescription>Taux utilisés comme point de départ dans vos devis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Taux horaire main-d&apos;œuvre ($/h)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    value={laborRate}
                    min={0}
                    step={0.5}
                    onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)}
                    className="h-9 w-full rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Marge bénéficiaire (%)</label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    value={markupPct}
                    min={0}
                    max={500}
                    step={0.5}
                    onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
                    className="h-9 w-full rounded-md border border-gray-300 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <Button onClick={() => patchCompany({ default_labor_rate: laborRate, default_markup: markupPct })} className="gap-2">
              <Save className="h-4 w-4" />
              Sauvegarder les prix
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── 5. Système d'unités ── */}
      {activeSection === 'units' && (
        <Card>
          <CardHeader>
            <CardTitle>Système d&apos;unités</CardTitle>
            <CardDescription>Unités utilisées dans les mesures et les rapports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {(['metric', 'imperial'] as const).map((sys) => (
                <button
                  key={sys}
                  type="button"
                  onClick={() => setUnitSystem(sys)}
                  className={[
                    'flex-1 py-3 text-sm font-medium transition-colors',
                    unitSystem === sys
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {sys === 'metric' ? 'Métrique (m, cm, m²)' : 'Impérial (ft, in, pi²)'}
                </button>
              ))}
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
              {unitSystem === 'metric'
                ? <p>Distances en <strong>mètres</strong>, surfaces en <strong>m²</strong></p>
                : <p>Distances en <strong>pieds</strong>, surfaces en <strong>pi²</strong></p>
              }
            </div>

            <Button onClick={() => patchCompany({ unit_system: unitSystem })} className="gap-2">
              <Save className="h-4 w-4" />
              Sauvegarder
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── 6. Membres ── */}
      {activeSection === 'members' && (
        <Card>
          <CardHeader>
            <CardTitle>Membres de l&apos;équipe</CardTitle>
            <CardDescription>Gérez l&apos;accès des membres à votre compte entreprise</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {members.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Aucun membre trouvé</p>
            ) : (
              <div>
                {members.map((m) => <MemberRow key={m.id} member={m} />)}
              </div>
            )}

            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" />
                Inviter un membre
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="courriel@exemple.com"
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  className="flex-1 h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  onClick={handleInvite}
                  loading={inviting}
                  disabled={!inviteEmail.trim()}
                  size="sm"
                >
                  Inviter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 7. Abonnement ── */}
      {activeSection === 'subscription' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan actuel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-xl border-2 border-gray-200 p-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl font-bold text-gray-900 capitalize">
                      {company.subscription_tier === 'free' ? 'Gratuit' : company.subscription_tier === 'pro' ? 'Pro' : 'Entreprise'}
                    </span>
                    <Badge variant="secondary">Actif</Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {company.subscription_tier === 'free'
                      ? 'Jusqu\'à 3 projets · 50 photos · rapports PDF de base'
                      : 'Projets illimités · Toutes les fonctionnalités'}
                  </p>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {company.subscription_tier === 'free' ? '0' : company.subscription_tier === 'pro' ? '49' : '149'}
                  <span className="text-sm font-normal text-gray-500"> $/mois</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {company.subscription_tier === 'free' && (
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">Passer à Pro</h3>
                    <p className="text-sm text-gray-600 mt-1 mb-4">
                      Projets illimités · Photos illimitées · Modèles 3D · Rapports avancés · Support prioritaire
                    </p>
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-3xl font-bold text-gray-900">49 $</span>
                        <span className="text-gray-500 text-sm">/mois</span>
                      </div>
                      <Button size="lg" className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Crown className="h-4 w-4" />
                        Mettre à niveau
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
