const { query } = require("../config/db");

async function createMaintenanceLog(client, logData) {
  const result = await client.query(
    `
      INSERT INTO maintenance_logs (
        asset_id,
        location_id,
        description,
        performed_by
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [
      logData.asset_id,
      logData.location_id || null,
      logData.description,
      logData.performed_by
    ]
  );

  return result.rows[0];
}

async function addMaintenanceItemUsed(client, entry) {
  const result = await client.query(
    `
      INSERT INTO maintenance_items_used (
        maintenance_id,
        movement_id,
        item_id,
        quantity,
        unit_cost
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      entry.maintenance_id,
      entry.movement_id || null,
      entry.item_id,
      entry.quantity,
      entry.unit_cost || 0
    ]
  );

  return result.rows[0];
}

async function getMaintenanceHistory(filters = {}) {
  const conditions = ["1 = 1"];
  const values = [];

  if (filters.assetId) {
    values.push(filters.assetId);
    conditions.push(`ml.asset_id = $${values.length}`);
  }

  if (filters.locationId) {
    values.push(filters.locationId);
    conditions.push(`ml.location_id = $${values.length}`);
  }

  const result = await query(
    `
      SELECT
        ml.id AS maintenance_id,
        ml.description,
        ml.created_at,
        a.name AS asset_name,
        a.asset_code,
        u.full_name AS performed_by
      FROM maintenance_logs ml
      JOIN assets a ON a.id = ml.asset_id
      JOIN users u ON u.id = ml.performed_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY ml.created_at DESC
    `,
    values
  );

  return result.rows;
}

async function getMaintenanceItems(maintenanceId) {
  const result = await query(
    `
      SELECT
        miu.id,
        miu.quantity,
        miu.unit_cost,
        i.name AS item_name,
        i.image_path AS item_image
      FROM maintenance_items_used miu
      JOIN items i ON i.id = miu.item_id
      WHERE miu.maintenance_id = $1
      ORDER BY i.name
    `,
    [maintenanceId]
  );

  return result.rows;
}

async function getMaintenanceLogById(maintenanceId) {
  const result = await query(
    `
      SELECT id, asset_id, location_id, performed_by
      FROM maintenance_logs
      WHERE id = $1
    `,
    [maintenanceId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createMaintenanceLog,
  addMaintenanceItemUsed,
  getMaintenanceHistory,
  getMaintenanceItems,
  getMaintenanceLogById
};
