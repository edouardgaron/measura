// app/(dashboard)/projects/[projectId]/report/page.tsx
'use client'

import { use, useEffect, useState } from 'react'
import { FileText, Download, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import type { Report } from '@/lib/supabase/types'
import { formatDateTime } from '@/lib/utils/format'

interface Props {
  params: Promise<{ projectId: string }>
}

interface ReportOptions {
  includePhotos: boolean
  include3d: boolean
  includeMeasurements: boolean
  locale: 'fr' | 'en'
}

export default function ReportPage({ params }: Props) {
  const { projectId } = use(params)

  const [options, setOptions] = useState<ReportOptions>({
    includePhotos: true,
    include3d: false,
    includeMeasurements: true,
    locale: 'fr',
  })

  const [generating, setGenerating] = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pastReports, setPastReports] = useState<Report[]>([])
  const [loadingReports, setLoadingReports] = useState(true)

  /* ── Load past reports ──────────────────────────────────────────────── */
  useEffect(() => {
    async function load() {
      setLoadingReports(true)
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('reports')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(10)

        if (data) {
          // Get signed URLs for each stored PDF
          const enriched: Report[] = await Promise.all(
            data.map(async (r) => {
              if (!r.storage_path) return r
              const { data: urlData } = await supabase.storage
                .from('reports')
                .createSignedUrl(r.storage_path, 3600)
              return { ...r, url: urlData?.signedUrl ?? undefined }
            })
          )
          setPastReports(enriched)
        }
      } catch {
        // Non-fatal
      } finally {
        setLoadingReports(false)
      }
    }
    load()
  }, [projectId])

  /* ── Cleanup blob URL on unmount ────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    }
  }, [pdfBlobUrl])

  /* ── Generate PDF ───────────────────────────────────────────────────── */
  async function generateReport() {
    setGenerating(true)
    setError(null)
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl)
      setPdfBlobUrl(null)
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          includePhotos: options.includePhotos,
          include3d: options.include3d,
          includeMeasurements: options.includeMeasurements,
          locale: options.locale,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPdfBlobUrl(url)

      // Refresh past reports list
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('reports')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setPastReports(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  function downloadPdf() {
    if (!pdfBlobUrl) return
    const a = document.createElement('a')
    a.href = pdfBlobUrl
    a.download = `rapport-${projectId}-${Date.now()}.pdf`
    a.click()
  }

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-green-600" />
        <h2 className="text-lg font-semibold text-gray-900">Générer un rapport</h2>
      </div>

      {/* Options card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Options du rapport</h3>

        <div className="space-y-3">
          <CheckboxOption
            id="includeMeasurements"
            label="Inclure le tableau des mesures"
            checked={options.includeMeasurements}
            onChange={(v) => setOptions((o) => ({ ...o, includeMeasurements: v }))}
          />
          <CheckboxOption
            id="includePhotos"
            label="Inclure les photos"
            checked={options.includePhotos}
            onChange={(v) => setOptions((o) => ({ ...o, includePhotos: v }))}
          />
          <CheckboxOption
            id="include3d"
            label="Inclure la vue 3D (capture)"
            checked={options.include3d}
            onChange={(v) => setOptions((o) => ({ ...o, include3d: v }))}
          />
        </div>

        <div className="mt-5">
          <label className="mb-1 block text-xs font-medium text-gray-700">Langue du rapport</label>
          <div className="flex gap-2">
            {(['fr', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setOptions((o) => ({ ...o, locale: lang }))}
                className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors ${
                  options.locale === lang
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                {lang === 'fr' ? 'Français' : 'English'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={generateReport}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Génération en cours…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Générer le rapport PDF
              </>
            )}
          </button>

          {pdfBlobUrl && (
            <button
              onClick={downloadPdf}
              className="inline-flex items-center gap-2 rounded-lg border border-green-600 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Télécharger
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {/* PDF Preview */}
      {pdfBlobUrl && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Aperçu du rapport</span>
            </div>
            <button
              onClick={downloadPdf}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger
            </button>
          </div>
          <iframe
            src={pdfBlobUrl}
            title="Aperçu PDF"
            className="w-full"
            style={{ height: 700 }}
          />
        </div>
      )}

      {/* Past reports */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-900">Rapports précédents</h3>

        {loadingReports ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : pastReports.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun rapport généré pour ce projet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pastReports.map((report) => (
              <li key={report.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Rapport v{report.version}
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      {report.locale?.toUpperCase()}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDateTime(report.created_at)}
                    {report.include_photos && ' · Photos'}
                    {report.include_measurements && ' · Mesures'}
                    {report.include_3d && ' · 3D'}
                  </p>
                </div>
                {report.url && (
                  <a
                    href={report.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function CheckboxOption({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}
