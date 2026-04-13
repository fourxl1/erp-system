CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name, description)
VALUES
    ('Staff', 'Operational staff user'),
    ('Admin', 'Store administrator'),
    ('SuperAdmin', 'Global system administrator')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS locations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(50) UNIQUE,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_sections (
    id BIGSERIAL PRIMARY KEY,
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (location_id, name)
);

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    location_id BIGINT REFERENCES locations(id),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(150),
    phone VARCHAR(50),
    email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (location_id, name)
);

CREATE TABLE IF NOT EXISTS items (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT REFERENCES categories(id),
    supplier_id BIGINT REFERENCES suppliers(id),
    name VARCHAR(180) NOT NULL,
    description TEXT,
    unit VARCHAR(50) NOT NULL,
    reorder_level NUMERIC(18, 2) NOT NULL DEFAULT 0,
    image_path TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_balance (
    item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    quantity NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (item_id, location_id)
);

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

CREATE TABLE IF NOT EXISTS assets (
    id BIGSERIAL PRIMARY KEY,
    location_id BIGINT NOT NULL REFERENCES locations(id),
    asset_code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipients (
    id BIGSERIAL PRIMARY KEY,
    location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    department VARCHAR(150),
    UNIQUE (location_id, name)
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES items(id),
    location_id BIGINT NOT NULL REFERENCES locations(id),
    section_id BIGINT REFERENCES store_sections(id),
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'TRANSFER', 'MAINTENANCE', 'ADJUSTMENT', 'ASSET_ISSUE')),
    quantity NUMERIC(18, 2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
    reference VARCHAR(120),
    source_location_id BIGINT REFERENCES locations(id),
    destination_location_id BIGINT REFERENCES locations(id),
    asset_id BIGINT REFERENCES assets(id),
    recipient_id BIGINT REFERENCES recipients(id),
    supplier_id BIGINT REFERENCES suppliers(id),
    request_id BIGINT,
    performed_by BIGINT NOT NULL REFERENCES users(id),
    created_by BIGINT REFERENCES users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED')),
    transfer_confirmed_by BIGINT REFERENCES users(id),
    transfer_confirmed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movement_items (
    id BIGSERIAL PRIMARY KEY,
    movement_id BIGINT NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES items(id),
    location_id BIGINT NOT NULL REFERENCES locations(id),
    quantity NUMERIC(18, 2) NOT NULL CHECK (quantity <> 0),
    cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS stock_requests (
    id BIGSERIAL PRIMARY KEY,
    request_number VARCHAR(80) NOT NULL UNIQUE,
    requester_id BIGINT NOT NULL REFERENCES users(id),
    location_id BIGINT NOT NULL REFERENCES locations(id),
    source_location_id BIGINT REFERENCES locations(id),
    destination_location_id BIGINT REFERENCES locations(id),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED')),
    notes TEXT,
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_request_items (
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES items(id),
    quantity NUMERIC(18, 2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(18, 2) NOT NULL DEFAULT 0,
    UNIQUE (request_id, item_id)
);

ALTER TABLE stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_request_id_fkey;

ALTER TABLE stock_movements
    ADD CONSTRAINT stock_movements_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES stock_requests(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS maintenance_logs (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES assets(id),
    location_id BIGINT NOT NULL REFERENCES locations(id),
    description TEXT NOT NULL,
    performed_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_items_used (
    id BIGSERIAL PRIMARY KEY,
    maintenance_id BIGINT NOT NULL REFERENCES maintenance_logs(id) ON DELETE CASCADE,
    movement_id BIGINT REFERENCES stock_movements(id) ON DELETE SET NULL,
    item_id BIGINT NOT NULL REFERENCES items(id),
    quantity NUMERIC(18, 2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(18, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT NOT NULL REFERENCES users(id),
    receiver_id BIGINT NOT NULL REFERENCES users(id),
    subject VARCHAR(200),
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issues (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    related_report TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    reference_id BIGINT,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
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

CREATE TABLE IF NOT EXISTS movement_logs (
    id BIGSERIAL PRIMARY KEY,
    movement_id BIGINT NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    changed_by BIGINT REFERENCES users(id),
    "timestamp" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_balance_location ON inventory_balance(location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_date ON stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_location_date ON stock_movements(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_status_created ON stock_movements(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_source_destination ON stock_movements(source_location_id, destination_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement ON stock_movement_items(movement_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_item ON stock_movement_items(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_location ON stock_movement_items(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_item_location ON inventory_ledger(item_id, location_id);
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_stock_requests_source_location ON stock_requests(source_location_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_asset ON maintenance_logs(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_location_created ON notifications(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type_event ON notifications(type, event_type);
CREATE INDEX IF NOT EXISTS idx_movement_logs_movement_timestamp ON movement_logs(movement_id, "timestamp" DESC);
