// app/(dashboard)/settings/page.tsx
'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, User, Building2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import type { Profile } from '@/lib/supabase/types'

const profileSchema = z.object({
  full_name: z.string().min(1, 'Le nom est requis').max(100),
  company_name: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
})

type ProfileForm = z.infer<typeof profileSchema>

export default function SettingsPage() {
  const supabase = createClient()
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<'profile' | 'company'>('profile')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  })

  React.useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile(data)
        reset({
          full_name: data.full_name ?? '',
          company_name: data.company_name ?? '',
          phone: data.phone ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [supabase, reset])

  async function onSubmit(values: ProfileForm) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: values.full_name,
        company_name: values.company_name || null,
        phone: values.phone || null,
      })
      .eq('id', user.id)

    if (error) {
      toast({ variant: 'error', title: 'Erreur', description: error.message })
    } else {
      toast({ variant: 'success', title: 'Sauvegardé', description: 'Vos paramètres ont été mis à jour.' })
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-48" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-gray-500 mt-1">Gérez votre profil et les informations de votre entreprise</p>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <User className="h-4 w-4" />
          Profil
        </button>
        {(profile?.role === 'entrepreneur' || profile?.role === 'admin') && (
          <button
            onClick={() => setActiveTab('company')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'company'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Entreprise
          </button>
        )}
      </div>

      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
            <CardDescription>Mettez à jour votre nom et vos coordonnées</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Nom complet"
                error={errors.full_name?.message}
                {...register('full_name')}
              />
              <Input
                label="Téléphone"
                type="tel"
                placeholder="+1 (514) 000-0000"
                error={errors.phone?.message}
                {...register('phone')}
              />
              <div className="pt-2">
                <Button type="submit" loading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  Sauvegarder
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'company' && (
        <Card>
          <CardHeader>
            <CardTitle>Paramètres de l&apos;entreprise</CardTitle>
            <CardDescription>Logo, taxes, prix par défaut, membres de l&apos;équipe et abonnement</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/settings/company"
              className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Configurer l&apos;entreprise</p>
                  <p className="text-xs text-gray-500">Logo, taxes, équipe et abonnement</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Zone dangereuse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Une fois votre compte supprimé, toutes vos données seront perdues de façon permanente.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm('Êtes-vous sûr de vouloir supprimer votre compte? Cette action est irréversible.')) {
                toast({ variant: 'error', title: 'Contactez le support', description: 'Veuillez contacter support@measura.app pour supprimer votre compte.' })
              }
            }}
          >
            Supprimer mon compte
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
