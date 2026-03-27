ALTER TABLE stock_requests
  ADD COLUMN IF NOT EXISTS source_location_id BIGINT REFERENCES locations(id);

UPDATE stock_requests
SET source_location_id = location_id
WHERE source_location_id IS NULL
  AND destination_location_id IS NOT NULL;

UPDATE stock_requests
SET location_id = destination_location_id
WHERE source_location_id IS NOT NULL
  AND destination_location_id IS NOT NULL
  AND location_id <> destination_location_id;

CREATE INDEX IF NOT EXISTS idx_stock_requests_source_location ON stock_requests(source_location_id);
