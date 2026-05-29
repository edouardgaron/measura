-- 004_photo_pipeline.sql
-- Extends photos table and adds processing infrastructure

-- Extend photos table with quality + extended category
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS photo_category TEXT DEFAULT 'other'
    CHECK (photo_category IN ('front_elevation','rear_elevation','left_elevation','right_elevation',
      'front_left_corner','front_right_corner','rear_left_corner','rear_right_corner',
      'roof_front','roof_rear','window_detail','door_detail','material_detail','damage','other')),
  ADD COLUMN IF NOT EXISTS quality_status TEXT DEFAULT 'pending'
    CHECK (quality_status IN ('pending','good','warning','rejected')),
  ADD COLUMN IF NOT EXISTS quality_issues JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_score INTEGER,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT;

-- Processing jobs table
CREATE TABLE IF NOT EXISTS project_processing_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
    'photo_quality_analysis','photo_grouping','manual_model_generation',
    'ai_model_generation','measurement_extraction','pdf_generation'
  )),
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued','processing','needs_user_input','completed','failed'
  )),
  progress        INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  current_step    TEXT,
  error_message   TEXT,
  input_data      JSONB,
  output_data     JSONB,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Photo measurements (pixel calibration on photo)
CREATE TABLE IF NOT EXISTS photo_measurements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id        UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'calibration'
    CHECK (type IN ('calibration','line','annotation')),
  points_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
  pixel_distance  NUMERIC(10,4),
  real_distance   NUMERIC(10,4),
  unit            TEXT DEFAULT 'ft',
  label           TEXT,
  confidence      NUMERIC(5,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at on processing jobs
CREATE TRIGGER update_processing_jobs_updated_at
  BEFORE UPDATE ON project_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE project_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processing_jobs_project_member" ON project_processing_jobs
  FOR ALL USING (is_project_owner(project_id) OR is_project_member(project_id));

CREATE POLICY "photo_measurements_project_member" ON photo_measurements
  FOR ALL USING (is_project_owner(project_id) OR is_project_member(project_id));
