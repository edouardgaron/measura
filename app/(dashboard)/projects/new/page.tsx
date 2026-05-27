// app/(dashboard)/projects/new/page.tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronRight, Building2, MapPin, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createProjectSchema, type CreateProjectInput } from '@/lib/validators/project.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Projet', icon: Building2, description: 'Informations générales' },
  { id: 2, label: 'Adresse', icon: MapPin, description: 'Localisation du bâtiment' },
  { id: 3, label: 'Client', icon: UserPlus, description: 'Inviter un client (optionnel)' },
] as const

// ─── Progress indicator ───────────────────────────────────────────────────────

interface StepIndicatorProps {
  currentStep: number
}

function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Étapes" className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, index) => {
        const isDone = currentStep > step.id
        const isActive = currentStep === step.id
        const Icon = step.icon

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors duration-200',
                  isDone
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : isActive
                    ? 'bg-white border-blue-600 text-blue-600 shadow-sm'
                    : 'bg-white border-neutral-200 text-neutral-400'
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {isDone ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:block',
                  isActive
                    ? 'text-blue-600'
                    : isDone
                    ? 'text-neutral-600'
                    : 'text-neutral-400'
                )}
              >
                {step.label}
              </span>
            </div>

            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2 mb-6 sm:mb-5 rounded transition-colors duration-200',
                  currentStep > step.id ? 'bg-blue-600' : 'bg-neutral-200'
                )}
              />
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// ─── Step 1: Project info ─────────────────────────────────────────────────────

interface Step1Props {
  register: ReturnType<typeof useForm<CreateProjectInput>>['register']
  errors: ReturnType<typeof useForm<CreateProjectInput>>['formState']['errors']
  setValue: ReturnType<typeof useForm<CreateProjectInput>>['setValue']
  getValues: ReturnType<typeof useForm<CreateProjectInput>>['getValues']
}

function Step1({ register, errors, setValue, getValues }: Step1Props) {
  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Titre du projet *"
        placeholder="Ex : Maison 123 rue des Érables"
        error={errors.title?.message}
        {...register('title')}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Type de bâtiment
        </label>
        <Select
          defaultValue={getValues('building_type') ?? 'residential'}
          onValueChange={(v) =>
            setValue('building_type', v as CreateProjectInput['building_type'], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="residential">Résidentiel</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
            <SelectItem value="industrial">Industriel</SelectItem>
          </SelectContent>
        </Select>
        {errors.building_type && (
          <p className="text-xs text-red-600">{errors.building_type.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Système d'unités
        </label>
        <Select
          defaultValue={getValues('unit_system') ?? 'metric'}
          onValueChange={(v) =>
            setValue('unit_system', v as CreateProjectInput['unit_system'], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un système" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="metric">Métrique (m, cm)</SelectItem>
            <SelectItem value="imperial">Impérial (pi, po)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="notes"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Notes (optionnel)
        </label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Informations supplémentaires sur le projet…"
          className={cn(
            'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm',
            'text-neutral-900 placeholder:text-neutral-400 shadow-sm resize-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500',
            'dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700'
          )}
          {...register('notes')}
        />
        {errors.notes && (
          <p className="text-xs text-red-600">{errors.notes.message}</p>
        )}
      </div>
    </div>
  )
}

// ─── Step 2: Address ──────────────────────────────────────────────────────────

function Step2({ register, errors }: Pick<Step1Props, 'register' | 'errors'>) {
  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Adresse (ligne 1)"
        placeholder="123 rue des Érables"
        error={errors.address_line1?.message}
        {...register('address_line1')}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Ville"
          placeholder="Montréal"
          error={errors.address_city?.message}
          {...register('address_city')}
        />
        <Input
          label="Province / État"
          placeholder="QC"
          error={errors.address_province?.message}
          {...register('address_province')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Code postal"
          placeholder="H1A 1A1"
          error={errors.address_postal?.message}
          {...register('address_postal')}
        />
        <Input
          label="Pays"
          placeholder="CA"
          error={errors.address_country?.message}
          {...register('address_country')}
        />
      </div>
    </div>
  )
}

// ─── Step 3: Invite client ────────────────────────────────────────────────────

function Step3({ register, errors }: Pick<Step1Props, 'register' | 'errors'>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 p-4 text-sm text-blue-800 dark:text-blue-300">
        <p className="font-medium mb-1">Invitation optionnelle</p>
        <p className="text-blue-700 dark:text-blue-400 text-xs leading-relaxed">
          Vous pouvez inviter un client à visualiser ce projet. Il recevra un courriel avec un lien
          d'accès. Vous pouvez aussi le faire plus tard depuis la page du projet.
        </p>
      </div>
      <Input
        label="Courriel du client"
        type="email"
        placeholder="client@exemple.com"
        helperText="Laissez vide pour ignorer cette étape"
        error={errors.invite_email?.message}
        {...register('invite_email')}
      />
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentStep, setCurrentStep] = React.useState(1)

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      building_type: 'residential',
      unit_system: 'metric',
      address_country: 'CA',
    },
  })

  const stepFields: Record<number, Array<keyof CreateProjectInput>> = {
    1: ['title', 'building_type', 'unit_system', 'notes'],
    2: ['address_line1', 'address_city', 'address_province', 'address_postal', 'address_country'],
    3: ['invite_email'],
  }

  async function handleNext() {
    const fields = stepFields[currentStep]
    const valid = await trigger(fields)
    if (valid) setCurrentStep((s) => Math.min(s + 1, 3))
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }

  async function onSubmit(values: CreateProjectInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      toast({ variant: 'error', title: 'Non authentifié', description: 'Veuillez vous reconnecter.' })
      return
    }

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast({
        variant: 'error',
        title: 'Erreur lors de la création',
        description: body?.error ?? 'Une erreur inattendue est survenue.',
      })
      return
    }

    const { id } = await res.json()
    toast({ variant: 'success', title: 'Projet créé', description: values.title })
    router.push(`/dashboard/projects/${id}`)
  }

  const stepTitle = STEPS[currentStep - 1]
  const stepDesc = STEPS[currentStep - 1].description

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Nouveau projet
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Remplissez les informations pour créer votre projet de mesure.
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {React.createElement(STEPS[currentStep - 1].icon, { className: 'h-5 w-5 text-blue-600' })}
            {stepTitle.label}
          </CardTitle>
          <CardDescription>{stepDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {currentStep === 1 && (
              <Step1
                register={register}
                errors={errors}
                setValue={setValue}
                getValues={getValues}
              />
            )}
            {currentStep === 2 && (
              <Step2 register={register} errors={errors} />
            )}
            {currentStep === 3 && (
              <Step3 register={register} errors={errors} />
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                Retour
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">
                  Étape {currentStep} sur {STEPS.length}
                </span>

                {currentStep < STEPS.length ? (
                  <Button type="button" onClick={handleNext} className="gap-1.5">
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="gap-1.5"
                  >
                    {isSubmitting ? 'Création en cours…' : 'Créer le projet'}
                    {!isSubmitting && <Check className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
