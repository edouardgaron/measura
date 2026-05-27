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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
