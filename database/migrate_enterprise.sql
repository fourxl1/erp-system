BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE roles
SET name = 'SuperAdmin'
WHERE LOWER(name) = 'manager';

INSERT INTO roles (name, description)
SELECT 'SuperAdmin', 'Global system administrator'
WHERE NOT EXISTS (
  SELECT 1 FROM roles WHERE LOWER(name) = 'superadmin'
);

UPDATE roles
SET description = CASE
  WHEN LOWER(name) = 'staff' THEN 'Operational staff user'
  WHEN LOWER(name) = 'admin' THEN 'Store administrator'
  WHEN LOWER(name) = 'superadmin' THEN 'Global system administrator'
  ELSE COALESCE(description, 'System role')
END
WHERE description IS NULL;

CREATE TABLE IF NOT EXISTS locations (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  code VARCHAR(50) UNIQUE,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO locations (name, code, address)
SELECT 'Main Store', 'MAIN', 'Primary inventory store'
WHERE NOT EXISTS (
  SELECT 1 FROM locations WHERE code = 'MAIN'
);

CREATE TABLE IF NOT EXISTS store_sections (
  id BIGSERIAL PRIMARY KEY,
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (location_id, name)
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);

UPDATE users
SET location_id = (SELECT id FROM locations WHERE code = 'MAIN' LIMIT 1)
WHERE location_id IS NULL;

ALTER TABLE users
  ALTER COLUMN is_active SET DEFAULT TRUE;

UPDATE users
SET is_active = TRUE
WHERE is_active IS NULL;

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS units (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO units (name)
VALUES
  ('PCS'),
  ('KG'),
  ('LITERS'),
  ('METERS'),
  ('BOXES'),
  ('ROLLS')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_path TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW();

UPDATE items
SET
  reorder_level = CASE
    WHEN (reorder_level IS NULL OR reorder_level = 0) AND minimum_quantity IS NOT NULL THEN minimum_quantity
    ELSE COALESCE(reorder_level, 0)
  END,
  image_path = COALESCE(image_path, image_url),
  is_active = COALESCE(is_active, TRUE),
  updated_at = COALESCE(updated_at, created_at, NOW());

CREATE TABLE IF NOT EXISTS inventory_balance (
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity NUMERIC(18, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (item_id, location_id)
);

INSERT INTO inventory_balance (item_id, location_id, quantity, updated_at)
SELECT
  i.id,
  l.id,
  COALESCE(i.current_quantity, 0),
  NOW()
FROM items i
CROSS JOIN LATERAL (
  SELECT id FROM locations WHERE code = 'MAIN' LIMIT 1
) l
ON CONFLICT (item_id, location_id)
DO UPDATE
SET
  quantity = EXCLUDED.quantity,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS inventory_counts (
  id BIGSERIAL PRIMARY KEY,
  location_id BIGINT NOT NULL REFERENCES locations(id),
  section_id BIGINT REFERENCES store_sections(id),
  counted_by BIGINT NOT NULL REFERENCES users(id),
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_count_items (
  id BIGSERIAL PRIMARY KEY,
  count_id BIGINT NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  system_quantity NUMERIC(18, 2) NOT NULL DEFAULT 0,
  counted_quantity NUMERIC(18, 2) NOT NULL DEFAULT 0,
  variance_quantity NUMERIC(18, 2) NOT NULL DEFAULT 0,
  UNIQUE (count_id, item_id)
);

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);

UPDATE assets
SET location_id = (SELECT id FROM locations WHERE code = 'MAIN' LIMIT 1)
WHERE location_id IS NULL;

CREATE TABLE IF NOT EXISTS recipients (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  department VARCHAR(150)
);

INSERT INTO recipients (id, name, department)
SELECT DISTINCT
  u.id,
  u.full_name,
  l.name
FROM stock_movements sm
JOIN users u ON u.id = sm.recipient_id
LEFT JOIN locations l ON l.id = u.location_id
WHERE sm.recipient_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('recipients', 'id'),
  COALESCE((SELECT MAX(id) FROM recipients), 1),
  TRUE
);

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS section_id BIGINT REFERENCES store_sections(id),
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_location_id BIGINT REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS destination_location_id BIGINT REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS asset_id BIGINT REFERENCES assets(id),
  ADD COLUMN IF NOT EXISTS request_id BIGINT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW();

UPDATE stock_movements sm
SET
  location_id = COALESCE(sm.location_id, (SELECT id FROM locations WHERE code = 'MAIN' LIMIT 1)),
  unit_cost = CASE
    WHEN COALESCE(sm.unit_cost, 0) = 0 THEN COALESCE(i.cost_usd, 0)
    ELSE sm.unit_cost
  END
FROM items i
WHERE i.id = sm.item_id;

UPDATE stock_movements
SET request_id = NULLIF(REGEXP_REPLACE(reference, '\D', '', 'g'), '')::BIGINT
WHERE request_id IS NULL
  AND reference ILIKE 'Approved request #%';

ALTER TABLE stock_movements
  ALTER COLUMN location_id SET NOT NULL;

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_request_id_fkey;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_request_id_fkey
  FOREIGN KEY (request_id) REFERENCES stock_requests(id) ON DELETE SET NULL;

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_recipient_id_fkey;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_recipient_id_fkey
  FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS inventory_ledger (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES items(id),
  location_id BIGINT NOT NULL REFERENCES locations(id),
  movement_id BIGINT NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  quantity NUMERIC(18, 2) NOT NULL,
  unit_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO inventory_ledger (item_id, location_id, movement_id, quantity, unit_cost, total_cost, created_at)
SELECT
  sm.item_id,
  sm.location_id,
  sm.id,
  CASE
    WHEN sm.movement_type IN ('OUT', 'MAINTENANCE', 'ASSET_ISSUE') THEN sm.quantity * -1
    ELSE sm.quantity
  END AS quantity,
  COALESCE(sm.unit_cost, i.cost_usd, 0) AS unit_cost,
  CASE
    WHEN sm.movement_type IN ('OUT', 'MAINTENANCE', 'ASSET_ISSUE')
      THEN (sm.quantity * -1) * COALESCE(sm.unit_cost, i.cost_usd, 0)
    ELSE sm.quantity * COALESCE(sm.unit_cost, i.cost_usd, 0)
  END AS total_cost,
  sm.created_at
FROM stock_movements sm
JOIN items i ON i.id = sm.item_id
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_ledger il WHERE il.movement_id = sm.id
);

ALTER TABLE stock_requests
  ADD COLUMN IF NOT EXISTS request_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS source_location_id BIGINT REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS destination_location_id BIGINT REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS approved_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITHOUT TIME ZONE;

UPDATE stock_requests
SET
  request_number = COALESCE(request_number, CONCAT('REQ-', id)),
  location_id = COALESCE(location_id, (SELECT location_id FROM users WHERE users.id = stock_requests.requester_id)),
  source_location_id = CASE
    WHEN source_location_id IS NOT NULL THEN source_location_id
    WHEN destination_location_id IS NOT NULL THEN location_id
    ELSE NULL
  END,
  location_id = CASE
    WHEN source_location_id IS NULL AND destination_location_id IS NOT NULL THEN destination_location_id
    ELSE location_id
  END,
  approved_by = CASE WHEN status = 'APPROVED' THEN COALESCE(approved_by, 1) ELSE approved_by END,
  approved_at = CASE WHEN status = 'APPROVED' THEN COALESCE(approved_at, created_at) ELSE approved_at END;

ALTER TABLE stock_requests
  ALTER COLUMN request_number SET NOT NULL;

ALTER TABLE stock_requests
  ALTER COLUMN location_id SET NOT NULL;

ALTER TABLE stock_request_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(18, 2) NOT NULL DEFAULT 0;

UPDATE stock_request_items sri
SET unit_cost = CASE
  WHEN COALESCE(unit_cost, 0) = 0 THEN COALESCE(i.cost_usd, 0)
  ELSE unit_cost
END
FROM items i
WHERE i.id = sri.item_id;

ALTER TABLE maintenance_logs
  ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);

UPDATE maintenance_logs ml
SET location_id = COALESCE(
  ml.location_id,
  a.location_id,
  (SELECT id FROM locations WHERE code = 'MAIN' LIMIT 1)
)
FROM assets a
WHERE a.id = ml.asset_id;

ALTER TABLE maintenance_items_used
  ADD COLUMN IF NOT EXISTS movement_id BIGINT REFERENCES stock_movements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(18, 2) NOT NULL DEFAULT 0;

UPDATE maintenance_items_used miu
SET unit_cost = COALESCE(unit_cost, i.cost_usd, 0)
FROM items i
WHERE i.id = miu.item_id;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS subject VARCHAR(200);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  location_id BIGINT REFERENCES locations(id),
  alert_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO alerts (user_id, location_id, alert_type, title, message, is_read, created_at)
SELECT
  NULL,
  b.location_id,
  'LOW_STOCK',
  CONCAT('Low stock: ', i.name),
  CONCAT(i.name, ' is below reorder level at ', l.name),
  FALSE,
  NOW()
FROM inventory_balance b
JOIN items i ON i.id = b.item_id
JOIN locations l ON l.id = b.location_id
WHERE b.quantity <= i.reorder_level
  AND NOT EXISTS (
    SELECT 1
    FROM alerts a
    WHERE a.alert_type = 'LOW_STOCK'
      AND a.location_id = b.location_id
      AND a.title = CONCAT('Low stock: ', i.name)
  );

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT,
  details JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_balance_location ON inventory_balance(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_date ON stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_location_date ON stock_movements(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_item_location ON inventory_ledger(item_id, location_id);
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_stock_requests_source_location ON stock_requests(source_location_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_asset ON maintenance_logs(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

COMMIT;
