BEGIN;

UPDATE items
SET reorder_level = CASE
  WHEN minimum_quantity IS NOT NULL THEN minimum_quantity
  ELSE COALESCE(reorder_level, 0)
END,
updated_at = NOW()
WHERE COALESCE(reorder_level, 0) = 0
  AND minimum_quantity IS NOT NULL;

UPDATE stock_movements sm
SET unit_cost = COALESCE(i.cost_usd, 0)
FROM items i
WHERE i.id = sm.item_id
  AND COALESCE(sm.unit_cost, 0) = 0;

UPDATE stock_request_items sri
SET unit_cost = COALESCE(i.cost_usd, 0)
FROM items i
WHERE i.id = sri.item_id
  AND COALESCE(sri.unit_cost, 0) = 0;

UPDATE maintenance_items_used miu
SET unit_cost = COALESCE(i.cost_usd, 0)
FROM items i
WHERE i.id = miu.item_id
  AND COALESCE(miu.unit_cost, 0) = 0;

UPDATE inventory_ledger il
SET
  unit_cost = COALESCE(i.cost_usd, 0),
  total_cost = il.quantity * COALESCE(i.cost_usd, 0)
FROM items i
WHERE i.id = il.item_id
  AND COALESCE(il.unit_cost, 0) = 0;

WITH signed_history AS (
  SELECT
    sm.item_id,
    sm.location_id,
    COALESCE(SUM(
      CASE
        WHEN sm.movement_type IN ('OUT', 'MAINTENANCE', 'ASSET_ISSUE') THEN sm.quantity * -1
        ELSE sm.quantity
      END
    ), 0) AS net_quantity
  FROM stock_movements sm
  GROUP BY sm.item_id, sm.location_id
),
required_adjustments AS (
  SELECT
    b.item_id,
    b.location_id,
    (b.quantity - COALESCE(sh.net_quantity, 0)) AS adjustment_quantity,
    i.cost_usd,
    COALESCE(i.created_at, NOW()) AS effective_date
  FROM inventory_balance b
  JOIN items i ON i.id = b.item_id
  LEFT JOIN signed_history sh
    ON sh.item_id = b.item_id
   AND sh.location_id = b.location_id
  WHERE (b.quantity - COALESCE(sh.net_quantity, 0)) <> 0
    AND NOT EXISTS (
      SELECT 1
      FROM stock_movements sm
      WHERE sm.item_id = b.item_id
        AND sm.location_id = b.location_id
        AND sm.reference = 'OPENING-BALANCE'
    )
),
inserted_movements AS (
  INSERT INTO stock_movements (
    item_id,
    location_id,
    movement_type,
    quantity,
    unit_cost,
    reference,
    performed_by,
    created_at
  )
  SELECT
    ra.item_id,
    ra.location_id,
    'ADJUSTMENT',
    ABS(ra.adjustment_quantity),
    COALESCE(ra.cost_usd, 0),
    'OPENING-BALANCE',
    1,
    ra.effective_date
  FROM required_adjustments ra
  RETURNING id, item_id, location_id, quantity, unit_cost, created_at
)
INSERT INTO inventory_ledger (
  item_id,
  location_id,
  movement_id,
  quantity,
  unit_cost,
  total_cost,
  created_at
)
SELECT
  im.item_id,
  im.location_id,
  im.id,
  ra.adjustment_quantity,
  im.unit_cost,
  ra.adjustment_quantity * im.unit_cost,
  im.created_at
FROM inserted_movements im
JOIN required_adjustments ra
  ON ra.item_id = im.item_id
 AND ra.location_id = im.location_id;

DELETE FROM alerts
WHERE alert_type = 'LOW_STOCK';

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
WHERE b.quantity <= i.reorder_level;

COMMIT;
