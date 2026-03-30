const { query } = require("../config/db");

function buildItemFilters(filters = {}) {
  const conditions = ["i.is_active = TRUE"];
  const values = [];

  if (filters.itemId) {
    values.push(filters.itemId);
    conditions.push(`i.id = $${values.length}::BIGINT`);
  }

  if (filters.categoryId) {
    values.push(filters.categoryId);
    conditions.push(`i.category_id = $${values.length}::BIGINT`);
  }

  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`i.name ILIKE $${values.length}::TEXT`);
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values
  };
}

async function createItem(item) {
  const result = await query(
    `
      INSERT INTO items
        (category_id, supplier_id, name, description, unit, reorder_level, image_path)
      VALUES
        ($1::BIGINT, $2::BIGINT, $3::TEXT, $4::TEXT, $5::TEXT, $6::NUMERIC, $7::TEXT)
      RETURNING *
    `,
    [
      item.category_id || null,
      item.supplier_id || null,
      item.name,
      item.description || null,
      item.unit,
      item.reorder_level || 0,
      item.image_path || null
    ]
  );

  return result.rows[0];
}

async function updateItem(id, item) {
  const result = await query(
    `
      UPDATE items
      SET
        category_id = $1::BIGINT,
        supplier_id = $2::BIGINT,
        name = $3::TEXT,
        description = $4::TEXT,
        unit = $5::TEXT,
        reorder_level = $6::NUMERIC,
        image_path = COALESCE($7::TEXT, image_path),
        updated_at = NOW()
      WHERE id = $8::BIGINT
      RETURNING *
    `,
    [
      item.category_id || null,
      item.supplier_id || null,
      item.name,
      item.description || null,
      item.unit,
      item.reorder_level || 0,
      item.image_path || null,
      id
    ]
  );

  return result.rows[0];
}

async function deleteItemById(id) {
  const result = await query(
    `
      UPDATE items
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1::BIGINT
      RETURNING *
    `,
    [id]
  );

  return result.rows[0];
}

async function getItemById(id, locationId = null) {
  const values = [id];
  let movementJoin = "LEFT JOIN inventory_balance b ON b.item_id = i.id";
  let balanceLocationClause = "";

  if (locationId) {
    values.push(locationId);
    movementJoin = `JOIN inventory_balance b ON b.item_id = i.id AND b.location_id = $${values.length}::BIGINT`;
    balanceLocationClause = ` AND b.location_id = $${values.length}::BIGINT`;
  }

  const itemResult = await query(
    `
      SELECT
        i.id,
        i.name,
        i.description,
        i.unit,
        i.reorder_level,
        i.image_path,
        c.id AS category_id,
        c.name AS category,
        s.id AS supplier_id,
        s.name AS supplier,
        COALESCE(SUM(b.quantity), 0) AS current_quantity,
        i.created_at,
        i.updated_at
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      ${movementJoin}
      WHERE i.id = $1::BIGINT AND i.is_active = TRUE
      GROUP BY i.id, c.id, c.name, s.id, s.name
    `,
    values
  );

  if (!itemResult.rows[0]) {
    return null;
  }

  const balanceResult = await query(
    `
      SELECT
        b.location_id,
        l.name AS location,
        b.quantity,
        b.updated_at
      FROM inventory_balance b
      JOIN locations l ON l.id = b.location_id
      WHERE b.item_id = $1::BIGINT${balanceLocationClause}
      ORDER BY l.name
    `,
    values
  );

  return {
    ...itemResult.rows[0],
    balances: balanceResult.rows
  };
}

async function getAllItems(filters = {}) {
  const { whereClause, values } = buildItemFilters(filters);
  const locationJoin =
    filters.locationId
      ? `JOIN inventory_balance b ON b.item_id = i.id AND b.location_id = $${values.push(filters.locationId)}::BIGINT`
      : "LEFT JOIN inventory_balance b ON b.item_id = i.id";

  const result = await query(
    `
      SELECT
        i.id,
        i.name,
        i.description,
        i.unit,
        i.reorder_level,
        COALESCE(i.image_path, '') AS image_path,
        c.name AS category,
        s.name AS supplier,
        COALESCE(SUM(b.quantity), 0) AS current_quantity,
        i.created_at,
        i.updated_at
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      ${locationJoin}
      ${whereClause}
      GROUP BY i.id, c.name, s.name
      ORDER BY i.name
    `,
    values
  );

  return result.rows;
}

async function getInventoryStats(locationId = null) {
  const values = [];
  const locationJoin =
    locationId
      ? `LEFT JOIN inventory_balance b ON b.item_id = i.id AND b.location_id = $${values.push(locationId)}::BIGINT`
      : "LEFT JOIN inventory_balance b ON b.item_id = i.id";

  const result = await query(
    `
      SELECT
        COUNT(DISTINCT i.id) AS total_items,
        COUNT(DISTINCT CASE WHEN COALESCE(b.quantity, 0) <= i.reorder_level THEN i.id END) AS low_stock,
        COALESCE(SUM(b.quantity * latest.avg_cost), 0) AS total_value
      FROM items i
      ${locationJoin}
      LEFT JOIN LATERAL (
        SELECT
          CASE
            WHEN SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) = 0 THEN 0
            ELSE
              SUM(CASE WHEN quantity > 0 THEN total_cost ELSE 0 END) /
              NULLIF(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0)
          END AS avg_cost
        FROM inventory_ledger il
        WHERE il.item_id = i.id
          ${locationId ? "AND il.location_id = $1::BIGINT" : ""}
      ) latest ON TRUE
      WHERE i.is_active = TRUE
    `,
    values
  );

  return result.rows[0];
}

async function getItemCategoryById(id) {
  const result = await query(
    `
      SELECT
        i.*,
        c.name AS category,
        s.name AS supplier
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      LEFT JOIN suppliers s ON s.id = i.supplier_id
      WHERE i.id = $1::BIGINT AND i.is_active = TRUE
    `,
    [id]
  );

  return result.rows[0];
}

module.exports = {
  createItem,
  updateItem,
  deleteItemById,
  getItemById,
  getAllItems,
  getInventoryStats,
  getItemCategoryById
};
