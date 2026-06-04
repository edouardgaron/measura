// app/(auth)/register/page.tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Ruler, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Le nom doit avoir au moins 2 caractères').max(100),
    companyName: z.string().min(1, 'Le nom de l\'entreprise est requis').max(100),
    email: z.string().email('Courriel invalide'),
    password: z
      .string()
      .min(8, 'Le mot de passe doit avoir au moins 8 caractères')
      .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
      .regex(/[0-9]/, 'Doit contenir au moins un chiffre'),
    confirmPassword: z.string().min(1, 'Veuillez confirmer votre mot de passe'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const supabase = createClient()
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [submittedEmail, setSubmittedEmail] = React.useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(values: RegisterForm) {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName,
          company_name: values.companyName,
          role: 'entrepreneur',
        },
      },
    })

    if (error) {
      toast({
        variant: 'error',
        title: 'Inscription échouée',
        description: error.message,
      })
      return
    }

    setSubmittedEmail(values.email)
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl shadow-blue-900/30 p-8 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mx-auto mb-4">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              Vérifiez votre courriel
            </h2>
            <p className="text-neutral-500 text-sm mb-1">
              Un lien de confirmation a été envoyé à&nbsp;:
            </p>
            <p className="font-medium text-neutral-800 mb-6">{submittedEmail}</p>
            <p className="text-sm text-neutral-500 mb-6">
              Cliquez sur le lien dans votre courriel pour activer votre compte, puis revenez vous connecter.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Aller à la connexion
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4">
            <Ruler className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ChantierPro 360</h1>
          <p className="mt-1 text-blue-200 text-sm">La plateforme tout-en-un des entrepreneurs</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-blue-900/30 p-8">
          <h2 className="text-xl font-semibold text-neutral-900 mb-1">Créer un compte</h2>
          <p className="text-sm text-neutral-500 mb-6">Pour entrepreneurs et professionnels du bâtiment</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <Input
              label="Nom complet"
              type="text"
              autoComplete="name"
              placeholder="Jean Tremblay"
              error={errors.fullName?.message}
              {...register('fullName')}
            />

            <Input
              label="Nom de l'entreprise"
              type="text"
              autoComplete="organization"
              placeholder="Construction ABC inc."
              error={errors.companyName?.message}
              {...register('companyName')}
            />

            <Input
              label="Courriel"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="relative">
              <Input
                label="Mot de passe"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                helperText="Min. 8 caractères, une majuscule, un chiffre"
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer' : 'Afficher'}
                className="absolute right-3 top-8 text-neutral-400 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Confirmer le mot de passe"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Masquer' : 'Afficher'}
                className="absolute right-3 top-8 text-neutral-400 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full mt-2"
            >
              {isSubmitting ? 'Inscription en cours…' : 'Créer mon compte'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Déjà un compte?{' '}
            <Link
              href="/login"
              className="text-blue-600 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
