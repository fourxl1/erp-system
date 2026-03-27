BEGIN;

UPDATE roles
SET name = 'SuperAdmin'
WHERE LOWER(name) = 'manager';

DELETE FROM roles r
WHERE LOWER(r.name) NOT IN ('staff', 'admin', 'superadmin')
  AND NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.role_id = r.id
  );

CREATE TABLE IF NOT EXISTS issues (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  related_report TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movement_logs (
  id BIGSERIAL PRIMARY KEY,
  movement_id BIGINT NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_by BIGINT REFERENCES users(id),
  "timestamp" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_movement_logs_movement_timestamp
  ON movement_logs(movement_id, "timestamp" DESC);

COMMIT;
