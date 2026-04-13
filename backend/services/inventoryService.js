const itemModel = require("../models/itemModel");
const systemModel = require("../models/systemModel");
const { query } = require("../config/db");
const { resolveReadLocation } = require("../utils/locationContext");

function assertStoreScope(user, locationId) {
  if (!locationId) {
    return;
  }

  if (
    user.role_code === "STAFF" &&
    user.location_id &&
    Number(user.location_id) !== Number(locationId)
  ) {
    const error = new Error("Users can only access inventory in their assigned store");
    error.statusCode = 403;
    throw error;
  }
}

function getScopedLocationId(user, requestedLocationId = null) {
  return resolveReadLocation(user, requestedLocationId);
}

async function listItems(filters, user) {
  const scopedFilters = {
    ...filters,
    locationId: getScopedLocationId(user, filters.locationId)
  };

  return itemModel.getAllItems(scopedFilters);
}

async function getItem(id, user, locationId = null) {
  const scopedLocationId = getScopedLocationId(user, locationId);
  return itemModel.getItemById(id, scopedLocationId);
}

async function createItem(payload, user) {
  const item = await itemModel.createItem(payload);

  if (user) {
    await systemModel.insertAuditLog(
      { query },
      {
        user_id: user.id,
        action: "ITEM_CREATED",
        entity_type: "items",
        entity_id: item.id,
        details: {
          name: item.name,
          category_id: item.category_id,
          unit: item.unit
        }
      }
    );
  }

  return item;
}

async function updateItem(id, payload, user) {
  const item = await itemModel.updateItem(id, payload);

  if (item && user) {
    await systemModel.insertAuditLog(
      { query },
      {
        user_id: user.id,
        action: "ITEM_UPDATED",
        entity_type: "items",
        entity_id: item.id,
        details: {
          name: item.name,
          category_id: item.category_id,
          unit: item.unit
        }
      }
    );
  }

  return item;
}

async function deleteItem(id, user) {
  const item = await itemModel.deleteItemById(id);

  if (item && user) {
    await systemModel.insertAuditLog(
      { query },
      {
        user_id: user.id,
        action: "ITEM_DELETED",
        entity_type: "items",
        entity_id: item.id,
        details: {
          name: item.name
        }
      }
    );
  }

  return item;
}

async function getInventoryStats(user, locationId = null) {
  const scopedLocationId = getScopedLocationId(user, locationId);
  assertStoreScope(user, scopedLocationId);

  const stats = await itemModel.getInventoryStats(scopedLocationId);

  return {
    totalItems: Number(stats.total_items || 0),
    lowStock: Number(stats.low_stock || 0),
    totalValue: user.role_code === "STAFF" ? null : Number(stats.total_value || 0)
  };
}

async function getCurrentStockByLocation(itemId, user) {
  const result = await itemModel.getItemById(itemId, null);

  if (!result) {
    const error = new Error("Item not found");
    error.statusCode = 404;
    throw error;
  }

  const scopedLocationId = getScopedLocationId(user, null);

  if (scopedLocationId) {
    return result.balances.filter(
      (balance) => Number(balance.location_id) === Number(scopedLocationId)
    );
  }

  return result.balances;
}

async function getStockSnapshot(filters, user) {
  return getAvailableInventory(filters, user);
}

async function getAvailableInventory(filters, user) {
  const values = [];
  const conditions = ["i.is_active = TRUE"];

  if (filters.itemId) {
    values.push(filters.itemId);
    conditions.push(`i.id = $${values.length}::BIGINT`);
  }

  const scopedLocationId = getScopedLocationId(user, filters.locationId);

  if (scopedLocationId) {
    values.push(scopedLocationId);
    conditions.push(`b.location_id = $${values.length}::BIGINT`);
  }

  const result = await query(
    `
      SELECT
        i.id AS item_id,
        i.name AS item_name,
        i.image_path AS item_image,
        b.location_id,
        l.name AS location,
        COALESCE(b.quantity, 0) AS current_quantity,
        GREATEST(COALESCE(b.quantity, 0) - COALESCE(i.reorder_level, 0), 0) AS available_quantity
      FROM inventory_balance b
      JOIN items i ON i.id = b.item_id
      JOIN locations l ON l.id = b.location_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY i.name, l.name
    `,
    values
  );

  return result.rows;
}

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  getInventoryStats,
  getCurrentStockByLocation,
  getStockSnapshot,
  getAvailableInventory
};
