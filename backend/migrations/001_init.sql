-- Migration 001: Initialize Database Schema
-- This migration creates the basic database structure for the ERP system

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    unit VARCHAR(50) NOT NULL,
    description TEXT,
    reorder_level INTEGER DEFAULT 0,
    image VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory_balances table
CREATE TABLE IF NOT EXISTS inventory_balances (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    quantity DECIMAL(15,4) DEFAULT 0,
    average_unit_cost DECIMAL(15,4) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, location_id)
);

-- Create stock_movements table
CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id),
    movement_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    unit_cost DECIMAL(15,4) DEFAULT 0,
    total_cost DECIMAL(15,4) DEFAULT 0,
    reference VARCHAR(255),
    performed_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create movement_ledger table
CREATE TABLE IF NOT EXISTS movement_ledger (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id),
    movement_id INTEGER REFERENCES stock_movements(id) ON DELETE CASCADE,
    quantity DECIMAL(15,4) NOT NULL,
    unit_cost DECIMAL(15,4) DEFAULT 0,
    total_cost DECIMAL(15,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_balances_item_location ON inventory_balances(item_id, location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_location ON stock_movements(item_id, location_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_movement_ledger_item_location ON movement_ledger(item_id, location_id);
CREATE INDEX IF NOT EXISTS idx_movement_ledger_movement_id ON movement_ledger(movement_id);

-- Insert default data
INSERT INTO locations (name, code, description) VALUES 
    ('Main Warehouse', 'MAIN', 'Primary storage location') ON CONFLICT DO NOTHING;

INSERT INTO categories (name, description) VALUES 
    ('Raw Materials', 'Basic materials for production') ON CONFLICT DO NOTHING,
    ('Finished Goods', 'Completed products ready for sale') ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_items_updated_at ON items;
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_movements_updated_at ON stock_movements;
CREATE TRIGGER update_stock_movements_updated_at BEFORE UPDATE ON stock_movements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();