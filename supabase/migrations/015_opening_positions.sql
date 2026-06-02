-- ============================================================
-- 015_opening_positions.sql
-- Position 2D réelle des ouvertures (fenêtres / portes) sur leur façade,
-- pour des élévations exactes dans le rapport (style Hover).
--
-- Le repère est relatif au MUR de la façade :
--   position_x  = distance horizontale du bord GAUCHE du mur jusqu'au bord
--                 gauche de l'ouverture (même unité que `unit`, p. ex. ft)
--   sill_height = hauteur de l'ALLÈGE (bas de l'ouverture) au-dessus du sol
--                 (même unité). Le haut = sill_height + height.
--   La largeur de l'ouverture = `length`, sa hauteur = `height`
--   (colonnes déjà présentes).
--
-- `detected_by` trace la provenance : saisie manuelle, vision IA (Claude),
-- ou un futur pipeline de photogrammétrie/segmentation externe.
-- Toutes nullables → rétrocompatible : sans position, le rapport retombe
-- sur la répartition uniforme.
-- ============================================================

ALTER TABLE surface_calculations
  ADD COLUMN IF NOT EXISTS position_x  NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS sill_height NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS detected_by TEXT
    CHECK (detected_by IN ('manual', 'ai', 'photogrammetry'));

COMMENT ON COLUMN surface_calculations.position_x  IS 'Décalage horizontal du bord gauche de l''ouverture depuis le bord gauche du mur (unité = colonne unit).';
COMMENT ON COLUMN surface_calculations.sill_height IS 'Hauteur de l''allège (bas de l''ouverture) au-dessus du sol (unité = colonne unit).';
COMMENT ON COLUMN surface_calculations.detected_by IS 'Provenance de la géométrie : manual | ai | photogrammetry.';
