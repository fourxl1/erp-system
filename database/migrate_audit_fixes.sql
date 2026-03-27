BEGIN;

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
  DROP CONSTRAINT IF EXISTS stock_movements_recipient_id_fkey;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_recipient_id_fkey
  FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE SET NULL;

COMMIT;
