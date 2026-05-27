// app/(dashboard)/projects/[projectId]/photos/[photoId]/page.tsx
import { notFound } from 'next/navigation'
import { ArrowLeft, MapPin } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Calibration, Measurement, Photo } from '@/lib/supabase/types'
import { PhotoMeasureClient } from './PhotoMeasureClient'

interface Props {
  params: Promise<{ projectId: string; photoId: string }>
}

const FACADE_LABELS: Record<string, string> = {
  front: 'Façade avant',
  back: 'Façade arrière',
  left: 'Façade gauche',
  right: 'Façade droite',
  roof: 'Toit',
  other: 'Autre',
}

export default async function PhotoMeasurePage({ params }: Props) {
  const { projectId, photoId } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    notFound()
  }

  // Verify project membership
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    notFound()
  }

  // Fetch photo with nested calibration & measurements
  const { data: photoRow, error: photoError } = await supabase
    .from('photos')
    .select('*, calibration:calibrations(*), measurements(*)')
    .eq('id', photoId)
    .eq('project_id', projectId)
    .single()

  if (photoError || !photoRow) {
    notFound()
  }

  // Resolve signed URL for display
  const { data: signedData } = await supabase.storage
    .from('photos')
    .createSignedUrl(photoRow.storage_path, 60 * 60) // 1 hour

  const photo: Photo = {
    ...photoRow,
    url: signedData?.signedUrl ?? '',
    calibration: undefined,
    measurements: undefined,
  }

  // Supabase returns the first match or an array for one-to-many
  const rawCalib = photoRow.calibration
  const calibration: Calibration | null = Array.isArray(rawCalib)
    ? (rawCalib[0] ?? null)
    : rawCalib ?? null

  const measurements: Measurement[] = Array.isArray(photoRow.measurements)
    ? photoRow.measurements
    : []

  // Fetch project for unit system
  const { data: project } = await supabase
    .from('projects')
    .select('unit_system')
    .eq('id', projectId)
    .single()

  const isReadOnly = membership.role === 'client'

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href={`/dashboard/projects/${projectId}/photos`}
            className="mt-0.5 flex items-center gap-1 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title="Retour aux photos"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">
              {photo.original_name ?? 'Photo sans nom'}
            </h2>
            {photo.facade_label && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-500">
                <MapPin className="h-3.5 w-3.5" />
                {FACADE_LABELS[photo.facade_label] ?? photo.facade_label}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Interactive measurement client */}
      <PhotoMeasureClient
        photo={photo}
        initialCalibration={calibration}
        initialMeasurements={measurements}
        projectId={projectId}
        photoId={photoId}
        unitSystem={project?.unit_system ?? 'metric'}
        readOnly={isReadOnly}
      />
    </div>
  )
}
