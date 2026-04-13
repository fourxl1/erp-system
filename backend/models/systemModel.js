const { query } = require("../config/db");

async function listLocations() {
  const result = await query(
    `
      SELECT id, name, code, address, is_active, created_at
      FROM locations
      ORDER BY name
    `
  );

  return result.rows;
}

async function createLocation({ name, code, address }) {
  const result = await query(
    `
      INSERT INTO locations (name, code, address)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [name, code || null, address || null]
  );

  return result.rows[0];
}

async function updateLocation(id, { name, code, address, is_active }) {
  const result = await query(
    `
      UPDATE locations
      SET
        name = $1,
        code = $2,
        address = $3,
        is_active = COALESCE($4, is_active)
      WHERE id = $5
      RETURNING *
    `,
    [name, code || null, address || null, typeof is_active === "boolean" ? is_active : null, id]
  );

  return result.rows[0] || null;
}

async function listSections(locationId) {
  const values = [];
  let where = "";

  if (locationId) {
    values.push(locationId);
    where = `WHERE ss.location_id = $1`;
  }

  const result = await query(
    `
      SELECT
        ss.id,
        ss.location_id,
        l.name AS location,
        ss.name,
        ss.description,
        ss.created_at
      FROM store_sections ss
      JOIN locations l ON l.id = ss.location_id
      ${where}
      ORDER BY l.name, ss.name
    `,
    values
  );

  return result.rows;
}

async function createSection({ location_id, name, description }) {
  const result = await query(
    `
      INSERT INTO store_sections (location_id, name, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [location_id, name, description || null]
  );

  return result.rows[0];
}

async function updateSection(id, { location_id, name, description }) {
  const result = await query(
    `
      UPDATE store_sections
      SET
        location_id = $1,
        name = $2,
        description = $3
      WHERE id = $4
      RETURNING *
    `,
    [location_id, name, description || null, id]
  );

  return result.rows[0] || null;
}

async function getSectionById(id) {
  const result = await query(
    `
      SELECT id, location_id, name, description, created_at
      FROM store_sections
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function listAssets(locationId = null) {
  const values = [];
  let where = "";

  if (locationId) {
    values.push(locationId);
    where = `WHERE a.location_id = $1`;
  }

  const result = await query(
    `
      SELECT
        a.id,
        a.asset_code,
        a.name,
        a.description,
        a.location_id,
        l.name AS location,
        a.created_at
      FROM assets a
      LEFT JOIN locations l ON l.id = a.location_id
      ${where}
      ORDER BY a.name
    `,
    values
  );

  return result.rows;
}

async function createAsset({ location_id, asset_code, name, description }) {
  const result = await query(
    `
      INSERT INTO assets (location_id, asset_code, name, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [location_id || null, asset_code, name, description || null]
  );

  return result.rows[0];
}

async function updateAsset(id, { location_id, asset_code, name, description }) {
  const result = await query(
    `
      UPDATE assets
      SET
        location_id = $1,
        asset_code = $2,
        name = $3,
        description = $4
      WHERE id = $5
      RETURNING *
    `,
    [location_id || null, asset_code, name, description || null, id]
  );

  return result.rows[0] || null;
}

async function getAssetById(id) {
  const result = await query(
    `
      SELECT id, location_id, asset_code, name, description, created_at
      FROM assets
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function createCountHeader(client, { location_id, section_id, counted_by, count_date, notes }) {
  const result = await client.query(
    `
      INSERT INTO inventory_counts (location_id, section_id, counted_by, count_date, notes)
      VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5)
      RETURNING *
    `,
    [location_id, section_id || null, counted_by, count_date || null, notes || null]
  );

  return result.rows[0];
}

async function addCountItem(client, { count_id, item_id, system_quantity, counted_quantity }) {
  const variance_quantity = Number(counted_quantity) - Number(system_quantity);
  const result = await client.query(
    `
      INSERT INTO inventory_count_items (
        count_id,
        item_id,
        system_quantity,
        counted_quantity,
        variance_quantity
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [count_id, item_id, system_quantity, counted_quantity, variance_quantity]
  );

  return result.rows[0];
}

async function listCounts(locationId = null) {
  const values = [];
  let where = "";

  if (locationId) {
    values.push(locationId);
    where = `WHERE c.location_id = $1`;
  }

  const result = await query(
    `
      SELECT
        c.id,
        c.location_id,
        l.name AS location,
        c.section_id,
        ss.name AS section,
        c.status,
        c.count_date,
        c.notes,
        u.full_name AS counted_by,
        c.created_at
      FROM inventory_counts c
      JOIN locations l ON l.id = c.location_id
      LEFT JOIN store_sections ss ON ss.id = c.section_id
      JOIN users u ON u.id = c.counted_by
      ${where}
      ORDER BY c.created_at DESC
    `,
    values
  );

  return result.rows;
}

async function getCountById(id) {
  const result = await query(
    `
      SELECT *
      FROM inventory_counts
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getCountItems(id) {
  const result = await query(
    `
      SELECT
        ici.*,
        i.name AS item_name,
        i.unit
      FROM inventory_count_items ici
      JOIN items i ON i.id = ici.item_id
      WHERE ici.count_id = $1
      ORDER BY i.name
    `,
    [id]
  );

  return result.rows;
}

async function updateCountStatus(client, id, status) {
  const result = await client.query(
    `
      UPDATE inventory_counts
      SET status = $1
      WHERE id = $2
      RETURNING *
    `,
    [status, id]
  );

  return result.rows[0];
}

async function listAlerts(locationId = null) {
  const values = [];
  let where = "";

  if (locationId) {
    values.push(locationId);
    where = `WHERE location_id = $1`;
  }

  const result = await query(
    `
      SELECT id, user_id, location_id, alert_type, title, message, is_read, created_at
      FROM alerts
      ${where}
      ORDER BY created_at DESC
    `,
    values
  );

  return result.rows;
}

async function markAlertAsRead(id, userId = null) {
  const values = [id];
  let where = "WHERE id = $1";

  if (userId) {
    values.push(userId);
    where += ` AND (user_id = $2 OR user_id IS NULL)`;
  }

  const result = await query(
    `
      UPDATE alerts
      SET is_read = TRUE
      ${where}
      RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

async function listAuditLogs(filters = {}) {
  const conditions = ["1 = 1"];
  const values = [];

  if (filters.entityType) {
    values.push(filters.entityType);
    conditions.push(`a.entity_type = $${values.length}`);
  }

  if (filters.userId) {
    values.push(filters.userId);
    conditions.push(`a.user_id = $${values.length}`);
  }

  if (filters.locationId) {
    values.push(filters.locationId);
    conditions.push(
      `(
        COALESCE((a.details->>'location_id')::BIGINT, 0) = $${values.length}
        OR COALESCE((a.details->>'source_location_id')::BIGINT, 0) = $${values.length}
        OR COALESCE((a.details->>'destination_location_id')::BIGINT, 0) = $${values.length}
      )`
    );
  }

  const result = await query(
    `
      SELECT
        a.id,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details,
        a.created_at,
        u.full_name AS performed_by
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY a.created_at DESC
    `,
    values
  );

  return result.rows;
}

async function insertAuditLog(executor, { user_id, action, entity_type, entity_id, details }) {
  try {
    const result = await executor.query(
      `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [user_id || null, action, entity_type, entity_id || null, details || null]
    );

    return result.rows[0];
  } catch (error) {
    const isTransactionalExecutor = executor && executor.query !== query;

    if (isTransactionalExecutor) {
      throw error;
    }

    console.error("Failed to persist audit log:", error.message);
    return null;
  }
}

async function getCurrentBalance(itemId, locationId) {
  const result = await query(
    `
      SELECT COALESCE(quantity, 0) AS quantity
      FROM inventory_balance
      WHERE item_id = $1 AND location_id = $2
    `,
    [itemId, locationId]
  );

  return Number(result.rows[0]?.quantity || 0);
}

async function listCategories() {
  const result = await query(
    `
      SELECT id, name, description, created_at
      FROM categories
      ORDER BY name
    `
  );

  return result.rows;
}

async function createCategory({ name, description }) {
  const result = await query(
    `
      INSERT INTO categories (name, description)
      VALUES ($1, $2)
      RETURNING *
    `,
    [name, description || null]
  );

  return result.rows[0];
}

async function updateCategory(id, { name, description }) {
  const result = await query(
    `
      UPDATE categories
      SET name = $1, description = $2
      WHERE id = $3
      RETURNING *
    `,
    [name, description || null, id]
  );

  return result.rows[0] || null;
}

async function listUnits() {
  const result = await query(
    `
      SELECT id, name, description, created_at
      FROM units
      ORDER BY name
    `
  );

  return result.rows;
}

async function createUnit({ name, description }) {
  const result = await query(
    `
      INSERT INTO units (name, description)
      VALUES ($1, $2)
      RETURNING *
    `,
    [name, description || null]
  );

  return result.rows[0];
}

async function updateUnit(id, { name, description }) {
  const result = await query(
    `
      UPDATE units
      SET name = $1, description = $2
      WHERE id = $3
      RETURNING *
    `,
    [name, description || null, id]
  );

  return result.rows[0] || null;
}

async function listSuppliers(locationId = null) {
  const values = [];
  let where = "";

  if (locationId) {
    values.push(locationId);
    where = `WHERE s.location_id = $1::BIGINT`;
  }

  const result = await query(
    `
      SELECT
        s.id,
        s.location_id,
        l.name AS location,
        s.name,
        s.contact_name,
        s.phone,
        s.email,
        s.notes,
        s.created_at
      FROM suppliers s
      JOIN locations l ON l.id = s.location_id
      ${where}
      ORDER BY s.name
    `,
    values
  );

  return result.rows;
}

async function createSupplier({ location_id, name, contact_name, phone, email, notes }) {
  const result = await query(
    `
      INSERT INTO suppliers (location_id, name, contact_name, phone, email, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [location_id, name, contact_name || null, phone || null, email || null, notes || null]
  );

  return result.rows[0];
}

async function updateSupplier(id, { location_id, name, contact_name, phone, email, notes }) {
  const result = await query(
    `
      UPDATE suppliers
      SET
        location_id = $1,
        name = $2,
        contact_name = $3,
        phone = $4,
        email = $5,
        notes = $6
      WHERE id = $7
      RETURNING *
    `,
    [location_id, name, contact_name || null, phone || null, email || null, notes || null, id]
  );

  return result.rows[0] || null;
}

async function getSupplierById(id) {
  const result = await query(
    `
      SELECT id, location_id, name, contact_name, phone, email, notes, created_at
      FROM suppliers
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function listUsers(locationId = null) {
  const values = [];
  let where = "WHERE COALESCE(u.is_active, TRUE) = TRUE";

  if (locationId) {
    values.push(locationId);
    where += ` AND (u.location_id = $1 OR (u.location_id IS NULL AND LOWER(COALESCE(r.name, '')) = 'superadmin'))`;
  }

  const result = await query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.location_id,
        l.name AS location,
        u.role_id,
        COALESCE(r.name, '') AS role_name,
        COALESCE(u.is_active, TRUE) AS is_active,
        u.created_at
      FROM users u
      LEFT JOIN locations l ON l.id = u.location_id
      LEFT JOIN roles r ON r.id = u.role_id
      ${where}
      ORDER BY u.full_name
    `,
    values
  );

  return result.rows;
}

async function getUserById(id) {
  const result = await query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.location_id,
        l.name AS location,
        u.role_id,
        COALESCE(r.name, '') AS role_name,
        COALESCE(u.is_active, TRUE) AS is_active,
        u.created_at
      FROM users u
      LEFT JOIN locations l ON l.id = u.location_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getRoleIdByName(name) {
  const result = await query(
    `
      SELECT id
      FROM roles
      WHERE UPPER(name) = UPPER($1)
    `,
    [name]
  );

  return result.rows[0]?.id || null;
}

async function createUser({ role_id, full_name, email, password, location_id, is_active }) {
  const result = await query(
    `
      INSERT INTO users (role_id, location_id, full_name, email, password, is_active)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE))
      RETURNING id, role_id, location_id, full_name, email, is_active, created_at
    `,
    [role_id, location_id || null, full_name, email, password, is_active]
  );

  return result.rows[0];
}

async function updateUser(id, { role_id, full_name, email, location_id, is_active }) {
  const result = await query(
    `
      UPDATE users
      SET
        role_id = $1,
        full_name = $2,
        email = $3,
        location_id = $4,
        is_active = COALESCE($5, is_active)
      WHERE id = $6
      RETURNING id, role_id, location_id, full_name, email, is_active, created_at
    `,
    [role_id, full_name, email, location_id || null, typeof is_active === "boolean" ? is_active : null, id]
  );

  return result.rows[0] || null;
}

async function deactivateUser(id) {
  const result = await query(
    `
      UPDATE users
      SET is_active = FALSE
      WHERE id = $1
      RETURNING id, full_name, email, role_id, location_id, is_active, created_at
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function listRecipients(locationId = null) {
  const values = [];
  let where = "";

  if (locationId) {
    values.push(locationId);
    where = `WHERE r.location_id = $1::BIGINT`;
  }

  const result = await query(
    `
      SELECT id, location_id, name, department
      FROM recipients r
      ${where}
      ORDER BY name
    `,
    values
  );

  return result.rows;
}

async function createRecipient({ location_id, name, department }) {
  const result = await query(
    `
      INSERT INTO recipients (location_id, name, department)
      VALUES ($1, $2, $3)
      RETURNING id, location_id, name, department
    `,
    [location_id, name, department || null]
  );

  return result.rows[0];
}

async function updateRecipient(id, { location_id, name, department }) {
  const result = await query(
    `
      UPDATE recipients
      SET
        location_id = $1,
        name = $2,
        department = $3
      WHERE id = $4
      RETURNING id, location_id, name, department
    `,
    [location_id, name, department || null, id]
  );

  return result.rows[0] || null;
}

async function getRecipientById(id) {
  const result = await query(
    `
      SELECT id, location_id, name, department
      FROM recipients
      WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

const DELETABLE_TABLES = new Set([
  "locations",
  "store_sections",
  "assets",
  "categories",
  "units",
  "suppliers",
  "recipients"
]);

async function deleteEntity(table, id) {
  if (!DELETABLE_TABLES.has(table)) {
    return null;
  }

  const result = await query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
  return result.rows[0] || null;
}

module.exports = {
  listLocations,
  createLocation,
  updateLocation,
  listSections,
  createSection,
  updateSection,
  getSectionById,
  listAssets,
  createAsset,
  updateAsset,
  getAssetById,
  createCountHeader,
  addCountItem,
  listCounts,
  getCountById,
  getCountItems,
  updateCountStatus,
  listAlerts,
  markAlertAsRead,
  listAuditLogs,
  insertAuditLog,
  getCurrentBalance,
  listCategories,
  createCategory,
  updateCategory,
  listUnits,
  createUnit,
  updateUnit,
  listSuppliers,
  createSupplier,
  updateSupplier,
  getSupplierById,
  listUsers,
  getUserById,
  getRoleIdByName,
  createUser,
  updateUser,
  deactivateUser,
  listRecipients,
  createRecipient,
  updateRecipient,
  getRecipientById,
  deleteEntity
};
