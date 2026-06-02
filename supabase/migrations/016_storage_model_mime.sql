-- ============================================================
-- 016_storage_model_mime.sql
-- Le bucket `reports` n'autorisait que application/pdf, ce qui faisait échouer
-- l'upload des modèles 3D (glTF/GLB) générés par la reconstruction paramétrique
-- ET le provider dense externe ("mime type model/gltf+json is not supported").
-- On élargit les types autorisés et la taille max (modèles 3D plus lourds).
-- Idempotent.
-- ============================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
      'application/pdf',
      'model/gltf+json',
      'model/gltf-binary',
      'application/octet-stream'
    ],
    file_size_limit = 52428800   -- 50 MB (modèles 3D)
WHERE id = 'reports';
