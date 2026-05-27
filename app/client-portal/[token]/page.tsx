// app/client-portal/[token]/page.tsx
import Link from 'next/link'
import {
  Camera,
  ArrowRight,
  MapPin,
  AlertCircle,
  Sun,
  ArrowUp,
  ArrowLeft,
  ArrowRight as ArrowRightIcon,
  RotateCw,
  Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ token: string }>
}

const PHOTO_GUIDE_STEPS = [
  {
    step: 1,
    title: 'Façade avant',
    description: 'Reculez suffisamment pour capturer toute la façade, de la fondation jusqu\'au toit.',
    icon: ArrowUp,
    tip: 'Tenez-vous à environ 15 m si possible.',
  },
  {
    step: 2,
    title: 'Façade gauche',
    description: 'Photographiez le côté gauche de la maison en entier.',
    icon: ArrowLeft,
    tip: 'Incluez la gouttière et le bord du toit.',
  },
  {
    step: 3,
    title: 'Façade droite',
    description: 'Photographiez le côté droit de la maison en entier.',
    icon: ArrowRightIcon,
    tip: 'Même angle que le côté gauche.',
  },
  {
    step: 4,
    title: 'Façade arrière',
    description: 'Capturez la façade arrière depuis le jardin ou la cour.',
    icon: RotateCw,
    tip: 'Si vous ne pouvez pas reculer, prenez 2 photos en angle.',
  },
  {
    step: 5,
    title: 'Toit',
    description: 'Si possible, photographiez le toit depuis une position surélevée ou en angle.',
    icon: Sun,
    tip: 'Une photo depuis la rue montrant la pente suffit souvent.',
  },
  {
    step: 6,
    title: 'Détails supplémentaires',
    description: 'Fenêtres, portes, lucarnes ou tout élément particulier que vous souhaitez mesurer.',
    icon: Plus,
    tip: 'Les photos rapprochées des détails aident à la précision.',
  },
]

export default async function ClientPortalPage({ params }: Props) {
  const { token } = await params
  const supabase = await createClient()

  // Validate token
  const { data: member } = await supabase
    .from('project_members')
    .select('id, email, project_id, invite_accepted_at, project:projects(title, address_line1, address_city, address_province)')
    .eq('invite_token', token)
    .eq('role', 'client')
    .single()

  if (!member) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h1 className="text-xl font-bold text-gray-900">Lien invalide</h1>
          <p className="mt-2 text-sm text-gray-500">
            Ce lien d&apos;invitation est invalide ou a expiré. Veuillez contacter votre entrepreneur.
          </p>
        </div>
      </div>
    )
  }

  const projectRaw = Array.isArray(member.project) ? member.project[0] : member.project
  const project = (projectRaw as unknown) as { title: string; address_line1: string | null; address_city: string | null; address_province: string | null } | null
  const addressParts = [
    project?.address_line1,
    project?.address_city,
    project?.address_province,
  ].filter(Boolean)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50">
      {/* Header */}
      <header className="border-b border-white/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Camera className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">Measura</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8 space-y-8">
        {/* Welcome card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Bonjour !</h1>
          <p className="mt-1 text-gray-500">
            Votre entrepreneur vous invite à déposer des photos pour le projet :
          </p>
          <div className="mt-4 rounded-xl bg-blue-50 p-4">
            <p className="font-semibold text-blue-900">{project?.title}</p>
            {addressParts.length > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-blue-700">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {addressParts.join(', ')}
              </p>
            )}
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Suivez le guide ci-dessous pour prendre des photos de qualité, puis cliquez sur{' '}
            <strong>Déposer mes photos</strong>.
          </p>
        </div>

        {/* Photo guide */}
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-gray-900">
            Guide photo en 6 étapes
          </h2>
          <ol className="space-y-4">
            {PHOTO_GUIDE_STEPS.map((step) => {
              const Icon = step.icon
              return (
                <li key={step.step} className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-blue-500" />
                      <p className="font-medium text-gray-900">{step.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{step.description}</p>
                    <p className="mt-1 text-xs text-blue-600">
                      Conseil : {step.tip}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>

        {/* Tips */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="mb-2 text-sm font-semibold text-amber-900">Conseils généraux</h3>
          <ul className="space-y-1 text-sm text-amber-800">
            <li>• Prenez les photos en mode paysage (horizontal)</li>
            <li>• Bonne luminosité naturelle de préférence (pas la nuit)</li>
            <li>• Évitez les obstinations : voitures, arbres devant la façade</li>
            <li>• Plus la photo est nette, plus les mesures seront précises</li>
          </ul>
        </div>

        {/* CTA */}
        <Link
          href={`/client-portal/${token}/upload`}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-md hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Camera className="h-5 w-5" />
          Déposer mes photos
          <ArrowRight className="h-5 w-5" />
        </Link>

        <p className="text-center text-xs text-gray-400 pb-8">
          Vos photos sont sécurisées et utilisées uniquement pour ce projet.
        </p>
      </main>
    </div>
  )
}
