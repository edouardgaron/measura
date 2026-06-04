// app/(dashboard)/settings/page.tsx
'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, User, Building2, ArrowRight, Sun, Moon, Monitor, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { useTheme, type Theme } from '@/components/theme/ThemeProvider'
import { makeT, getClientLocale } from '@/lib/i18n'
import type { Profile } from '@/lib/supabase/types'

function AppearanceCard() {
  const { theme, setTheme } = useTheme()
  const T = makeT(getClientLocale())
  const options: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'light', label: T('theme.light'), icon: Sun },
    { value: 'dark', label: T('theme.dark'), icon: Moon },
    { value: 'system', label: T('theme.system'), icon: Monitor },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>{T('settings.appearance')}</CardTitle>
        <CardDescription>{T('settings.appearanceSub')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {options.map(({ value, label, icon: Icon }) => {
            const active = theme === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors ${
                  active
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                    : 'border-neutral-200 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

const profileSchema = z.object({
  full_name: z.string().min(1, 'Le nom est requis').max(100),
  company_name: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
})

type ProfileForm = z.infer<typeof profileSchema>

export default function SettingsPage() {
  const supabase = createClient()
  const T = makeT(getClientLocale())
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
      toast({ variant: 'error', title: T('settings.error'), description: error.message })
    } else {
      toast({ variant: 'success', title: T('settings.saved'), description: T('settings.savedDesc') })
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">{T('settings.title')}</h1>
        <p className="text-gray-500 dark:text-neutral-400 mt-1">{T('settings.subtitle')}</p>
      </div>

      <AppearanceCard />

      {/* Abonnement SaaS */}
      <Card>
        <CardContent className="p-0">
          <Link
            href="/settings/billing"
            className="flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <CreditCard className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-neutral-100">{T('settings.billing')}</p>
                <p className="text-xs text-gray-500 dark:text-neutral-400">{T('settings.billingSub')}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </Link>
        </CardContent>
      </Card>

      {/* Tab buttons */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
        >
          <User className="h-4 w-4" />
          {T('settings.tab.profile')}
        </button>
        {(profile?.role === 'entrepreneur' || profile?.role === 'admin') && (
          <button
            onClick={() => setActiveTab('company')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'company'
                ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            <Building2 className="h-4 w-4" />
            {T('settings.tab.company')}
          </button>
        )}
      </div>

      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>{T('settings.personalInfo')}</CardTitle>
            <CardDescription>{T('settings.personalInfoSub')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label={T('settings.fullName')}
                error={errors.full_name?.message}
                {...register('full_name')}
              />
              <Input
                label={T('settings.phone')}
                type="tel"
                placeholder="+1 (514) 000-0000"
                error={errors.phone?.message}
                {...register('phone')}
              />
              <div className="pt-2">
                <Button type="submit" loading={isSubmitting} className="gap-2">
                  <Save className="h-4 w-4" />
                  {T('settings.save')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'company' && (
        <Card>
          <CardHeader>
            <CardTitle>{T('settings.companyTitle')}</CardTitle>
            <CardDescription>{T('settings.companySub')}</CardDescription>
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
                  <p className="text-sm font-medium text-gray-900">{T('settings.configureCompany')}</p>
                  <p className="text-xs text-gray-500">{T('settings.configureCompanySub')}</p>
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
          <CardTitle className="text-red-600">{T('settings.dangerZone')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600">
            {T('settings.dangerText')}
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(T('settings.deleteConfirm'))) {
                toast({ variant: 'error', title: T('settings.contactSupport'), description: T('settings.contactSupportDesc') })
              }
            }}
          >
            {T('settings.deleteAccount')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
