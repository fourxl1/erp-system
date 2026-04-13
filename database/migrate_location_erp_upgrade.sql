BEGIN;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);

ALTER TABLE recipients
  ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS status VARCHAR(30),
  ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS transfer_confirmed_by BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS transfer_confirmed_at TIMESTAMP WITHOUT TIME ZONE;

UPDATE stock_movements
SET
  status = CASE
    WHEN UPPER(COALESCE(movement_type, '')) = 'TRANSFER' THEN 'COMPLETED'
    ELSE 'COMPLETED'
  END,
  created_by = COALESCE(created_by, performed_by);

ALTER TABLE stock_movements
  ALTER COLUMN status SET DEFAULT 'COMPLETED';

ALTER TABLE stock_movements
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_status_check;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_status_check
  CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED'));

CREATE TABLE IF NOT EXISTS stock_movement_items (
  id BIGSERIAL PRIMARY KEY,
  movement_id BIGINT NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  location_id BIGINT REFERENCES locations(id),
  quantity NUMERIC(18, 2) NOT NULL CHECK (quantity <> 0),
  cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO stock_movement_items (movement_id, item_id, location_id, quantity, cost)
SELECT
  sm.id,
  sm.item_id,
  sm.location_id,
  CASE
    WHEN UPPER(COALESCE(sm.movement_type, '')) = 'ADJUSTMENT'
      THEN COALESCE(NULLIF(il.quantity, 0), sm.quantity)
    ELSE sm.quantity
  END,
  COALESCE(sm.unit_cost, 0)
FROM stock_movements sm
LEFT JOIN LATERAL (
  SELECT il.quantity
  FROM inventory_ledger il
  WHERE il.movement_id = sm.id
  ORDER BY il.id DESC
  LIMIT 1
) il ON TRUE
WHERE sm.item_id IS NOT NULL
  AND sm.quantity IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM stock_movement_items smi
    WHERE smi.movement_id = sm.id
      AND smi.item_id = sm.item_id
  );

ALTER TABLE stock_movement_items
  ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);

UPDATE stock_movement_items smi
SET location_id = sm.location_id
FROM stock_movements sm
WHERE sm.id = smi.movement_id
  AND smi.location_id IS NULL;

ALTER TABLE stock_movement_items
  ALTER COLUMN location_id SET NOT NULL;

WITH location_fallback AS (
  SELECT id AS location_id
  FROM locations
  ORDER BY id
  LIMIT 1
)
UPDATE suppliers s
SET location_id = COALESCE(
  (
    SELECT sm.location_id
    FROM stock_movements sm
    WHERE sm.supplier_id = s.id
      AND sm.location_id IS NOT NULL
    ORDER BY sm.created_at DESC
    LIMIT 1
  ),
  (SELECT location_id FROM location_fallback)
)
WHERE s.location_id IS NULL;

WITH location_fallback AS (
  SELECT id AS location_id
  FROM locations
  ORDER BY id
  LIMIT 1
)
UPDATE recipients r
SET location_id = COALESCE(
  (
    SELECT sm.location_id
    FROM stock_movements sm
    WHERE sm.recipient_id = r.id
      AND sm.location_id IS NOT NULL
    ORDER BY sm.created_at DESC
    LIMIT 1
  ),
  (SELECT location_id FROM location_fallback)
)
WHERE r.location_id IS NULL;

ALTER TABLE suppliers
  ALTER COLUMN location_id SET NOT NULL;

ALTER TABLE recipients
  ALTER COLUMN location_id SET NOT NULL;

ALTER TABLE suppliers
  DROP CONSTRAINT IF EXISTS suppliers_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_location_name
  ON suppliers(location_id, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS uq_recipients_location_name
  ON recipients(location_id, LOWER(name));

UPDATE assets
SET location_id = COALESCE(
  location_id,
  (
    SELECT id
    FROM locations
    ORDER BY id
    LIMIT 1
  )
)
WHERE location_id IS NULL;

ALTER TABLE assets
  ALTER COLUMN location_id SET NOT NULL;

UPDATE maintenance_logs
SET location_id = COALESCE(
  location_id,
  (
    SELECT location_id
    FROM assets
    WHERE assets.id = maintenance_logs.asset_id
    LIMIT 1
  ),
  (
    SELECT id
    FROM locations
    ORDER BY id
    LIMIT 1
  )
)
WHERE location_id IS NULL;

ALTER TABLE maintenance_logs
  ALTER COLUMN location_id SET NOT NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS reference_id BIGINT,
  ADD COLUMN IF NOT EXISTS location_id BIGINT REFERENCES locations(id);

UPDATE notifications n
SET
  event_type = COALESCE(n.event_type, 'CREATED'),
  location_id = COALESCE(
    n.location_id,
    (
      SELECT u.location_id
      FROM users u
      WHERE u.id = n.user_id
      LIMIT 1
    )
  );

ALTER TABLE notifications
  ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_location_created
  ON notifications(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type_event
  ON notifications(type, event_type);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read
  ON notifications(is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_status_created
  ON stock_movements(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_source_destination
  ON stock_movements(source_location_id, destination_location_id);

CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement
  ON stock_movement_items(movement_id);

CREATE INDEX IF NOT EXISTS idx_stock_movement_items_item
  ON stock_movement_items(item_id);

CREATE INDEX IF NOT EXISTS idx_stock_movement_items_location
  ON stock_movement_items(location_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_location
  ON suppliers(location_id);

CREATE INDEX IF NOT EXISTS idx_recipients_location
  ON recipients(location_id);

COMMIT;
