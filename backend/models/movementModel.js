const { query } = require("../config/db");

let hasLoggedMissingMovementLogsTable = false;

function getExecutor(client) {
  return client || { query };
}

function isMissingMovementLogsTable(error) {
  return error && error.code === "42P01";
}

async function getBalanceForUpdate(client, itemId, locationId) {
  const result = await client.query(
    `
      SELECT item_id, location_id, quantity
      FROM inventory_balance
      WHERE item_id = $1::BIGINT AND location_id = $2::BIGINT
      FOR UPDATE
    `,
    [itemId, locationId]
  );

  return result.rows[0] || null;
}

async function upsertBalance(client, itemId, locationId, deltaQuantity) {
  const updateResult = await client.query(
    `
      UPDATE inventory_balance
      SET
        quantity = quantity + $3::NUMERIC,
        updated_at = NOW()
      WHERE item_id = $1::BIGINT
        AND location_id = $2::BIGINT
        AND quantity + $3::NUMERIC >= 0
      RETURNING *
    `,
    [itemId, locationId, deltaQuantity]
  );

  if (updateResult.rows[0]) {
    return updateResult.rows[0];
  }

  const insertResult = await client.query(
    `
      INSERT INTO inventory_balance (item_id, location_id, quantity, updated_at)
      SELECT $1::BIGINT, $2::BIGINT, $3::NUMERIC, NOW()
      WHERE $3::NUMERIC >= 0
        AND NOT EXISTS (
          SELECT 1
          FROM inventory_balance
          WHERE item_id = $1::BIGINT AND location_id = $2::BIGINT
        )
      RETURNING *
    `,
    [itemId, locationId, deltaQuantity]
  );

  return insertResult.rows[0] || null;
}

async function createMovement(client, movement) {
  const result = await client.query(
    `
      INSERT INTO stock_movements (
        item_id,
        location_id,
        section_id,
        movement_type,
        quantity,
        unit_cost,
        reference,
        source_location_id,
        destination_location_id,
        asset_id,
        recipient_id,
        supplier_id,
        request_id,
        performed_by,
        created_at
      )
      VALUES (
        $1::BIGINT, $2::BIGINT, $3::BIGINT, $4::TEXT, $5::NUMERIC, $6::NUMERIC, $7::TEXT,
        $8::BIGINT, $9::BIGINT, $10::BIGINT, $11::BIGINT, $12::BIGINT, $13::BIGINT, $14::BIGINT,
        COALESCE($15::TIMESTAMP, NOW())
      )
      RETURNING *
    `,
    [
      movement.item_id,
      movement.location_id,
      movement.section_id || null,
      movement.movement_type,
      movement.quantity,
      movement.unit_cost || 0,
      movement.reference || null,
      movement.source_location_id || null,
      movement.destination_location_id || null,
      movement.asset_id || null,
      movement.recipient_id || null,
      movement.supplier_id || null,
      movement.request_id || null,
      movement.performed_by,
      movement.created_at || null
    ]
  );

  return result.rows[0];
}

async function getMovementById(id, options = {}) {
  const executor = getExecutor(options.client);
  const lockingClause = options.forUpdate ? "FOR UPDATE OF sm" : "";

  const result = await executor.query(
    `
      SELECT
        sm.*,
        COALESCE(il.quantity, 0) AS ledger_quantity,
        COALESCE(il.unit_cost, sm.unit_cost, 0) AS ledger_unit_cost,
        COALESCE(il.total_cost, 0) AS ledger_total_cost,
        COALESCE((
          SELECT COUNT(*)
          FROM maintenance_items_used miu
          WHERE miu.movement_id = sm.id
        ), 0) AS maintenance_usage_count
      FROM stock_movements sm
      LEFT JOIN inventory_ledger il ON il.movement_id = sm.id
      WHERE sm.id = $1::BIGINT
      ${lockingClause}
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function updateMovement(client, id, movement) {
  const result = await client.query(
    `
      UPDATE stock_movements
      SET
        item_id = $1::BIGINT,
        location_id = $2::BIGINT,
        section_id = $3::BIGINT,
        movement_type = $4::TEXT,
        quantity = $5::NUMERIC,
        unit_cost = $6::NUMERIC,
        reference = $7::TEXT,
        source_location_id = $8::BIGINT,
        destination_location_id = $9::BIGINT,
        asset_id = $10::BIGINT,
        recipient_id = $11::BIGINT,
        supplier_id = $12::BIGINT,
        request_id = $13::BIGINT,
        performed_by = $14::BIGINT,
        created_at = $15::TIMESTAMP
      WHERE id = $16::BIGINT
      RETURNING *
    `,
    [
      movement.item_id,
      movement.location_id,
      movement.section_id || null,
      movement.movement_type,
      movement.quantity,
      movement.unit_cost || 0,
      movement.reference || null,
      movement.source_location_id || null,
      movement.destination_location_id || null,
      movement.asset_id || null,
      movement.recipient_id || null,
      movement.supplier_id || null,
      movement.request_id || null,
      movement.performed_by,
      movement.created_at,
      id
    ]
  );

  return result.rows[0] || null;
}

async function createLedgerEntry(client, entry) {
  const result = await client.query(
    `
      INSERT INTO inventory_ledger (
        item_id,
        location_id,
        movement_id,
        quantity,
        unit_cost,
        total_cost,
        created_at
      )
      VALUES (
        $1::BIGINT,
        $2::BIGINT,
        $3::BIGINT,
        $4::NUMERIC,
        $5::NUMERIC,
        $6::NUMERIC,
        COALESCE($7::TIMESTAMP, NOW())
      )
      RETURNING *
    `,
    [
      entry.item_id,
      entry.location_id,
      entry.movement_id,
      entry.quantity,
      entry.unit_cost || 0,
      entry.total_cost || 0,
      entry.created_at || null
    ]
  );

  return result.rows[0];
}

async function saveLedgerEntry(client, entry) {
  const updated = await client.query(
    `
      UPDATE inventory_ledger
      SET
        item_id = $1::BIGINT,
        location_id = $2::BIGINT,
        quantity = $3::NUMERIC,
        unit_cost = $4::NUMERIC,
        total_cost = $5::NUMERIC,
        created_at = COALESCE($6::TIMESTAMP, created_at)
      WHERE movement_id = $7::BIGINT
      RETURNING *
    `,
    [
      entry.item_id,
      entry.location_id,
      entry.quantity,
      entry.unit_cost || 0,
      entry.total_cost || 0,
      entry.created_at || null,
      entry.movement_id
    ]
  );

  if (updated.rows[0]) {
    return updated.rows[0];
  }

  return createLedgerEntry(client, entry);
}

async function deleteLedgerEntries(client, movementId) {
  const result = await client.query(
    `
      DELETE FROM inventory_ledger
      WHERE movement_id = $1::BIGINT
      RETURNING *
    `,
    [movementId]
  );

  return result.rows;
}

async function deleteMovement(client, id) {
  const result = await client.query(
    `
      DELETE FROM stock_movements
      WHERE id = $1::BIGINT
      RETURNING *
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function insertMovementLog(client, entry) {
  try {
    const result = await client.query(
      `
        INSERT INTO movement_logs (movement_id, action, old_value, new_value, changed_by)
        VALUES ($1::BIGINT, $2::TEXT, $3::jsonb, $4::jsonb, $5::BIGINT)
        RETURNING *
      `,
      [
        entry.movement_id,
        entry.action,
        entry.old_value ? JSON.stringify(entry.old_value) : null,
        entry.new_value ? JSON.stringify(entry.new_value) : null,
        entry.changed_by || null
      ]
    );

    return result.rows[0];
  } catch (error) {
    if (isMissingMovementLogsTable(error)) {
      if (!hasLoggedMissingMovementLogsTable) {
        hasLoggedMissingMovementLogsTable = true;
        console.warn(
          "movement_logs table is missing. Skipping movement log persistence until the database migration is applied."
        );
      }

      return null;
    }

    throw error;
  }
}

async function getAverageUnitCost(itemId, locationId = null) {
  const values = [itemId];
  let where = "WHERE item_id = $1::BIGINT AND quantity > 0";

  if (locationId) {
    values.push(locationId);
    where += ` AND location_id = $${values.length}::BIGINT`;
  }

  const result = await query(
    `
      SELECT
        CASE
          WHEN COALESCE(SUM(quantity), 0) = 0 THEN 0
          ELSE COALESCE(SUM(total_cost), 0) / NULLIF(SUM(quantity), 0)
        END AS avg_cost
      FROM inventory_ledger
      ${where}
    `,
    values
  );

  return Number(result.rows[0]?.avg_cost || 0);
}

async function listMovements(filters = {}) {
  const conditions = ["1 = 1"];
  const values = [];

  if (filters.itemId) {
    values.push(filters.itemId);
    conditions.push(`sm.item_id = $${values.length}::BIGINT`);
  }

  if (filters.locationId) {
    values.push(filters.locationId);
    conditions.push(`sm.location_id = $${values.length}::BIGINT`);
  }

  if (filters.movementType) {
    values.push(filters.movementType);
    conditions.push(`sm.movement_type = $${values.length}::TEXT`);
  }

  if (filters.startDate) {
    values.push(filters.startDate);
    conditions.push(`sm.created_at >= $${values.length}::TIMESTAMP`);
  }

  if (filters.endDate) {
    values.push(filters.endDate);
    conditions.push(`sm.created_at <= $${values.length}::TIMESTAMP`);
  }

  const result = await query(
    `
      SELECT
        sm.id,
        sm.item_id,
        sm.location_id,
        sm.section_id,
        sm.asset_id,
        sm.recipient_id,
        sm.supplier_id,
        sm.source_location_id,
        sm.destination_location_id,
        sm.request_id,
        sm.created_at,
        sm.movement_type,
        sm.quantity,
        sm.unit_cost,
        sm.reference,
        COALESCE(il.quantity, 0) AS ledger_quantity,
        COALESCE((
          SELECT COUNT(*)
          FROM maintenance_items_used miu
          WHERE miu.movement_id = sm.id
        ), 0) AS maintenance_usage_count,
        i.name AS item_name,
        i.image_path AS item_image,
        l.name AS location,
        ss.name AS section,
        a.name AS asset,
        supplier.name AS supplier,
        recipient.name AS recipient,
        u.full_name AS entered_by
      FROM stock_movements sm
      JOIN items i ON i.id = sm.item_id AND i.is_active = TRUE
      JOIN locations l ON l.id = sm.location_id
      LEFT JOIN store_sections ss ON ss.id = sm.section_id
      LEFT JOIN assets a ON a.id = sm.asset_id
      LEFT JOIN suppliers supplier ON supplier.id = sm.supplier_id
      LEFT JOIN recipients recipient ON recipient.id = sm.recipient_id
      LEFT JOIN inventory_ledger il ON il.movement_id = sm.id
      JOIN users u ON u.id = sm.performed_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY sm.created_at DESC
    `,
    values
  );

  return result.rows;
}

async function listDailyMovements(filters = {}) {
  const conditions = ["DATE(sm.created_at) = COALESCE($1::date, CURRENT_DATE)"];
  const values = [filters.date || null];

  if (filters.itemId) {
    values.push(filters.itemId);
    conditions.push(`sm.item_id = $${values.length}::BIGINT`);
  }

  if (filters.locationId) {
    values.push(filters.locationId);
    conditions.push(`sm.location_id = $${values.length}::BIGINT`);
  }

  if (filters.movementType) {
    values.push(filters.movementType);
    conditions.push(`sm.movement_type = $${values.length}::TEXT`);
  }

  const result = await query(
    `
      SELECT
        sm.id,
        sm.item_id,
        sm.location_id,
        sm.section_id,
        sm.asset_id,
        sm.recipient_id,
        sm.supplier_id,
        sm.source_location_id,
        sm.destination_location_id,
        sm.request_id,
        i.name AS item_name,
        i.image_path AS item_image,
        sm.movement_type,
        sm.quantity,
        sm.unit_cost,
        COALESCE(il.quantity, 0) AS ledger_quantity,
        COALESCE((
          SELECT COUNT(*)
          FROM maintenance_items_used miu
          WHERE miu.movement_id = sm.id
        ), 0) AS maintenance_usage_count,
        l.name AS location,
        ss.name AS section,
        a.name AS asset,
        supplier.name AS supplier,
        recipient.name AS recipient,
        sm.reference,
        u.full_name AS entered_by,
        sm.created_at AS timestamp
      FROM stock_movements sm
      JOIN items i ON i.id = sm.item_id AND i.is_active = TRUE
      JOIN locations l ON l.id = sm.location_id
      LEFT JOIN store_sections ss ON ss.id = sm.section_id
      LEFT JOIN assets a ON a.id = sm.asset_id
      LEFT JOIN suppliers supplier ON supplier.id = sm.supplier_id
      LEFT JOIN recipients recipient ON recipient.id = sm.recipient_id
      LEFT JOIN inventory_ledger il ON il.movement_id = sm.id
      JOIN users u ON u.id = sm.performed_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY sm.created_at DESC
    `,
    values
  );

  return result.rows;
}

module.exports = {
  getBalanceForUpdate,
  upsertBalance,
  getMovementById,
  updateMovement,
  createMovement,
  createLedgerEntry,
  saveLedgerEntry,
  deleteLedgerEntries,
  deleteMovement,
  insertMovementLog,
  getAverageUnitCost,
  listMovements,
  listDailyMovements
};
