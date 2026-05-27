// app/(auth)/forgot-password/page.tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Ruler, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'

const forgotSchema = z.object({
  email: z.string().email('Courriel invalide'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [success, setSuccess] = React.useState(false)
  const [submittedEmail, setSubmittedEmail] = React.useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  })

  async function onSubmit(values: ForgotForm) {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      toast({
        variant: 'error',
        title: 'Erreur',
        description: error.message,
      })
      return
    }

    setSubmittedEmail(values.email)
    setSuccess(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            <Ruler className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Measura</h1>
          <p className="mt-1 text-blue-200 text-sm">Mesures de bâtiments professionnelles</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-blue-900/30 p-8">
          {success ? (
            <div className="text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 mx-auto mb-4">
                <Mail className="h-7 w-7 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                Courriel envoyé
              </h2>
              <p className="text-neutral-500 text-sm mb-1">
                Un lien de réinitialisation a été envoyé à&nbsp;:
              </p>
              <p className="font-medium text-neutral-800 mb-4">{submittedEmail}</p>
              <p className="text-sm text-neutral-500 mb-6">
                Vérifiez votre boîte de réception (et vos courriels indésirables) et cliquez sur le lien pour réinitialiser votre mot de passe.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Retour à la connexion
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-neutral-900 mb-1">
                Mot de passe oublié?
              </h2>
              <p className="text-sm text-neutral-500 mb-6">
                Entrez votre courriel et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
                <Input
                  label="Courriel"
                  type="email"
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  error={errors.email?.message}
                  {...register('email')}
                />

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Envoi en cours…' : 'Envoyer le lien'}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-neutral-500">
                <Link
                  href="/login"
                  className="text-blue-600 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  ← Retour à la connexion
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
