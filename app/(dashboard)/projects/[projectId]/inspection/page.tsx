'use client'

import { use, useState, useEffect, useCallback } from 'react'
import {
  Plus, AlertTriangle, CheckCircle2, WrenchIcon,
  Trash2, Droplets, Home, Paintbrush,
  Square, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import type { Inspection, InspectionItem, InspectionCategory, InspectionPriority, InspectionItemStatus } from '@/lib/supabase/types'

interface Props { params: Promise<{ projectId: string }> }

const CATEGORY_CONFIG: Record<InspectionCategory, { label: string; icon: React.ReactNode; color: string }> = {
  crack:        { label: 'Fissure',      icon: <AlertTriangle className="h-4 w-4" />, color: 'text-orange-500' },
  water_damage: { label: 'Infiltration', icon: <Droplets className="h-4 w-4" />,      color: 'text-blue-500' },
  paint:        { label: 'Peinture',     icon: <Paintbrush className="h-4 w-4" />,    color: 'text-purple-500' },
  siding:       { label: 'Revêtement',   icon: <Layers className="h-4 w-4" />,        color: 'text-yellow-600' },
  roofing:      { label: 'Toiture',      icon: <Home className="h-4 w-4" />,          color: 'text-red-500' },
  window:       { label: 'Fenêtre',      icon: <Square className="h-4 w-4" />,        color: 'text-teal-500' },
  door:         { label: 'Porte',        icon: <Square className="h-4 w-4" />,        color: 'text-indigo-500' },
  structural:   { label: 'Structure',    icon: <Home className="h-4 w-4" />,          color: 'text-red-700' },
  other:        { label: 'Autre',        icon: <WrenchIcon className="h-4 w-4" />,    color: 'text-gray-500' },
}

const PRIORITY_CONFIG: Record<InspectionPriority, { label: string; className: string }> = {
  low:    { label: 'Faible', className: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Moyen',  className: 'bg-yellow-100 text-yellow-700' },
  high:   { label: 'Élevé',  className: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700' },
}

const STATUS_NEXT: Record<InspectionItemStatus, InspectionItemStatus> = {
  pending:   'confirmed',
  confirmed: 'repaired',
  repaired:  'repaired',
  ignored:   'ignored',
}

const STATUS_LABEL: Record<InspectionItemStatus, string> = {
  pending:   'À vérifier',
  confirmed: 'Confirmé',
  repaired:  'Réparé',
  ignored:   'Ignoré',
}

const STATUS_CLASS: Record<InspectionItemStatus, string> = {
  pending:   'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  repaired:  'bg-green-100 text-green-700',
  ignored:   'bg-neutral-100 text-neutral-400',
}

interface InspectionWithItems extends Inspection { items: InspectionItem[] }

export default function InspectionPage({ params }: Props) {
  const { projectId } = use(params)
  const [inspections, setInspections] = useState<InspectionWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [showItemDialog, setShowItemDialog] = useState(false)
  const [activeInspectionId, setActiveInspectionId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [itemForm, setItemForm] = useState({
    category: 'other' as InspectionCategory,
    title: '',
    notes: '',
    priority: 'medium' as InspectionPriority,
  })

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/inspection`)
    const json = await res.json()
    setInspections(json.inspections ?? [])
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function createInspection() {
    const res = await fetch(`/api/projects/${projectId}/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Inspection — ${new Date().toLocaleDateString('fr-CA')}` }),
    })
    const json = await res.json()
    if (res.ok) {
      load()
      setActiveInspectionId(json.inspection.id)
      setShowItemDialog(true)
    }
  }

  async function addItem() {
    if (!itemForm.title.trim()) {
      toast({ variant: 'error', title: 'Titre requis' })
      return
    }
    setSaving(true)
    const inspId = activeInspectionId ?? (inspections[0]?.id ?? null)
    if (!inspId) { await createInspection(); setSaving(false); return }

    const res = await fetch(`/api/projects/${projectId}/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...itemForm, inspection_id: inspId }),
    })
    if (res.ok) {
      toast({ variant: 'success', title: 'Dommage ajouté' })
      setItemForm({ category: 'other', title: '', notes: '', priority: 'medium' })
      setShowItemDialog(false)
      load()
    } else {
      const j = await res.json()
      toast({ variant: 'error', title: j.error })
    }
    setSaving(false)
  }

  async function advanceStatus(itemId: string, current: InspectionItemStatus) {
    const next = STATUS_NEXT[current]
    if (next === current) return
    await fetch(`/api/projects/${projectId}/inspection`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, type: 'item', status: next }),
    })
    load()
  }

  async function deleteItem(itemId: string) {
    if (!confirm('Supprimer ce dommage ?')) return
    await fetch(`/api/projects/${projectId}/inspection?id=${itemId}&type=item`, { method: 'DELETE' })
    load()
  }

  const totalItems = inspections.reduce((s, i) => s + i.items.length, 0)
  const pendingItems = inspections.reduce((s, i) => s + i.items.filter(it => it.status === 'pending').length, 0)
  const repairedItems = inspections.reduce((s, i) => s + i.items.filter(it => it.status === 'repaired').length, 0)

  function openAddItem() {
    if (inspections.length > 0) {
      setActiveInspectionId(inspections[0].id)
      setShowItemDialog(true)
    } else {
      createInspection()
    }
  }

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Inspection & Dommages</h2>
          <p className="text-sm text-gray-500 mt-0.5">Documentez et suivez les dommages du bâtiment.</p>
        </div>
        <Button onClick={openAddItem} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter un dommage
        </Button>
      </div>

      {/* Stats */}
      {totalItems > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total dommages', value: totalItems, className: 'bg-white' },
            { label: 'À vérifier', value: pendingItems, className: 'bg-orange-50' },
            { label: 'Réparés', value: repairedItems, className: 'bg-green-50' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-gray-200 p-4 ${s.className}`}>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Items list */}
      {totalItems === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-base font-medium text-gray-700">Aucun dommage enregistré</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">
            Documentez les dommages du bâtiment pour les inclure dans votre rapport.
          </p>
          <Button size="sm" onClick={openAddItem} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            Ajouter un dommage
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {inspections.map(insp => (
            <div key={insp.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">{insp.title}</h3>
                  <span className="text-xs text-gray-400">{new Date(insp.created_at).toLocaleDateString('fr-CA')}</span>
                </div>
                <button
                  onClick={() => { setActiveInspectionId(insp.id); setShowItemDialog(true) }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + Ajouter
                </button>
              </div>
              {insp.items.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aucun dommage dans cette inspection.</p>
              ) : (
                <div className="space-y-2">
                  {insp.items.map(item => {
                    const cat = CATEGORY_CONFIG[item.category]
                    const pri = PRIORITY_CONFIG[item.priority]
                    const statusCls = STATUS_CLASS[item.status]
                    return (
                      <Card key={item.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`shrink-0 mt-0.5 ${cat.color}`}>{cat.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">{item.title}</span>
                                <span className="text-xs text-gray-400">{cat.label}</span>
                              </div>
                              {item.notes && <p className="text-xs text-gray-500 mt-0.5">{item.notes}</p>}
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${pri.className}`}>
                                  {pri.label}
                                </span>
                                <button
                                  onClick={() => advanceStatus(item.id, item.status)}
                                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusCls}`}
                                  title={item.status !== 'repaired' ? 'Cliquer pour avancer le statut' : undefined}
                                >
                                  {STATUS_LABEL[item.status]}
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un dommage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Catégorie</label>
              <select
                value={itemForm.category}
                onChange={e => setItemForm(f => ({ ...f, category: e.target.value as InspectionCategory }))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <Input
              label="Description *"
              placeholder="Ex : Fissure verticale coin nord-est"
              value={itemForm.title}
              onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Notes</label>
              <textarea
                rows={3}
                placeholder="Détails supplémentaires…"
                value={itemForm.notes}
                onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Priorité</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(PRIORITY_CONFIG) as [InspectionPriority, { label: string; className: string }][]).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setItemForm(f => ({ ...f, priority: k }))}
                    className={`rounded-lg px-2 py-1.5 text-xs font-medium border-2 transition-colors ${itemForm.priority === k ? `${v.className} border-current` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>Annuler</Button>
            <Button onClick={addItem} disabled={saving}>
              {saving ? 'Ajout…' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
