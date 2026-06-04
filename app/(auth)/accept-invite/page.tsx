// app/(auth)/accept-invite/page.tsx
'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Ruler, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'

const schema = z.object({
  full_name: z.string().min(2, 'Le nom est requis'),
  password: z.string().min(8, 'Au moins 8 caractères'),
})

type Form = z.infer<typeof schema>

type PageState = 'loading' | 'invalid' | 'ready' | 'done'

interface InviteInfo {
  type?: 'project' | 'company'
  projectTitle?: string
  projectAddress?: string
  companyName?: string
  role?: string
  email: string
  token: string
}

function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const supabase = createClient()

  const [state, setState] = React.useState<PageState>('loading')
  const [inviteInfo, setInviteInfo] = React.useState<InviteInfo | null>(null)
  const [existingUser, setExistingUser] = React.useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  React.useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }
    // Validate token via API
    fetch(`/api/invite/validate?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setInviteInfo(data)
          setExistingUser(data.existingUser)
          setState('ready')
        } else {
          setState('invalid')
        }
      })
      .catch(() => setState('invalid'))
  }, [token])

  async function onSubmit(values: Form) {
    if (!inviteInfo) return

    // Sign up or sign in
    if (existingUser) {
      const { error } = await supabase.auth.signInWithPassword({
        email: inviteInfo.email,
        password: values.password,
      })
      if (error) {
        toast({ variant: 'error', title: 'Erreur', description: error.message })
        return
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: inviteInfo.email,
        password: values.password,
        options: {
          data: {
            full_name: values.full_name,
            role: inviteInfo.type === 'company' ? (inviteInfo.role ?? 'employee') : 'client',
          },
        },
      })
      if (error) {
        toast({ variant: 'error', title: 'Erreur', description: error.message })
        return
      }
    }

    // Mark invite as accepted
    await fetch(`/api/invite/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })

    setState('done')
    setTimeout(() => router.push('/dashboard'), 2500)
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800">
        <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
      </div>
    )
  }

  return (

    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            <Ruler className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Measura</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl shadow-blue-900/30 p-8">
          {state === 'invalid' && (
            <div className="text-center py-4">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900">Invitation invalide</h2>
              <p className="text-sm text-gray-500 mt-1">
                Ce lien d'invitation est invalide ou a déjà été utilisé.
              </p>
              <Button className="mt-4" onClick={() => router.push('/login')}>
                Retour à la connexion
              </Button>
            </div>
          )}

          {state === 'done' && (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900">Invitation acceptée!</h2>
              <p className="text-sm text-gray-500 mt-1">Redirection vers votre tableau de bord...</p>
            </div>
          )}

          {state === 'ready' && inviteInfo && (
            <>
              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                {inviteInfo.type === 'company' ? (
                  <>
                    <h2 className="font-semibold text-blue-900">Invitation à l&apos;équipe</h2>
                    <p className="text-sm text-blue-700 mt-1">{inviteInfo.companyName}</p>
                    {inviteInfo.role && (
                      <p className="text-xs text-blue-600 mt-0.5">Rôle : {inviteInfo.role}</p>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="font-semibold text-blue-900">Invitation de projet</h2>
                    <p className="text-sm text-blue-700 mt-1">{inviteInfo.projectTitle}</p>
                    {inviteInfo.projectAddress && (
                      <p className="text-xs text-blue-600 mt-0.5">{inviteInfo.projectAddress}</p>
                    )}
                  </>
                )}
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {!existingUser && (
                  <Input
                    label="Votre nom"
                    placeholder="Prénom Nom"
                    error={errors.full_name?.message}
                    {...register('full_name')}
                  />
                )}
                <Input
                  label="Email"
                  value={inviteInfo.email}
                  readOnly
                  className="bg-gray-50 text-gray-500"
                />
                <Input
                  label={existingUser ? 'Mot de passe' : 'Créer un mot de passe'}
                  type="password"
                  autoComplete={existingUser ? 'current-password' : 'new-password'}
                  error={errors.password?.message}
                  {...register('password')}
                />
                <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
                  {existingUser ? 'Se connecter et accepter' : 'Créer mon compte et accepter'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-800">
          <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full" />
        </div>
      }
    >
      <AcceptInviteContent />
    </React.Suspense>
  )
}
