// app/(auth)/reset-password/page.tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Ruler, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'

const schema = z.object({
  password: z.string().min(8, 'Le mot de passe doit avoir au moins 8 caractères'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

type Form = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [showPassword, setShowPassword] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: Form) {
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) {
      toast({ variant: 'error', title: 'Erreur', description: error.message })
      return
    }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
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
          {done ? (
            <div className="text-center py-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Mot de passe mis à jour</h2>
              <p className="text-sm text-gray-500 mt-1">Redirection vers votre tableau de bord...</p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Nouveau mot de passe</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="relative">
                  <Input
                    label="Nouveau mot de passe"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    error={errors.password?.message}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  label="Confirmer le mot de passe"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
                <Button type="submit" size="lg" loading={isSubmitting} className="w-full mt-2">
                  Mettre à jour le mot de passe
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
