-- ============================================================
-- 012 — Gestion matériaux : fournisseurs, inventaire, commandes, stock
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id   UUID REFERENCES companies(id),
  name         TEXT NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id        UUID REFERENCES companies(id),
  supplier_id       UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  sku               TEXT,
  name              TEXT NOT NULL,
  category          TEXT,
  unit              TEXT DEFAULT 'unité',
  unit_cost         NUMERIC(10,2) DEFAULT 0,
  quantity_on_hand  NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_threshold NUMERIC(12,3) NOT NULL DEFAULT 0,
  location          TEXT,
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES companies(id),
  supplier_id   UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  po_number     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','ordered','received','cancelled')),
  order_date    DATE,
  expected_date DATE,
  received_date DATE,
  notes         TEXT,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  description       TEXT NOT NULL,
  quantity          NUMERIC(12,3) DEFAULT 1,
  unit              TEXT,
  unit_cost         NUMERIC(10,2) DEFAULT 0,
  total             NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(quantity,0) * COALESCE(unit_cost,0)) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  owner_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  type              TEXT NOT NULL DEFAULT 'adjust' CHECK (type IN ('in','out','adjust')),
  quantity          NUMERIC(12,3) NOT NULL,
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_suppliers_owner     ON suppliers(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_owner      ON inventory_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_inventory_supplier   ON inventory_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_owner             ON purchase_orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier          ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po          ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_item       ON stock_movements(inventory_item_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory_items;
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_po_updated_at ON purchase_orders;
CREATE TRIGGER update_po_updated_at BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (owner + compagnie + admin)
-- ============================================================
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_all" ON suppliers;
CREATE POLICY "suppliers_all" ON suppliers FOR ALL USING (
  owner_id = auth.uid() OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
DROP POLICY IF EXISTS "inventory_all" ON inventory_items;
CREATE POLICY "inventory_all" ON inventory_items FOR ALL USING (
  owner_id = auth.uid() OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
DROP POLICY IF EXISTS "po_all" ON purchase_orders;
CREATE POLICY "po_all" ON purchase_orders FOR ALL USING (
  owner_id = auth.uid() OR (company_id IS NOT NULL AND is_company_member(company_id))
  OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
);
DROP POLICY IF EXISTS "po_items_all" ON purchase_order_items;
CREATE POLICY "po_items_all" ON purchase_order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM purchase_orders po WHERE po.id = purchase_order_items.purchase_order_id AND (
    po.owner_id = auth.uid() OR (po.company_id IS NOT NULL AND is_company_member(po.company_id))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
  ))
);
DROP POLICY IF EXISTS "stock_mov_all" ON stock_movements;
CREATE POLICY "stock_mov_all" ON stock_movements FOR ALL USING (
  EXISTS (SELECT 1 FROM inventory_items i WHERE i.id = stock_movements.inventory_item_id AND (
    i.owner_id = auth.uid() OR (i.company_id IS NOT NULL AND is_company_member(i.company_id))
    OR EXISTS (SELECT 1 FROM profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin')
  ))
);
