// app/(dashboard)/projects/[projectId]/design/page.tsx
'use client'

import * as React from 'react'
import { use } from 'react'
import dynamic from 'next/dynamic'
import {
  Loader2,
  Save,
  Palette,
  Check,
  Star,
  Layers,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import type { RoofType } from '@/lib/supabase/types'

// ─── Dynamic imports (avoid SSR issues with WebGL) ───────────────────────────

const ModelViewer = dynamic(() => import('@/components/model3d/ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-xl border border-gray-200 bg-gray-900">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  ),
})

const DesignExtras = dynamic(() => import('@/components/model3d/DesignExtras'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

interface DesignColors {
  walls: string
  roof: string
  trim: string
  door: string
  window: string
}

interface DesignVersion {
  id: string
  project_id: string
  name: string
  colors: DesignColors
  material: string
  roof_type: RoofType
  is_active: boolean
  created_at: string
}

interface Props {
  params: Promise<{ projectId: string }>
}

// ─── Wall material options ────────────────────────────────────────────────────

const WALL_MATERIALS = [
  { value: 'vinyle',       label: 'Vinyle' },
  { value: 'bois',         label: 'Bois' },
  { value: 'canexel',      label: 'CanExel' },
  { value: 'fibrociment',  label: 'Fibrociment' },
  { value: 'brique',       label: 'Brique' },
  { value: 'pierre',       label: 'Pierre' },
  { value: 'metal',        label: 'Métal' },
]

const ROOF_OPTIONS: { value: RoofType; label: string }[] = [
  { value: 'gable', label: 'Toit à pignon' },
  { value: 'hip',   label: 'Toit en croupe' },
  { value: 'flat',  label: 'Toit plat' },
  { value: 'shed',  label: 'Toit monopente' },
]

// ─── Color picker row ─────────────────────────────────────────────────────────

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-lg border border-gray-300 shadow-sm"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-gray-300 p-0.5"
          title={label}
        />
        <span className="w-16 text-xs text-gray-500 font-mono">{value}</span>
      </div>
    </div>
  )
}

// ─── Design thumbnail card ────────────────────────────────────────────────────

function DesignCard({
  design,
  onActivate,
  onDelete,
  onLoad,
}: {
  design: DesignVersion
  onActivate: (id: string) => void
  onDelete: (id: string) => void
  onLoad: (design: DesignVersion) => void
}) {
  return (
    <div
      className={[
        'relative rounded-xl border-2 p-3 cursor-pointer transition-all hover:shadow-md',
        design.is_active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300',
      ].join(' ')}
      onClick={() => onLoad(design)}
    >
      {design.is_active && (
        <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Color preview swatches */}
      <div className="flex gap-1 mb-2">
        {[design.colors.walls, design.colors.roof, design.colors.trim, design.colors.door].map((c, i) => (
          <div
            key={i}
            className="h-5 flex-1 rounded"
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-gray-900 truncate">{design.name}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{design.material} · {ROOF_OPTIONS.find(r => r.value === design.roof_type)?.label}</p>

      <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
        {!design.is_active && (
          <button
            type="button"
            onClick={() => onActivate(design.id)}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Star className="h-3 w-3" />
            Activer
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(design.id)}
          className="rounded-md p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DesignPage({ params }: Props) {
  const { projectId } = use(params)

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [designs, setDesigns] = React.useState<DesignVersion[]>([])

  const [colors, setColors] = React.useState<DesignColors>({
    walls:  '#e8d5b7',
    roof:   '#8b5e3c',
    trim:   '#ffffff',
    door:   '#4a3728',
    window: '#a8c5d8',
  })
  const [material, setMaterial] = React.useState('vinyle')
  const [roofType, setRoofType] = React.useState<RoofType>('gable')

  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false)
  const [designName, setDesignName] = React.useState('')

  // ── Load designs ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    async function load() {
      setLoading(true)
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data } = await supabase
        .from('design_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setDesigns(data as DesignVersion[])
        // Load active design into the editor
        const active = data.find((d: DesignVersion) => d.is_active) ?? data[0]
        if (active) {
          setColors(active.colors)
          setMaterial(active.material)
          setRoofType(active.roof_type)
        }
      }
      setLoading(false)
    }
    load()
  }, [projectId])

  function setColor(key: keyof DesignColors, value: string) {
    setColors((prev) => ({ ...prev, [key]: value }))
  }

  // ── Save design ───────────────────────────────────────────────────────────
  async function handleSaveDesign() {
    if (!designName.trim()) return
    setSaving(true)

    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    const { data, error } = await supabase
      .from('design_versions')
      .insert({
        project_id: projectId,
        name: designName.trim(),
        colors,
        material,
        roof_type: roofType,
        is_active: false,
      })
      .select()
      .single()

    if (error) {
      toast({ variant: 'error', title: 'Erreur', description: error.message })
    } else {
      setDesigns((prev) => [data as DesignVersion, ...prev])
      toast({ variant: 'success', title: 'Design sauvegardé', description: designName.trim() })
      setSaveDialogOpen(false)
      setDesignName('')
    }
    setSaving(false)
  }

  // ── Activate design ───────────────────────────────────────────────────────
  async function handleActivate(id: string) {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    // Deactivate all, then activate chosen
    await supabase
      .from('design_versions')
      .update({ is_active: false })
      .eq('project_id', projectId)

    const { error } = await supabase
      .from('design_versions')
      .update({ is_active: true })
      .eq('id', id)

    if (!error) {
      setDesigns((prev) => prev.map((d) => ({ ...d, is_active: d.id === id })))
      toast({ variant: 'success', title: 'Design activé' })
    } else {
      toast({ variant: 'error', title: 'Erreur', description: error.message })
    }
  }

  // ── Delete design ─────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce design ?')) return
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()

    const { error } = await supabase.from('design_versions').delete().eq('id', id)
    if (!error) {
      setDesigns((prev) => prev.filter((d) => d.id !== id))
      toast({ variant: 'success', title: 'Design supprimé' })
    }
  }

  // ── Load design into editor ───────────────────────────────────────────────
  function handleLoadDesign(design: DesignVersion) {
    setColors(design.colors)
    setMaterial(design.material)
    setRoofType(design.roof_type)
    toast({ variant: 'info', title: 'Design chargé', description: design.name })
  }

  // ModelViewer only uses walls/roof/trim from colors
  const viewerColors = { walls: colors.walls, roof: colors.roof, trim: colors.trim }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Design & Couleurs</h2>
        </div>
        <Button onClick={() => setSaveDialogOpen(true)} className="gap-1.5">
          <Save className="h-4 w-4" />
          Sauvegarder ce design
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
          {/* ── Left panel: color pickers ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Couleurs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorRow label="Revêtement mur" value={colors.walls}  onChange={(v) => setColor('walls',  v)} />
                <ColorRow label="Toiture"         value={colors.roof}   onChange={(v) => setColor('roof',   v)} />
                <ColorRow label="Garnitures"       value={colors.trim}   onChange={(v) => setColor('trim',   v)} />
                <ColorRow label="Portes"           value={colors.door}   onChange={(v) => setColor('door',   v)} />
                <ColorRow label="Fenêtres"         value={colors.window} onChange={(v) => setColor('window', v)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Matériau des murs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {WALL_MATERIALS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMaterial(m.value)}
                      className={[
                        'rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors',
                        material === m.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Type de toit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {ROOF_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRoofType(r.value)}
                      className={[
                        'rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors',
                        roofType === r.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300',
                      ].join(' ')}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right panel: 3D preview ── */}
          <div className="space-y-4">
            <ModelViewer
              measurements={{}}
              roofType={roofType}
              colors={viewerColors}
              onColorsChange={(c) => setColors((prev) => ({ ...prev, ...c }))}
            />

            <p className="text-xs text-gray-500 text-center">
              Les couleurs Portes et Fenêtres sont visibles sur le modèle complet.
              Cliquez sur «&nbsp;Sauvegarder ce design&nbsp;» pour conserver vos choix.
            </p>

            <DesignExtras roofType={roofType} colors={viewerColors} />
          </div>
        </div>
      )}

      {/* ── Design versions list ── */}
      {designs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Designs sauvegardés</h3>
            <span className="text-xs text-gray-400">({designs.length})</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {designs.map((d) => (
              <DesignCard
                key={d.id}
                design={d}
                onActivate={handleActivate}
                onDelete={handleDelete}
                onLoad={handleLoadDesign}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Save dialog ── */}
      <Dialog open={saveDialogOpen} onOpenChange={(v) => !v && setSaveDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sauvegarder ce design</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <Input
              label="Nom du design"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="ex: Couleurs printemps 2025"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && designName.trim()) handleSaveDesign()
              }}
            />
            {/* Color preview */}
            <div className="flex gap-1.5 mt-3">
              {[colors.walls, colors.roof, colors.trim, colors.door, colors.window].map((c, i) => (
                <div key={i} className="h-6 flex-1 rounded" style={{ backgroundColor: c }} />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Matériau: {WALL_MATERIALS.find(m => m.value === material)?.label} · {ROOF_OPTIONS.find(r => r.value === roofType)?.label}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveDesign}
              loading={saving}
              disabled={!designName.trim()}
            >
              <Save className="h-4 w-4" />
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
