// lib/supabase/types.ts
// ============================================================
// MEASURA – Supabase type definitions (complete)
// ============================================================

// ---- Scalar union types ----

export type UserRole         = 'admin' | 'entrepreneur' | 'client'
export type ProjectStatus    = 'draft' | 'photos_pending' | 'measuring' | 'review' | 'completed' | 'archived'
export type MeasurementType  = 'line' | 'area' | 'angle' | 'perimeter'
export type UnitSystem       = 'metric' | 'imperial'
export type MeasurementUnit  = 'm' | 'cm' | 'ft' | 'in'
export type RoofType         = 'gable' | 'hip' | 'flat' | 'shed'
export type FacadeLabel      = 'front' | 'back' | 'left' | 'right' | 'roof' | 'other'
export type ProjectMemberRole = 'owner' | 'editor' | 'client'

// New scalar union types
export type CompanyMemberRole  = 'owner' | 'admin' | 'employee' | 'estimator' | 'inspector'
export type SubscriptionTier   = 'free' | 'pro' | 'enterprise'
export type EstimateStatus     = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
export type EstimateWorkType   = 'painting' | 'roofing' | 'siding' | 'windows' | 'doors' | 'inspection' | 'insurance' | 'cleaning' | 'repair' | 'other'
export type EstimateItemCategory = 'labor' | 'material' | 'equipment' | 'overhead' | 'other'
export type EstimateItemUnit   = 'sqft' | 'sqm' | 'lf' | 'each' | 'hour' | 'day' | 'lot'
export type SurfaceType        = 'wall' | 'roof' | 'gable' | 'soffit' | 'fascia' | 'trim' | 'door' | 'window' | 'garage'
export type MaterialCategory   = 'paint' | 'primer' | 'siding' | 'roofing' | 'trim' | 'fasteners' | 'other'
export type MaterialUnit       = 'gallon' | 'sqft' | 'lf' | 'each' | 'bundle'
export type PhotoTagLabel      = 'damage' | 'repair' | 'attention' | 'completed' | 'good' | 'priority' | 'before' | 'after'
export type TaskStatus         = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
export type TaskPriority       = 'low' | 'medium' | 'high' | 'urgent'

// ============================================================
// Existing interfaces (unchanged except Project gets company_id)
// ============================================================

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  company_name: string | null
  phone: string | null
  avatar_url: string | null
  locale: 'fr' | 'en'
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  owner_id: string
  company_id?: string | null
  title: string
  address_line1: string | null
  address_city: string | null
  address_province: string | null
  address_postal: string | null
  address_country: string
  status: ProjectStatus
  unit_system: UnitSystem
  notes: string | null
  thumbnail_url: string | null
  created_at: string
  updated_at: string
  // Relations
  owner?: Profile
  company?: Company
  members?: ProjectMember[]
  photos?: Photo[]
  _count?: {
    photos: number
    measurements: number
  }
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string | null
  email: string
  role: ProjectMemberRole
  invite_token: string | null
  invite_accepted_at: string | null
  created_at: string
  profile?: Profile
}

export interface Photo {
  id: string
  project_id: string
  uploaded_by: string | null
  storage_path: string
  original_name: string | null
  width_px: number | null
  height_px: number | null
  file_size_bytes: number | null
  mime_type: string
  facade_label: FacadeLabel | null
  sort_order: number
  is_calibrated: boolean
  created_at: string
  // Relations
  url?: string
  calibration?: Calibration
  measurements?: Measurement[]
  tags?: PhotoTag[]
}

export interface Calibration {
  id: string
  photo_id: string
  x1: number
  y1: number
  x2: number
  y2: number
  real_length: number
  unit: MeasurementUnit
  px_per_unit: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MeasurementPoint {
  x: number
  y: number
}

export interface Measurement {
  id: string
  photo_id: string
  project_id: string
  label: string | null
  measurement_type: MeasurementType
  points: MeasurementPoint[]
  pixel_value: number | null
  real_value: number | null
  unit: MeasurementUnit
  facade_side: FacadeLabel | null
  color: string
  is_visible: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface HouseModel {
  id: string
  project_id: string
  geometry_json: Record<string, unknown> | null
  roof_type: RoofType
  wall_height: number | null
  footprint_json: [number, number][] | null
  generated_at: string | null
  gltf_storage_path: string | null
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  project_id: string
  generated_by: string | null
  storage_path: string | null
  version: number
  include_photos: boolean
  include_3d: boolean
  include_measurements: boolean
  locale: string
  created_at: string
  // Relations
  url?: string
}

// ============================================================
// New interfaces
// ============================================================

export interface Company {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  phone: string | null
  email: string | null
  website: string | null
  address_line1: string | null
  address_city: string | null
  address_province: string | null
  address_postal: string | null
  address_country: string
  tax_gst: number
  tax_qst: number
  default_markup: number
  default_labor_rate: number
  unit_system: UnitSystem
  locale: 'fr' | 'en'
  subscription_tier: SubscriptionTier
  is_active: boolean
  owner_id: string | null
  created_at: string
  updated_at: string
  // Relations
  owner?: Profile
  members?: CompanyMember[]
}

export interface CompanyMember {
  id: string
  company_id: string
  user_id: string
  role: CompanyMemberRole
  is_active: boolean
  invited_by: string | null
  joined_at: string | null
  created_at: string
  // Relations
  profile?: Profile
  company?: Company
}

export interface Estimate {
  id: string
  project_id: string
  company_id: string | null
  created_by: string | null
  title: string | null
  status: EstimateStatus
  work_type: EstimateWorkType | null
  subtotal: number
  tax_gst: number
  tax_qst: number
  total: number
  markup_percent: number
  labor_cost: number
  material_cost: number
  equipment_cost: number
  overhead_cost: number
  discount_amount: number
  notes: string | null
  valid_until: string | null   // ISO date string
  sent_at: string | null
  accepted_at: string | null
  locale: string
  created_at: string
  updated_at: string
  // Relations
  project?: Project
  company?: Company
  created_by_profile?: Profile
  items?: EstimateItem[]
  materials?: EstimateMaterial[]
}

export interface EstimateItem {
  id: string
  estimate_id: string
  sort_order: number
  category: EstimateItemCategory | null
  description: string
  quantity: number
  unit: EstimateItemUnit | null
  unit_price: number
  total: number    // GENERATED ALWAYS AS (quantity * unit_price) STORED
  is_optional: boolean
  notes: string | null
  created_at: string
}

export interface SurfaceCalculation {
  id: string
  project_id: string
  created_by: string | null
  facade_side: FacadeLabel | null
  surface_type: SurfaceType | null
  label: string | null
  gross_area: number | null
  opening_area: number
  net_area: number    // GENERATED ALWAYS AS (GREATEST(gross_area - opening_area, 0)) STORED
  perimeter: number | null
  length: number | null
  height: number | null
  pitch: number | null
  unit: string
  loss_factor: number
  // Position 2D de l'ouverture sur sa façade (migration 015). Repère mur :
  // position_x = décalage horizontal depuis le bord gauche du mur,
  // sill_height = hauteur de l'allège au-dessus du sol (unité = `unit`).
  position_x: number | null
  sill_height: number | null
  detected_by: 'manual' | 'ai' | 'photogrammetry' | null
  notes: string | null
  created_at: string
  updated_at: string
  // Relations
  project?: Project
}

export interface MaterialsCatalog {
  id: string
  company_id: string | null   // NULL = global catalog
  category: MaterialCategory | null
  name: string
  description: string | null
  unit: MaterialUnit | null
  coverage: number | null     // sqft per unit
  unit_cost: number | null
  brand: string | null
  is_active: boolean
  created_at: string
}

export interface EstimateMaterial {
  id: string
  estimate_id: string
  material_id: string | null
  surface_calc_id: string | null
  description: string
  quantity: number | null
  unit: string | null
  unit_cost: number | null
  total_cost: number | null
  waste_factor: number
  notes: string | null
  created_at: string
  // Relations
  material?: MaterialsCatalog
  surface_calculation?: SurfaceCalculation
}

export interface PhotoTag {
  id: string
  photo_id: string
  tag: PhotoTagLabel
  note: string | null
  x: number | null    // normalized 0-1 horizontal position on photo
  y: number | null    // normalized 0-1 vertical position on photo
  created_by: string | null
  created_at: string
  // Relations
  created_by_profile?: Profile
}

export interface Task {
  id: string
  project_id: string
  company_id: string | null
  created_by: string | null
  assigned_to: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null     // ISO date string
  completed_at: string | null
  photo_id: string | null
  created_at: string
  updated_at: string
  // Relations
  project?: Project
  company?: Company
  created_by_profile?: Profile
  assigned_to_profile?: Profile
  photo?: Photo
  comments?: TaskComment[]
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string | null
  content: string
  created_at: string
  // Relations
  author?: Profile
}

export interface DesignVersion {
  id: string
  project_id: string
  name: string
  is_active: boolean
  colors: {
    walls: string
    roof: string
    trim: string
    doors: string
    windows: string
    [key: string]: string
  }
  materials: Record<string, unknown>
  model_params: Record<string, unknown>
  thumbnail_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Relations
  created_by_profile?: Profile
}

// ============================================================
// Proposals & Inspections
// ============================================================

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'
export type InspectionStatus = 'in_progress' | 'completed' | 'archived'
export type InspectionCategory = 'crack' | 'water_damage' | 'paint' | 'siding' | 'roofing' | 'window' | 'door' | 'structural' | 'other'
export type InspectionPriority = 'low' | 'medium' | 'high' | 'urgent'
export type InspectionItemStatus = 'pending' | 'confirmed' | 'repaired' | 'ignored'

export interface Proposal {
  id: string
  project_id: string
  estimate_id: string | null
  created_by: string | null
  share_token: string
  title: string | null
  message: string | null
  status: ProposalStatus
  valid_until: string | null
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  rejected_at: string | null
  client_name: string | null
  client_email: string | null
  client_signature: string | null
  client_ip: string | null
  last_reminder_at: string | null
  reminder_count: number
  locale: 'fr' | 'en'
  created_at: string
  updated_at: string
  project?: Project
  estimate?: Estimate
}

export interface Inspection {
  id: string
  project_id: string
  created_by: string | null
  title: string
  notes: string | null
  status: InspectionStatus
  inspected_at: string | null
  created_at: string
  updated_at: string
  items?: InspectionItem[]
}

export interface InspectionItem {
  id: string
  inspection_id: string
  photo_id: string | null
  category: InspectionCategory
  title: string
  notes: string | null
  priority: InspectionPriority
  status: InspectionItemStatus
  x: number | null
  y: number | null
  created_at: string
  updated_at: string
  photo?: Photo
}

// ============================================================
// Work Orders (Bons de travail intelligents)
// ============================================================

export type WorkOrderStatus = 'draft' | 'issued' | 'in_progress' | 'completed' | 'signed' | 'cancelled'

export interface WorkOrderProduct {
  name: string
  brand: string | null
  color: string | null
  color_code: string | null
  quantity: number | null
  unit: string | null
  category: string | null
}

export interface WorkOrderInstructions {
  preparation?: string
  application?: string
  cleanup?: string
  quality_control?: string
}

export interface WorkOrderChecklistItem {
  label: string
  checked: boolean
}

export interface WorkOrderChecklist {
  before?: WorkOrderChecklistItem[]
  during?: WorkOrderChecklistItem[]
  after?: WorkOrderChecklistItem[]
}

export interface WorkOrderMeasurementLine {
  label: string
  value: number | null
  unit: string | null
  surface_type?: string | null
  facade_side?: string | null
}

export interface WorkOrder {
  id: string
  project_id: string
  estimate_id: string | null
  company_id: string | null
  created_by: string | null
  wo_number: number
  title: string | null
  status: WorkOrderStatus
  work_type: EstimateWorkType | null
  // Client snapshot
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  site_address: string | null
  // Scheduling / crew
  scheduled_date: string | null   // ISO date
  crew_lead: string | null
  crew_members: string | null
  estimated_hours: number | null
  // Content snapshots
  products: WorkOrderProduct[]
  instructions: WorkOrderInstructions
  checklist: WorkOrderChecklist
  measurements_summary: WorkOrderMeasurementLine[]
  photo_ids: string[]
  notes: string | null
  // Signatures
  crew_signature: string | null
  crew_signed_name: string | null
  crew_signed_at: string | null
  client_signature: string | null
  client_signed_name: string | null
  client_signed_at: string | null
  // PDF
  pdf_storage_path: string | null
  locale: 'fr' | 'en'
  created_at: string
  updated_at: string
  // Relations
  project?: Project
  estimate?: Estimate
  created_by_profile?: Profile
}

// ============================================================
// Gestion chantier & rapport journalier
// ============================================================

export type DailyReportStatus = 'draft' | 'submitted' | 'approved'
export type SiteIssueType = 'delay' | 'issue' | 'risk' | 'safety' | 'quality'
export type SiteIssueSeverity = 'low' | 'medium' | 'high' | 'critical'
export type SiteIssueStatus = 'open' | 'in_progress' | 'resolved'
export type DeliveryStatus = 'pending' | 'received' | 'delayed' | 'cancelled'
export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'wind' | 'cold' | 'hot'

export interface Employee {
  id: string
  owner_id: string
  company_id: string | null
  user_id: string | null
  full_name: string
  role: string | null
  email: string | null
  phone: string | null
  hourly_cost: number
  hourly_rate: number
  is_active: boolean
  notes: string | null
  team_id: string | null
  created_at: string
  updated_at: string
}
export interface Team {
  id: string
  owner_id: string
  company_id: string | null
  name: string
  color: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: string
  project_id: string
  daily_report_id: string | null
  employee_id: string | null
  employee_name: string | null
  work_date: string          // ISO date
  clock_in: string | null    // 'HH:MM[:SS]'
  clock_out: string | null
  break_minutes: number
  hours: number
  hourly_cost: number
  labor_cost: number         // GENERATED hours * hourly_cost
  gps_lat: number | null
  gps_lng: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Relations
  employee?: Employee
}

export interface DailyReportMaterial {
  id: string
  daily_report_id: string | null
  project_id: string
  material_id: string | null
  description: string
  quantity: number | null
  unit: string | null
  unit_cost: number | null
  total_cost: number         // GENERATED quantity * unit_cost
  created_at: string
}

export interface DailyReport {
  id: string
  project_id: string
  company_id: string | null
  created_by: string | null
  report_date: string        // ISO date
  weather: WeatherCondition | string | null
  temperature: number | null
  crew_summary: string | null
  work_performed: string | null
  progress_percent: number | null
  incidents: string | null
  comments: string | null
  status: DailyReportStatus
  generated_summary: string | null
  client_summary: string | null
  photo_ids: string[]
  pdf_storage_path: string | null
  created_at: string
  updated_at: string
  // Relations
  time_entries?: TimeEntry[]
  materials?: DailyReportMaterial[]
  issues?: SiteIssue[]
}

export interface SiteIssue {
  id: string
  project_id: string
  daily_report_id: string | null
  type: SiteIssueType
  severity: SiteIssueSeverity
  title: string
  description: string | null
  status: SiteIssueStatus
  reported_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface Delivery {
  id: string
  project_id: string
  supplier: string | null
  description: string
  quantity: string | null
  expected_date: string | null
  received_date: string | null
  status: DeliveryStatus
  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Facturation & paiements
// ============================================================

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled'
export type PaymentMethod = 'stripe' | 'cash' | 'cheque' | 'transfer' | 'other'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

export interface Invoice {
  id: string
  project_id: string
  company_id: string | null
  estimate_id: string | null
  created_by: string | null
  invoice_number: string
  status: InvoiceStatus
  client_name: string | null
  client_email: string | null
  client_address: string | null
  issue_date: string
  due_date: string | null
  currency: string
  subtotal: number
  discount_amount: number
  tax_gst_rate: number
  tax_qst_rate: number
  tax_gst: number
  tax_qst: number
  total: number
  deposit_amount: number
  amount_paid: number
  notes: string | null
  terms: string | null
  stripe_session_id: string | null
  stripe_payment_intent_id: string | null
  pdf_storage_path: string | null
  share_token: string
  locale: 'fr' | 'en'
  created_at: string
  updated_at: string
  // Relations
  items?: InvoiceItem[]
  payments?: Payment[]
  project?: Project
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  sort_order: number
  description: string
  quantity: number
  unit: string | null
  unit_price: number
  total: number   // GENERATED quantity * unit_price
  created_at: string
}

export interface Payment {
  id: string
  invoice_id: string
  project_id: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  is_deposit: boolean
  stripe_payment_intent_id: string | null
  stripe_session_id: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
}

// ============================================================
// CRM — Leads & pipeline
// ============================================================

export type LeadStage =
  | 'new' | 'contacted' | 'appointment' | 'measuring' | 'quote_sent'
  | 'follow_up' | 'won' | 'in_production' | 'invoiced' | 'completed' | 'lost'
export type LeadSource = 'referral' | 'website' | 'phone' | 'social' | 'ad' | 'walk_in' | 'other'
export type LeadPriority = 'low' | 'medium' | 'high'
export type LeadActivityType = 'note' | 'call' | 'email' | 'sms' | 'meeting' | 'stage_change' | 'task' | 'created'

export interface Lead {
  id: string
  owner_id: string
  company_id: string | null
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address_line1: string | null
  address_city: string | null
  address_province: string | null
  address_postal: string | null
  address_country: string
  source: LeadSource
  stage: LeadStage
  work_type: EstimateWorkType | null
  estimated_value: number
  priority: LeadPriority
  notes: string | null
  project_id: string | null
  expected_close_date: string | null
  lost_reason: string | null
  position: number
  last_activity_at: string
  created_at: string
  updated_at: string
  // Relations
  activities?: LeadActivity[]
}

export interface LeadActivity {
  id: string
  lead_id: string
  author_id: string | null
  type: LeadActivityType
  content: string | null
  metadata: Record<string, unknown>
  created_at: string
  // Relations
  author?: Profile
}

// ============================================================
// Automatisation (messagerie SMS / courriel)
// ============================================================

export type MessageChannel = 'email' | 'sms'
export type MessageStatus = 'queued' | 'sent' | 'failed'
export type ScheduledStatus = 'pending' | 'sent' | 'cancelled' | 'failed'

export interface MessageTemplate {
  id: string
  owner_id: string
  company_id: string | null
  name: string
  channel: MessageChannel
  subject: string | null
  body: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  owner_id: string | null
  lead_id: string | null
  project_id: string | null
  channel: MessageChannel
  direction: 'outbound' | 'inbound'
  to_address: string
  subject: string | null
  body: string
  status: MessageStatus
  provider_id: string | null
  error: string | null
  is_automated: boolean
  sent_at: string | null
  created_at: string
}

export interface AutomationRule {
  id: string
  owner_id: string
  company_id: string | null
  name: string
  is_active: boolean
  trigger_type: 'lead_stage_changed'
  trigger_stage: LeadStage
  channel: MessageChannel
  template_id: string | null
  delay_minutes: number
  created_at: string
  updated_at: string
  // Relations
  template?: MessageTemplate
}

export interface ScheduledMessage {
  id: string
  owner_id: string | null
  rule_id: string | null
  lead_id: string | null
  channel: MessageChannel
  to_address: string
  subject: string | null
  body: string
  run_at: string
  status: ScheduledStatus
  error: string | null
  sent_at: string | null
  created_at: string
}

// ============================================================
// Planification (calendrier)
// ============================================================

export type ScheduleEventType = 'job' | 'appointment' | 'meeting' | 'delivery' | 'other'
export type ScheduleStatus = 'planned' | 'confirmed' | 'in_progress' | 'done' | 'cancelled'

export interface ScheduleEvent {
  id: string
  owner_id: string
  company_id: string | null
  project_id: string | null
  work_order_id: string | null
  title: string
  event_type: ScheduleEventType
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  all_day: boolean
  status: ScheduleStatus
  color: string
  notes: string | null
  estimated_hours: number | null
  created_at: string
  updated_at: string
  // Relations
  assignments?: ScheduleAssignment[]
}

export interface ScheduleAssignment {
  id: string
  schedule_event_id: string
  employee_id: string
  created_at: string
  // Relations
  employee?: Employee
}

// ============================================================
// Certifications employés
// ============================================================

export type CertCategory = 'safety' | 'trade' | 'license' | 'training' | 'other'

export interface EmployeeCertification {
  id: string
  employee_id: string
  name: string
  issuer: string | null
  category: CertCategory
  issued_date: string | null
  expiry_date: string | null
  document_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Gestion matériaux / inventaire
// ============================================================

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled'
export type StockMovementType = 'in' | 'out' | 'adjust'

export interface Supplier {
  id: string
  owner_id: string
  company_id: string | null
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryItem {
  id: string
  owner_id: string
  company_id: string | null
  supplier_id: string | null
  sku: string | null
  name: string
  category: string | null
  unit: string
  unit_cost: number
  quantity_on_hand: number
  reorder_threshold: number
  location: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  supplier?: Supplier
}

export interface PurchaseOrder {
  id: string
  owner_id: string
  company_id: string | null
  supplier_id: string | null
  project_id: string | null
  po_number: string
  status: PurchaseOrderStatus
  order_date: string | null
  expected_date: string | null
  received_date: string | null
  notes: string | null
  total: number
  created_at: string
  updated_at: string
  supplier?: Supplier
  items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  inventory_item_id: string | null
  description: string
  quantity: number
  unit: string | null
  unit_cost: number
  total: number
  created_at: string
}

export interface StockMovement {
  id: string
  inventory_item_id: string
  owner_id: string | null
  project_id: string | null
  type: StockMovementType
  quantity: number
  reason: string | null
  created_at: string
}

// ============================================================
// Marketplace fournisseurs
// ============================================================

export type RfqStatus = 'open' | 'closed' | 'awarded'

export interface MarketplaceListing {
  id: string
  owner_id: string
  company_id: string | null
  title: string
  category: string | null
  description: string | null
  unit: string
  price: number | null
  region: string | null
  contact_email: string | null
  contact_phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Rfq {
  id: string
  owner_id: string
  company_id: string | null
  project_id: string | null
  title: string
  description: string | null
  category: string | null
  region: string | null
  status: RfqStatus
  needed_by: string | null
  created_at: string
  updated_at: string
  responses?: RfqResponse[]
}

export interface RfqResponse {
  id: string
  rfq_id: string
  supplier_owner_id: string
  supplier_name: string | null
  price: number | null
  lead_time_days: number | null
  message: string | null
  contact_email: string | null
  created_at: string
}

// ============================================================
// Connexions comptables
// ============================================================

export interface AccountingConnection {
  id: string
  owner_id: string
  provider: 'quickbooks'
  realm_id: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  connected_at: string | null
  created_at: string
  updated_at: string
}

// ============================================================
// Database helper type (Supabase client generic)
// ============================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
        Relationships: []
      }
      projects: {
        Row: Project
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'owner' | 'company' | 'members' | 'photos' | '_count'>
        Update: Partial<Omit<Project, 'id' | 'created_at' | 'owner' | 'company' | 'members' | 'photos' | '_count'>>
        Relationships: []
      }
      project_members: {
        Row: ProjectMember
        Insert: Omit<ProjectMember, 'id' | 'created_at' | 'profile'>
        Update: Partial<Omit<ProjectMember, 'id' | 'created_at' | 'profile'>>
        Relationships: []
      }
      photos: {
        Row: Photo
        Insert: Omit<Photo, 'id' | 'created_at' | 'url' | 'calibration' | 'measurements' | 'tags'>
        Update: Partial<Omit<Photo, 'id' | 'created_at' | 'url' | 'calibration' | 'measurements' | 'tags'>>
        Relationships: []
      }
      calibrations: {
        Row: Calibration
        Insert: Omit<Calibration, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Calibration, 'id' | 'created_at'>>
        Relationships: []
      }
      measurements: {
        Row: Measurement
        Insert: Omit<Measurement, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Measurement, 'id' | 'created_at'>>
        Relationships: []
      }
      house_models: {
        Row: HouseModel
        Insert: Omit<HouseModel, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<HouseModel, 'id' | 'created_at'>>
        Relationships: []
      }
      reports: {
        Row: Report
        Insert: Omit<Report, 'id' | 'created_at' | 'url'>
        Update: Partial<Omit<Report, 'id' | 'created_at' | 'url'>>
        Relationships: []
      }
      companies: {
        Row: Company
        Insert: Omit<Company, 'id' | 'created_at' | 'updated_at' | 'owner' | 'members'>
        Update: Partial<Omit<Company, 'id' | 'created_at' | 'owner' | 'members'>>
        Relationships: []
      }
      company_members: {
        Row: CompanyMember
        Insert: Omit<CompanyMember, 'id' | 'created_at' | 'profile' | 'company'>
        Update: Partial<Omit<CompanyMember, 'id' | 'created_at' | 'profile' | 'company'>>
        Relationships: []
      }
      estimates: {
        Row: Estimate
        Insert: Omit<Estimate, 'id' | 'created_at' | 'updated_at' | 'project' | 'company' | 'created_by_profile' | 'items' | 'materials'>
        Update: Partial<Omit<Estimate, 'id' | 'created_at' | 'project' | 'company' | 'created_by_profile' | 'items' | 'materials'>>
        Relationships: []
      }
      estimate_items: {
        Row: EstimateItem
        Insert: Omit<EstimateItem, 'id' | 'created_at' | 'total'>
        Update: Partial<Omit<EstimateItem, 'id' | 'created_at' | 'total'>>
        Relationships: []
      }
      surface_calculations: {
        Row: SurfaceCalculation
        Insert: Omit<SurfaceCalculation, 'id' | 'created_at' | 'updated_at' | 'net_area' | 'project'>
        Update: Partial<Omit<SurfaceCalculation, 'id' | 'created_at' | 'net_area' | 'project'>>
        Relationships: []
      }
      materials_catalog: {
        Row: MaterialsCatalog
        Insert: Omit<MaterialsCatalog, 'id' | 'created_at'>
        Update: Partial<Omit<MaterialsCatalog, 'id' | 'created_at'>>
        Relationships: []
      }
      estimate_materials: {
        Row: EstimateMaterial
        Insert: Omit<EstimateMaterial, 'id' | 'created_at' | 'material' | 'surface_calculation'>
        Update: Partial<Omit<EstimateMaterial, 'id' | 'created_at' | 'material' | 'surface_calculation'>>
        Relationships: []
      }
      photo_tags: {
        Row: PhotoTag
        Insert: Omit<PhotoTag, 'id' | 'created_at' | 'created_by_profile'>
        Update: Partial<Omit<PhotoTag, 'id' | 'created_at' | 'created_by_profile'>>
        Relationships: []
      }
      tasks: {
        Row: Task
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'project' | 'company' | 'created_by_profile' | 'assigned_to_profile' | 'photo' | 'comments'>
        Update: Partial<Omit<Task, 'id' | 'created_at' | 'project' | 'company' | 'created_by_profile' | 'assigned_to_profile' | 'photo' | 'comments'>>
        Relationships: []
      }
      task_comments: {
        Row: TaskComment
        Insert: Omit<TaskComment, 'id' | 'created_at' | 'author'>
        Update: Partial<Omit<TaskComment, 'id' | 'created_at' | 'author'>>
        Relationships: []
      }
      design_versions: {
        Row: DesignVersion
        Insert: Omit<DesignVersion, 'id' | 'created_at' | 'updated_at' | 'created_by_profile'>
        Update: Partial<Omit<DesignVersion, 'id' | 'created_at' | 'created_by_profile'>>
        Relationships: []
      }
      proposals: {
        Row: Proposal
        Insert: Omit<Proposal, 'id' | 'created_at' | 'updated_at' | 'share_token' | 'project' | 'estimate'>
        Update: Partial<Omit<Proposal, 'id' | 'created_at' | 'project' | 'estimate'>>
        Relationships: []
      }
      inspections: {
        Row: Inspection
        Insert: Omit<Inspection, 'id' | 'created_at' | 'updated_at' | 'items'>
        Update: Partial<Omit<Inspection, 'id' | 'created_at' | 'items'>>
        Relationships: []
      }
      inspection_items: {
        Row: InspectionItem
        Insert: Omit<InspectionItem, 'id' | 'created_at' | 'updated_at' | 'photo'>
        Update: Partial<Omit<InspectionItem, 'id' | 'created_at' | 'photo'>>
        Relationships: []
      }
      work_orders: {
        Row: WorkOrder
        Insert: Omit<WorkOrder, 'id' | 'created_at' | 'updated_at' | 'project' | 'estimate' | 'created_by_profile'>
        Update: Partial<Omit<WorkOrder, 'id' | 'created_at' | 'project' | 'estimate' | 'created_by_profile'>>
        Relationships: []
      }
      employees: {
        Row: Employee
        Insert: Omit<Employee, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Employee, 'id' | 'created_at'>>
        Relationships: []
      }
      daily_reports: {
        Row: DailyReport
        Insert: Omit<DailyReport, 'id' | 'created_at' | 'updated_at' | 'time_entries' | 'materials' | 'issues'>
        Update: Partial<Omit<DailyReport, 'id' | 'created_at' | 'time_entries' | 'materials' | 'issues'>>
        Relationships: []
      }
      time_entries: {
        Row: TimeEntry
        Insert: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'labor_cost' | 'employee'>
        Update: Partial<Omit<TimeEntry, 'id' | 'created_at' | 'labor_cost' | 'employee'>>
        Relationships: []
      }
      daily_report_materials: {
        Row: DailyReportMaterial
        Insert: Omit<DailyReportMaterial, 'id' | 'created_at' | 'total_cost'>
        Update: Partial<Omit<DailyReportMaterial, 'id' | 'created_at' | 'total_cost'>>
        Relationships: []
      }
      site_issues: {
        Row: SiteIssue
        Insert: Omit<SiteIssue, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SiteIssue, 'id' | 'created_at'>>
        Relationships: []
      }
      deliveries: {
        Row: Delivery
        Insert: Omit<Delivery, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Delivery, 'id' | 'created_at'>>
        Relationships: []
      }
      invoices: {
        Row: Invoice
        Insert: Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'share_token' | 'items' | 'payments' | 'project'>
        Update: Partial<Omit<Invoice, 'id' | 'created_at' | 'items' | 'payments' | 'project'>>
        Relationships: []
      }
      invoice_items: {
        Row: InvoiceItem
        Insert: Omit<InvoiceItem, 'id' | 'created_at' | 'total'>
        Update: Partial<Omit<InvoiceItem, 'id' | 'created_at' | 'total'>>
        Relationships: []
      }
      payments: {
        Row: Payment
        Insert: Omit<Payment, 'id' | 'created_at'>
        Update: Partial<Omit<Payment, 'id' | 'created_at'>>
        Relationships: []
      }
      leads: {
        Row: Lead
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'activities'>
        Update: Partial<Omit<Lead, 'id' | 'created_at' | 'activities'>>
        Relationships: []
      }
      lead_activities: {
        Row: LeadActivity
        Insert: Omit<LeadActivity, 'id' | 'created_at' | 'author'>
        Update: Partial<Omit<LeadActivity, 'id' | 'created_at' | 'author'>>
        Relationships: []
      }
      message_templates: {
        Row: MessageTemplate
        Insert: Omit<MessageTemplate, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MessageTemplate, 'id' | 'created_at'>>
        Relationships: []
      }
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'created_at'>
        Update: Partial<Omit<Message, 'id' | 'created_at'>>
        Relationships: []
      }
      automation_rules: {
        Row: AutomationRule
        Insert: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at' | 'template'>
        Update: Partial<Omit<AutomationRule, 'id' | 'created_at' | 'template'>>
        Relationships: []
      }
      scheduled_messages: {
        Row: ScheduledMessage
        Insert: Omit<ScheduledMessage, 'id' | 'created_at'>
        Update: Partial<Omit<ScheduledMessage, 'id' | 'created_at'>>
        Relationships: []
      }
      schedule_events: {
        Row: ScheduleEvent
        Insert: Omit<ScheduleEvent, 'id' | 'created_at' | 'updated_at' | 'assignments'>
        Update: Partial<Omit<ScheduleEvent, 'id' | 'created_at' | 'assignments'>>
        Relationships: []
      }
      schedule_assignments: {
        Row: ScheduleAssignment
        Insert: Omit<ScheduleAssignment, 'id' | 'created_at' | 'employee'>
        Update: Partial<Omit<ScheduleAssignment, 'id' | 'created_at' | 'employee'>>
        Relationships: []
      }
      employee_certifications: {
        Row: EmployeeCertification
        Insert: Omit<EmployeeCertification, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EmployeeCertification, 'id' | 'created_at'>>
        Relationships: []
      }
      suppliers: {
        Row: Supplier
        Insert: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Supplier, 'id' | 'created_at'>>
        Relationships: []
      }
      inventory_items: {
        Row: InventoryItem
        Insert: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at' | 'supplier'>
        Update: Partial<Omit<InventoryItem, 'id' | 'created_at' | 'supplier'>>
        Relationships: []
      }
      purchase_orders: {
        Row: PurchaseOrder
        Insert: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at' | 'supplier' | 'items'>
        Update: Partial<Omit<PurchaseOrder, 'id' | 'created_at' | 'supplier' | 'items'>>
        Relationships: []
      }
      purchase_order_items: {
        Row: PurchaseOrderItem
        Insert: Omit<PurchaseOrderItem, 'id' | 'created_at' | 'total'>
        Update: Partial<Omit<PurchaseOrderItem, 'id' | 'created_at' | 'total'>>
        Relationships: []
      }
      stock_movements: {
        Row: StockMovement
        Insert: Omit<StockMovement, 'id' | 'created_at'>
        Update: Partial<Omit<StockMovement, 'id' | 'created_at'>>
        Relationships: []
      }
      accounting_connections: {
        Row: AccountingConnection
        Insert: Omit<AccountingConnection, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AccountingConnection, 'id' | 'created_at'>>
        Relationships: []
      }
      marketplace_listings: {
        Row: MarketplaceListing
        Insert: Omit<MarketplaceListing, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MarketplaceListing, 'id' | 'created_at'>>
        Relationships: []
      }
      rfqs: {
        Row: Rfq
        Insert: Omit<Rfq, 'id' | 'created_at' | 'updated_at' | 'responses'>
        Update: Partial<Omit<Rfq, 'id' | 'created_at' | 'responses'>>
        Relationships: []
      }
      rfq_responses: {
        Row: RfqResponse
        Insert: Omit<RfqResponse, 'id' | 'created_at'>
        Update: Partial<Omit<RfqResponse, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
