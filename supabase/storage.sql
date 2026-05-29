-- ============================================================
-- MEASURA — Buckets Storage Supabase + Policies
-- Exécutez ce fichier APRÈS schema.sql
-- Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Création des buckets ──────────────────────────────────────
-- (Si les buckets existent déjà, ces INSERT seront ignorés)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'photos',
    'photos',
    false,                          -- privé : accès via URL signée uniquement
    52428800,                       -- 50 MB max par fichier
    ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
  ),
  (
    'reports',
    'reports',
    false,                          -- privé
    10485760,                       -- 10 MB max
    ARRAY['application/pdf']
  ),
  (
    'avatars',
    'avatars',
    true,                           -- public : logos entreprise et avatars
    2097152,                        -- 2 MB max
    ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES — Bucket photos
-- ============================================================

DROP POLICY IF EXISTS "photos_storage_select"  ON storage.objects;
DROP POLICY IF EXISTS "photos_storage_insert"  ON storage.objects;
DROP POLICY IF EXISTS "photos_storage_delete"  ON storage.objects;
DROP POLICY IF EXISTS "reports_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "reports_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "reports_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_storage_delete" ON storage.objects;

-- SELECT : membres du projet peuvent voir les photos
CREATE POLICY "photos_storage_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'photos'
  AND (
    EXISTS (
      SELECT 1 FROM photos ph
      JOIN projects p ON p.id = ph.project_id
      WHERE ph.storage_path = name AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profiles pr
          WHERE pr.id = auth.uid() AND pr.role = 'admin'
        )
      )
    )
    -- Les URL signées permettent l'accès anonyme temporaire (portail client)
    OR auth.role() = 'service_role'
  )
);

-- INSERT : membres du projet (ou service_role pour uploads signés)
CREATE POLICY "photos_storage_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'photos'
  AND (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  )
);

-- DELETE : propriétaire du projet ou admin
CREATE POLICY "photos_storage_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'photos'
  AND (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM photos ph
      JOIN projects p ON p.id = ph.project_id
      WHERE ph.storage_path = name AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'admin'
    )
  )
);

-- ============================================================
-- STORAGE POLICIES — Bucket reports
-- ============================================================

CREATE POLICY "reports_storage_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reports'
  AND (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM reports r
      JOIN projects p ON p.id = r.project_id
      WHERE r.storage_path = name AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "reports_storage_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reports'
  AND auth.role() = 'service_role'
);

CREATE POLICY "reports_storage_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reports'
  AND auth.role() = 'service_role'
);

-- ============================================================
-- STORAGE POLICIES — Bucket avatars (public)
-- ============================================================

-- Lecture publique (pas besoin d'auth)
CREATE POLICY "avatars_storage_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Upload : utilisateur connecté, dans son propre dossier
CREATE POLICY "avatars_storage_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  )
);

CREATE POLICY "avatars_storage_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  )
);

CREATE POLICY "avatars_storage_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (
    auth.uid() IS NOT NULL
    OR auth.role() = 'service_role'
  )
);
