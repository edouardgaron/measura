// lib/work-order/builder.ts
// ============================================================
// Génère un brouillon de bon de travail intelligent à partir
// des données déjà saisies : projet, estimation, mesures, surfaces.
// Pur (aucun I/O) — testable et réutilisable côté serveur.
// ============================================================

import type {
  EstimateItem,
  EstimateMaterial,
  EstimateWorkType,
  Measurement,
  SurfaceCalculation,
  WorkOrderChecklist,
  WorkOrderInstructions,
  WorkOrderMeasurementLine,
  WorkOrderProduct,
} from '@/lib/supabase/types'

// ── Checklists par défaut, par type de travaux ────────────────────────────────

const CHECKLISTS: Record<string, WorkOrderChecklist> = {
  painting: {
    before: [
      { label: 'Protéger les surfaces et le mobilier (toiles, ruban)', checked: false },
      { label: 'Laver / dégraisser les surfaces à peindre', checked: false },
      { label: 'Gratter et sabler les zones écaillées', checked: false },
      { label: 'Calfeutrer fissures et joints', checked: false },
      { label: 'Appliquer apprêt sur surfaces nues', checked: false },
    ],
    during: [
      { label: 'Respecter le nombre de couches prévu', checked: false },
      { label: 'Respecter les temps de séchage entre couches', checked: false },
      { label: 'Vérifier l’uniformité de la couleur', checked: false },
      { label: 'Découpe nette aux bordures et moulures', checked: false },
    ],
    after: [
      { label: 'Retirer toiles et rubans de protection', checked: false },
      { label: 'Nettoyer le chantier et les outils', checked: false },
      { label: 'Inspection finale avec le client', checked: false },
      { label: 'Photos après travaux', checked: false },
    ],
  },
  roofing: {
    before: [
      { label: 'Sécuriser la zone (harnais, périmètre)', checked: false },
      { label: 'Vérifier la météo (pas de pluie/vent fort)', checked: false },
      { label: 'Protéger gouttières et façades', checked: false },
      { label: 'Retirer l’ancien revêtement si requis', checked: false },
    ],
    during: [
      { label: 'Installer la membrane de sous-couche', checked: false },
      { label: 'Respecter le recouvrement des bardeaux', checked: false },
      { label: 'Installer solins et ventilation', checked: false },
      { label: 'Vérifier l’étanchéité des pénétrations', checked: false },
    ],
    after: [
      { label: 'Ramasser clous et débris (balai magnétique)', checked: false },
      { label: 'Nettoyer gouttières', checked: false },
      { label: 'Inspection finale et test d’étanchéité', checked: false },
      { label: 'Photos après travaux', checked: false },
    ],
  },
  siding: {
    before: [
      { label: 'Vérifier l’état du revêtement existant', checked: false },
      { label: 'Installer le pare-air / pare-intempérie', checked: false },
      { label: 'Protéger fenêtres et portes', checked: false },
    ],
    during: [
      { label: 'Poser les fourrures de niveau', checked: false },
      { label: 'Respecter le jeu de dilatation', checked: false },
      { label: 'Installer moulures de coin et de finition', checked: false },
      { label: 'Calfeutrer les jonctions', checked: false },
    ],
    after: [
      { label: 'Nettoyer le chantier', checked: false },
      { label: 'Inspection finale avec le client', checked: false },
      { label: 'Photos après travaux', checked: false },
    ],
  },
  windows: {
    before: [
      { label: 'Mesurer et confirmer les dimensions', checked: false },
      { label: 'Protéger l’intérieur (poussière)', checked: false },
      { label: 'Retirer l’ancienne fenêtre', checked: false },
    ],
    during: [
      { label: 'Vérifier l’aplomb et le niveau', checked: false },
      { label: 'Caler et fixer solidement', checked: false },
      { label: 'Isoler le pourtour (uréthane bas expansion)', checked: false },
      { label: 'Installer pare-air et solin', checked: false },
    ],
    after: [
      { label: 'Calfeutrer extérieur et intérieur', checked: false },
      { label: 'Vérifier ouverture/fermeture', checked: false },
      { label: 'Nettoyer et photos après travaux', checked: false },
    ],
  },
}

const DEFAULT_CHECKLIST: WorkOrderChecklist = {
  before: [
    { label: 'Vérifier l’accès et sécuriser le chantier', checked: false },
    { label: 'Confirmer matériaux et quantités livrés', checked: false },
    { label: 'Photos avant travaux', checked: false },
  ],
  during: [
    { label: 'Respecter les instructions du fabricant', checked: false },
    { label: 'Contrôle qualité en cours de travaux', checked: false },
  ],
  after: [
    { label: 'Nettoyer le chantier', checked: false },
    { label: 'Inspection finale avec le client', checked: false },
    { label: 'Photos après travaux', checked: false },
  ],
}

// ── Instructions par défaut ───────────────────────────────────────────────────

const INSTRUCTIONS: Record<string, WorkOrderInstructions> = {
  painting: {
    preparation: 'Nettoyer, gratter et apprêter toutes les surfaces. Protéger les zones adjacentes. Calfeutrer fissures et joints.',
    application: 'Appliquer le nombre de couches prévu en respectant les temps de séchage du fabricant. Travailler par sections.',
    cleanup: 'Retirer protections, nettoyer outils et surfaces, disposer des résidus selon la réglementation.',
    quality_control: 'Vérifier uniformité, couverture, découpes et absence de coulisses sous éclairage adéquat.',
  },
  roofing: {
    preparation: 'Sécuriser la zone, vérifier la météo, protéger les façades et gouttières.',
    application: 'Installer sous-couche, bardeaux/membrane et solins selon les recouvrements requis.',
    cleanup: 'Ramassage complet des clous et débris, nettoyage des gouttières.',
    quality_control: 'Test d’étanchéité, vérification des pénétrations et de la ventilation.',
  },
}

const DEFAULT_INSTRUCTIONS: WorkOrderInstructions = {
  preparation: 'Préparer et sécuriser le chantier. Confirmer les matériaux et l’accès.',
  application: 'Réaliser les travaux selon les normes et les instructions du fabricant.',
  cleanup: 'Nettoyer le chantier et disposer des résidus de façon responsable.',
  quality_control: 'Effectuer un contrôle qualité final et valider avec le client.',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WORK_TYPE_LABELS: Record<string, string> = {
  painting: 'Peinture',
  roofing: 'Toiture',
  siding: 'Revêtement',
  windows: 'Fenêtres',
  doors: 'Portes',
  inspection: 'Inspection',
  insurance: 'Assurance',
  cleaning: 'Nettoyage',
  repair: 'Réparation',
  other: 'Travaux',
}

export function workTypeLabel(workType: EstimateWorkType | string | null): string {
  if (!workType) return 'Travaux'
  return WORK_TYPE_LABELS[workType] ?? 'Travaux'
}

// ── Builder ───────────────────────────────────────────────────────────────────

export interface BuildWorkOrderInput {
  workType?: EstimateWorkType | null
  estimateItems?: EstimateItem[]
  estimateMaterials?: EstimateMaterial[]
  surfaces?: SurfaceCalculation[]
  measurements?: Measurement[]
}

export interface WorkOrderDraft {
  products: WorkOrderProduct[]
  instructions: WorkOrderInstructions
  checklist: WorkOrderChecklist
  measurements_summary: WorkOrderMeasurementLine[]
}

/**
 * Construit un brouillon de bon de travail à partir des données du projet.
 * Les produits proviennent en priorité des matériaux d'estimation, sinon des
 * lignes d'estimation de catégorie « material ».
 */
export function buildWorkOrderDraft(input: BuildWorkOrderInput): WorkOrderDraft {
  const workType = input.workType ?? 'other'

  // ── Produits ──
  const products: WorkOrderProduct[] = []

  for (const m of input.estimateMaterials ?? []) {
    products.push({
      name: m.description || m.material?.name || 'Matériau',
      brand: m.material?.brand ?? null,
      color: null,
      color_code: null,
      quantity: m.quantity ?? null,
      unit: m.unit ?? m.material?.unit ?? null,
      category: m.material?.category ?? 'material',
    })
  }

  // Fallback : lignes d'estimation matérielles s'il n'y a pas de matériaux dédiés
  if (products.length === 0) {
    for (const item of input.estimateItems ?? []) {
      if (item.category === 'material') {
        products.push({
          name: item.description || 'Matériau',
          brand: null,
          color: null,
          color_code: null,
          quantity: item.quantity ?? null,
          unit: item.unit ?? null,
          category: 'material',
        })
      }
    }
  }

  // ── Récapitulatif des mesures ──
  const measurements_summary: WorkOrderMeasurementLine[] = []

  for (const s of input.surfaces ?? []) {
    if (s.net_area == null && s.gross_area == null) continue
    measurements_summary.push({
      label: s.label || surfaceTypeLabel(s.surface_type),
      value: s.net_area ?? s.gross_area ?? null,
      unit: s.unit ?? 'pi²',
      surface_type: s.surface_type ?? null,
      facade_side: s.facade_side ?? null,
    })
  }

  // Si aucune surface calculée, reprendre les mesures « area »/« perimeter »
  if (measurements_summary.length === 0) {
    for (const m of input.measurements ?? []) {
      if (m.real_value == null) continue
      if (m.measurement_type === 'area' || m.measurement_type === 'perimeter') {
        measurements_summary.push({
          label: m.label || (m.measurement_type === 'area' ? 'Surface' : 'Périmètre'),
          value: m.real_value,
          unit: m.unit,
          facade_side: m.facade_side ?? null,
        })
      }
    }
  }

  return {
    products,
    instructions: INSTRUCTIONS[workType] ?? DEFAULT_INSTRUCTIONS,
    checklist: CHECKLISTS[workType] ?? DEFAULT_CHECKLIST,
    measurements_summary,
  }
}

function surfaceTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    wall: 'Murs',
    roof: 'Toiture',
    gable: 'Pignon',
    soffit: 'Soffite',
    fascia: 'Fascia',
    trim: 'Moulures',
    door: 'Porte',
    window: 'Fenêtre',
    garage: 'Garage',
  }
  return (type && labels[type]) || 'Surface'
}
