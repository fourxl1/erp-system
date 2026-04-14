const { withTransaction, withSavepoint } = require("../config/db");
const movementModel = require("../models/movementModel");
const requestModel = require("../models/requestModel");
const maintenanceModel = require("../models/maintenanceModel");
const itemModel = require("../models/itemModel");
const systemModel = require("../models/systemModel");
const notificationService = require("./notificationService");
const {
  normalizeIncomingMovementType,
  toPublicMovementType
} = require("../utils/movementTypes");
const {
  toInt,
  isAdmin,
  isStaff,
  isSuperAdmin,
  resolveWriteLocation,
  resolveReadLocation,
  resolveUserActiveLocation,
  isLocationAccessible
} = require("../utils/locationContext");

const MOVEMENT_TYPES = new Set([
  "IN",
  "OUT",
  "TRANSFER",
  "MAINTENANCE",
  "ADJUSTMENT",
  "ASSET_ISSUE"
]);
const OUTGOING_MOVEMENT_TYPES = new Set(["OUT", "MAINTENANCE", "ASSET_ISSUE"]);

function buildError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isLocationBoundUser(user) {
  return isStaff(user) && user.location_id;
}

function getScopedLocationId(user, requestedLocationId = null) {
  if (isStaff(user)) {
    return Number(user.location_id);
  }

  return (
    toInt(requestedLocationId) ||
    resolveUserActiveLocation(user) ||
    toInt(user.location_id) ||
    null
  );
}

function assertStoreAccess(user, locationId) {
  const scopedLocationId = toInt(locationId);

  if (!scopedLocationId) {
    return;
  }

  if (!isLocationAccessible(user, scopedLocationId)) {
    throw buildError("Users can only manage inventory in their assigned store", 403);
  }

  if (isAdmin(user) || isSuperAdmin(user)) {
    const activeLocationId = resolveWriteLocation(user, null, { requireLocation: false });

    if (!activeLocationId || Number(activeLocationId) !== Number(scopedLocationId)) {
      throw buildError("Operation is restricted to the active location context", 403);
    }
  }
}

function assertRequestDestinationAccess(user, destinationLocationId) {
  if (isLocationBoundUser(user) && Number(user.location_id) !== Number(destinationLocationId)) {
    throw buildError("Users can only request stock for their assigned store", 403);
  }

  assertStoreAccess(user, destinationLocationId);
}

function resolveRequestRoute(request) {
  if (request.source_location_id) {
    return {
      source_location_id: Number(request.source_location_id),
      source_location_name: request.source_location_name || null,
      destination_location_id: Number(request.location_id),
      destination_location_name: request.location_name || null
    };
  }

  if (request.destination_location_id) {
    return {
      source_location_id: Number(request.location_id),
      source_location_name: request.location_name || null,
      destination_location_id: Number(request.destination_location_id),
      destination_location_name: request.legacy_destination_location_name || null
    };
  }

  return {
    source_location_id: null,
    source_location_name: null,
    destination_location_id: Number(request.location_id),
    destination_location_name: request.location_name || null
  };
}

function canViewRequest(user, request) {
  if (user.role_code === "SUPERADMIN") {
    return true;
  }

  if (user.role_code === "STAFF") {
    return Number(request.requester_id) === Number(user.id);
  }

  if (user.role_code === "ADMIN") {
    return true;
  }

  return false;
}

function canApproveRequest(user, request) {
  const route = resolveRequestRoute(request);
  const approvalLocationId = route.source_location_id || route.destination_location_id;
  const activeLocationId = resolveUserActiveLocation(user) || toInt(user.location_id);

  if (user.role_code === "SUPERADMIN") {
    return true;
  }

  if (user.role_code !== "ADMIN" || !activeLocationId) {
    return false;
  }

  return Number(approvalLocationId) === Number(activeLocationId);
}

function normalizeRequestResponse(request, user) {
  const route = resolveRequestRoute(request);

  return {
    ...request,
    source_location_id: route.source_location_id,
    source_location_name: route.source_location_name,
    destination_location_id: route.destination_location_id,
    destination_location_name: route.destination_location_name,
    can_approve: canApproveRequest(user, request),
    can_reject: canApproveRequest(user, request)
  };
}

function assertRequestApprovalAccess(user, request) {
  if (!canApproveRequest(user, request)) {
    throw buildError("Only the source location admin or SuperAdmin can approve this request", 403);
  }
}

async function validateItem(itemId) {
  const item = await itemModel.getItemCategoryById(itemId);

  if (!item) {
    throw buildError("Item not found", 404);
  }

  return item;
}

async function validateSupplierForLocation(supplierId, locationId) {
  if (!supplierId) {
    return null;
  }

  const supplier = await systemModel.getSupplierById(Number(supplierId));

  if (!supplier) {
    throw buildError("Supplier not found", 404);
  }

  if (Number(supplier.location_id) !== Number(locationId)) {
    throw buildError("Supplier must belong to the active/source location", 400);
  }

  return supplier;
}

async function validateRecipientForLocation(recipientId, locationId) {
  if (!recipientId) {
    return null;
  }

  const recipient = await systemModel.getRecipientById(Number(recipientId));

  if (!recipient) {
    throw buildError("Recipient not found", 404);
  }

  if (Number(recipient.location_id) !== Number(locationId)) {
    throw buildError("Recipient must belong to the active/source location", 400);
  }

  return recipient;
}

async function validateSectionForLocation(sectionId, locationId) {
  if (!sectionId) {
    return null;
  }

  const section = await systemModel.getSectionById(Number(sectionId));

  if (!section) {
    throw buildError("Section not found", 404);
  }

  if (Number(section.location_id) !== Number(locationId)) {
    throw buildError("Section must belong to the active/source location", 400);
  }

  return section;
}

async function validateAssetForLocation(assetId, locationId) {
  if (!assetId) {
    return null;
  }

  const asset = await systemModel.getAssetById(Number(assetId));

  if (!asset) {
    throw buildError("Asset not found", 404);
  }

  if (Number(asset.location_id) !== Number(locationId)) {
    throw buildError("Asset must belong to the active/source location", 400);
  }

  return asset;
}

async function validateRequestItems(items) {
  const seenItemIds = new Set();

  for (const entry of items) {
    const itemId = Number(entry.item_id);

    if (seenItemIds.has(itemId)) {
      throw buildError("Duplicate item_id values are not allowed in a single request");
    }

    seenItemIds.add(itemId);
  }

  await Promise.all([...seenItemIds].map((itemId) => validateItem(itemId)));
}

function resolveAdjustmentDirection(movementType, adjustmentDirection, ledgerQuantity = null) {
  if (String(movementType || "").toUpperCase() !== "ADJUSTMENT") {
    return null;
  }

  if (ledgerQuantity !== null && ledgerQuantity !== undefined && Number(ledgerQuantity) < 0) {
    return "DECREASE";
  }

  return String(adjustmentDirection || "").toUpperCase() === "DECREASE" ? "DECREASE" : "INCREASE";
}

function computeDeltaQuantity(movementType, quantity, adjustmentDirection, ledgerQuantity = null) {
  const normalizedType = String(movementType || "").toUpperCase();

  if (normalizedType === "ADJUSTMENT") {
    return resolveAdjustmentDirection(normalizedType, adjustmentDirection, ledgerQuantity) === "DECREASE"
      ? -quantity
      : quantity;
  }

  return OUTGOING_MOVEMENT_TYPES.has(normalizedType) ? -quantity : quantity;
}

function serializeMovementRecord(record) {
  if (!record) {
    return record;
  }

  const normalizedType = String(record.movement_type || "").toUpperCase();

  return {
    ...record,
    movement_type: toPublicMovementType(record.movement_type),
    adjustment_direction:
      normalizedType === "ADJUSTMENT"
        ? resolveAdjustmentDirection(normalizedType, record.adjustment_direction, record.ledger_quantity)
        : null,
    can_modify:
      normalizedType !== "TRANSFER" &&
      !record.request_id &&
      Number(record.maintenance_usage_count || 0) === 0
  };
}

function normalizeMovementItemsField(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function serializeMovementHeader(record, user = null) {
  const movement = {
    ...record,
    movement_type: toPublicMovementType(record.movement_type),
    items: normalizeMovementItemsField(record.items),
    status: String(record.status || "").toUpperCase()
  };

  if (!user) {
    return movement;
  }

  return {
    ...movement,
    can_confirm: canManageTransferAtDestination(user, movement) && movement.status === "PENDING",
    can_reject: canManageTransferAtDestination(user, movement) && movement.status === "PENDING"
  };
}

async function insertMovementAuditLog(client, userId, action, entityId, details) {
  try {
    await withSavepoint(client, async () => {
      await client.query(
        `
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [userId, action, "stock_movements", entityId, JSON.stringify(details)]
      );
    });
  } catch (error) {
    console.warn(`Failed to insert movement audit log (${action}):`, error.message);
  }
}

async function insertMaintenanceAuditLog(client, userId, action, entityId, details) {
  try {
    await withSavepoint(client, async () => {
      await client.query(
        `
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [userId, action, "maintenance_logs", entityId, JSON.stringify(details)]
      );
    });
  } catch (error) {
    console.warn(`Failed to insert maintenance audit log (${action}):`, error.message);
  }
}



async function triggerLowStockAlerts(entries = []) {
  return entries;
}

function normalizeMovementItems(items, movementType) {
  if (!Array.isArray(items) || items.length === 0) {
    throw buildError("At least one movement item is required");
  }

  const seen = new Set();
  const normalizedType = String(movementType || "").toUpperCase();

  return items.map((entry, index) => {
    const itemId = Number(entry.item_id);
    const quantity = Number(entry.quantity);
    const cost =
      entry.cost === undefined || entry.cost === null || String(entry.cost).trim() === ""
        ? null
        : Number(entry.cost);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw buildError(`movement item at position ${index + 1} has an invalid item_id`);
    }

    if (seen.has(itemId)) {
      throw buildError("Duplicate item_id values are not allowed in one movement");
    }

    seen.add(itemId);

    if (!Number.isFinite(quantity) || quantity === 0) {
      throw buildError(`movement item at position ${index + 1} must include a non-zero quantity`);
    }

    if (normalizedType !== "ADJUSTMENT" && quantity < 0) {
      throw buildError("Negative quantities are only allowed for ADJUSTMENT movements");
    }

    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      throw buildError(`movement item at position ${index + 1} has an invalid cost`);
    }

    return {
      item_id: itemId,
      quantity: quantity,
      cost: cost
    };
  });
}

async function validateMovementItems(items) {
  await Promise.all(items.map((entry) => validateItem(entry.item_id)));
}

function resolveItemDelta(item, movementType, phase = "SOURCE") {
  const normalizedType = String(movementType || "").toUpperCase();

  if (normalizedType === "IN") {
    return Math.abs(Number(item.quantity));
  }

  if (normalizedType === "OUT") {
    return Math.abs(Number(item.quantity)) * -1;
  }

  if (normalizedType === "TRANSFER") {
    return phase === "DESTINATION"
      ? Math.abs(Number(item.quantity))
      : Math.abs(Number(item.quantity)) * -1;
  }

  if (normalizedType === "ADJUSTMENT") {
    return Number(item.quantity);
  }

  return computeDeltaQuantity(normalizedType, Math.abs(Number(item.quantity)), null, null);
}

async function assertStockAvailabilityForItems(client, items, locationId, movementType, phase = "SOURCE") {
  for (const item of items) {
    const delta = resolveItemDelta(item, movementType, phase);
    if (delta >= 0) {
      continue;
    }

    const current = await movementModel.getBalanceForUpdate(client, item.item_id, locationId);
    const currentQuantity = Number(current?.quantity || 0);

    if (currentQuantity + delta < 0) {
      throw buildError("Insufficient stock for one or more movement items");
    }
  }
}

async function applyMovementItemDeltas(
  client,
  movement,
  items,
  locationId,
  movementType,
  phase = "SOURCE"
) {
  const affected = [];

  for (const item of items) {
    const delta = resolveItemDelta(item, movementType, phase);
    const averageCost = await movementModel.getAverageUnitCost(item.item_id, locationId);
    const hasExplicitCost = item.cost !== null && item.cost !== undefined;
    const resolvedUnitCost =
      movementType === "IN"
        ? Number(item.cost || 0)
        : movementType === "ADJUSTMENT"
          ? (hasExplicitCost ? Number(item.cost) : averageCost)
          : (hasExplicitCost ? Number(item.cost) : averageCost);

    const balance = await movementModel.upsertBalance(client, item.item_id, locationId, delta);

    if (!balance || Number(balance.quantity) < 0) {
      throw buildError("Inventory balance cannot become negative");
    }

    await movementModel.createLedgerEntry(client, {
      item_id: item.item_id,
      location_id: locationId,
      movement_id: movement.id,
      quantity: delta,
      unit_cost: resolvedUnitCost,
      total_cost: delta * resolvedUnitCost,
      created_at: movement.created_at
    });

    affected.push({
      item_id: item.item_id,
      location_id: locationId
    });
  }

  return affected;
}

function summarizeHeaderLegacyValues(items) {
  const firstItem = items[0];
  return {
    item_id: firstItem.item_id,
    quantity: Math.abs(Number(firstItem.quantity)),
    unit_cost: Number(firstItem.cost || 0)
  };
}

function canManageTransferAtDestination(user, movement) {
  if (!movement || String(movement.movement_type || "").toUpperCase() !== "TRANSFER") {
    return false;
  }

  if (!isAdmin(user) && !isSuperAdmin(user)) {
    return false;
  }

  const activeLocationId = resolveWriteLocation(user, null, { requireLocation: false });
  if (!activeLocationId) {
    return false;
  }

  return Number(activeLocationId) === Number(movement.destination_location_id);
}

async function recordMovementWithItems(client, payload, user) {
  const notificationService = require("./notificationService");
  const movementType = normalizeIncomingMovementType(payload.movement_type);

  if (!MOVEMENT_TYPES.has(movementType)) {
    throw buildError("Invalid movement type");
  }

  const normalizedItems = normalizeMovementItems(payload.items, movementType);
  await validateMovementItems(normalizedItems);

  if (movementType === "IN" && !payload.supplier_id) {
    throw buildError("supplier_id is required for IN movements");
  }

  if (movementType === "OUT" && !payload.recipient_id) {
    throw buildError("recipient_id is required for OUT movements");
  }

  const sourceLocationId =
    movementType === "TRANSFER"
      ? resolveWriteLocation(user, null)
      : resolveWriteLocation(user, null);

  const destinationLocationId =
    movementType === "TRANSFER"
      ? toInt(payload.destination_location_id)
      : null;

  if (movementType === "TRANSFER" && !destinationLocationId) {
    throw buildError("destination_location_id is required for TRANSFER movements");
  }

  if (movementType === "TRANSFER" && Number(sourceLocationId) === Number(destinationLocationId)) {
    throw buildError("Transfer source and destination cannot be the same");
  }

  await validateSectionForLocation(payload.section_id, sourceLocationId);
  await validateAssetForLocation(payload.asset_id, sourceLocationId);

  if (movementType === "IN") {
    await validateSupplierForLocation(payload.supplier_id, sourceLocationId);
  }

  if (movementType === "OUT") {
    await validateRecipientForLocation(payload.recipient_id, sourceLocationId);
  }

  await assertStockAvailabilityForItems(
    client,
    normalizedItems,
    sourceLocationId,
    movementType,
    "SOURCE"
  );

  const summary = summarizeHeaderLegacyValues(normalizedItems);
  const movement = await movementModel.createMovementHeader(client, {
    ...summary,
    movement_type: movementType,
    location_id: sourceLocationId,
    source_location_id: movementType === "TRANSFER" ? sourceLocationId : null,
    destination_location_id: movementType === "TRANSFER" ? destinationLocationId : null,
    recipient_id: payload.recipient_id || null,
    supplier_id: payload.supplier_id || null,
    section_id: payload.section_id || null,
    asset_id: payload.asset_id || null,
    request_id: payload.request_id || null,
    reference: payload.reference || null,
    performed_by: payload.performed_by || user.id,
    created_by: user.id,
    status: movementType === "TRANSFER" ? "PENDING" : "COMPLETED",
    created_at: payload.created_at || null
  });

  const movementItemsPayload = normalizedItems.map((entry) => ({
    item_id: entry.item_id,
    quantity: movementType === "ADJUSTMENT" ? entry.quantity : Math.abs(Number(entry.quantity)),
    cost: entry.cost || 0
  }));
  await movementModel.insertMovementItems(
    client,
    movement.id,
    sourceLocationId,
    movementItemsPayload
  );

  await applyMovementItemDeltas(
    client,
    movement,
    normalizedItems,
    sourceLocationId,
    movementType,
    "SOURCE"
  );

  const hydrated = await movementModel.getMovementHeaderById(movement.id, { client });

  await insertMovementAuditLog(client, user.id, `MOVEMENT_${movementType}`, movement.id, {
    movement_type: movementType,
    location_id: sourceLocationId,
    source_location_id: movementType === "TRANSFER" ? sourceLocationId : null,
    destination_location_id: destinationLocationId,
    status: movementType === "TRANSFER" ? "PENDING" : "COMPLETED",
    items: movementItemsPayload.length
  });

  return hydrated;
}

async function prepareSingleMovement(client, payload, user, options = {}) {
  await validateItem(payload.item_id);

  if (!payload.location_id) {
    throw buildError("location_id is required for this movement");
  }

  if (!options.skipAccessCheck) {
    assertStoreAccess(user, payload.location_id);
  }

  const quantity = Number(payload.quantity);
  const movementType = normalizeIncomingMovementType(payload.movement_type);

  if (!MOVEMENT_TYPES.has(movementType) || movementType === "TRANSFER") {
    throw buildError("Invalid movement type");
  }

  if (!quantity || quantity <= 0) {
    throw buildError("Quantity must be greater than zero");
  }

  await validateSectionForLocation(payload.section_id, payload.location_id);
  await validateAssetForLocation(payload.asset_id, payload.location_id);

  if (payload.supplier_id) {
    await validateSupplierForLocation(payload.supplier_id, payload.location_id);
  }

  const balanceBefore =
    options.balanceBefore ||
    (await movementModel.getBalanceForUpdate(client, payload.item_id, payload.location_id));
  const currentQuantity = Number(balanceBefore?.quantity || 0);
  const adjustmentDirection = resolveAdjustmentDirection(
    movementType,
    payload.adjustment_direction,
    options.ledgerQuantity
  );
  const deltaQuantity = computeDeltaQuantity(
    movementType,
    quantity,
    adjustmentDirection,
    options.ledgerQuantity
  );

  if (currentQuantity + deltaQuantity < 0) {
    throw buildError("Insufficient stock for this movement");
  }

  const hasExplicitUnitCost =
    payload.unit_cost !== undefined &&
    payload.unit_cost !== null &&
    String(payload.unit_cost).trim() !== "";
  const averageCost =
    options.averageCost ??
    (await movementModel.getAverageUnitCost(payload.item_id, payload.location_id));
  const resolvedUnitCost =
    movementType === "IN"
      ? Number(payload.unit_cost || 0)
      : movementType === "ADJUSTMENT"
      ? (hasExplicitUnitCost ? Number(payload.unit_cost) : averageCost)
        : averageCost;

  return {
    movementType,
    quantity,
    deltaQuantity,
    resolvedUnitCost,
    adjustmentDirection
  };
}

async function applySingleMovement(client, payload, user, options = {}) {
  const prepared = await prepareSingleMovement(client, payload, user, options);

  const movement = await movementModel.createMovement(client, {
    ...payload,
    movement_type: prepared.movementType,
    quantity: prepared.quantity,
    detail_quantity: prepared.movementType === "ADJUSTMENT" ? prepared.deltaQuantity : prepared.quantity,
    unit_cost: prepared.resolvedUnitCost,
    performed_by: payload.performed_by || user.id
  });

  const balance = await movementModel.upsertBalance(
    client,
    payload.item_id,
    payload.location_id,
    prepared.deltaQuantity
  );

  if (!balance || Number(balance.quantity) < 0) {
    throw buildError("Inventory balance cannot become negative");
  }

  await movementModel.createLedgerEntry(client, {
    item_id: payload.item_id,
    location_id: payload.location_id,
    movement_id: movement.id,
    quantity: prepared.deltaQuantity,
    unit_cost: prepared.resolvedUnitCost,
    total_cost: prepared.deltaQuantity * prepared.resolvedUnitCost,
    created_at: payload.created_at
  });

  try {
    await movementModel.insertMovementLog(client, {
      movement_id: movement.id,
      action: "CREATED",
      old_value: null,
      new_value: serializeMovementRecord({
        ...movement,
        ledger_quantity: prepared.deltaQuantity,
        maintenance_usage_count: 0
      }),
      changed_by: user.id
    });
  } catch (logError) {
    console.warn("Failed to insert movement log:", logError.message);
  }

  try {
    await insertMovementAuditLog(client, user.id, `MOVEMENT_${prepared.movementType}`, movement.id, {
      item_id: payload.item_id,
      location_id: payload.location_id,
      quantity: prepared.quantity,
      delta_quantity: prepared.deltaQuantity,
      reference: payload.reference || null,
      request_id: payload.request_id || null
    });
  } catch (auditError) {
    console.warn("Failed to insert movement audit log:", auditError.message);
  }

  return movement;
}


async function recordMovement(payload, user) {
  const normalizedType = normalizeIncomingMovementType(payload.movement_type);
  const normalizedItems = Array.isArray(payload.items)
    ? payload.items
    : payload.item_id
      ? [
          {
            item_id: payload.item_id,
            quantity:
              normalizedType === "ADJUSTMENT" && payload.adjustment_direction === "DECREASE"
                ? Math.abs(Number(payload.quantity || 0)) * -1
                : Number(payload.quantity || 0),
            cost: payload.unit_cost
          }
        ]
      : [];

  if (!normalizedType || normalizedItems.length === 0) {
    throw buildError("movement_type and movement items are required");
  }

  const movement = await withTransaction((client) =>
    recordMovementWithItems(
      client,
      {
        ...payload,
        movement_type: normalizedType,
        items: normalizedItems
      },
      user
    )
  );

  if (normalizedType === "TRANSFER") {
    await notificationService.notifyTransferCreated(
      movement,
      movement.source_location_name || "Source",
      movement.destination_location_name || "Destination"
    );
  }

  return movement;
}

async function recordMovementInTransaction(client, payload, user, options = {}) {
  const normalizedType = normalizeIncomingMovementType(payload.movement_type);

  if (!normalizedType) {
    throw buildError("Invalid movement type");
  }

  if (payload.items && Array.isArray(payload.items) && payload.items.length > 0) {
    return recordMovementWithItems(
      client,
      {
        ...payload,
        movement_type: normalizedType
      },
      user
    );
  }

  if (!payload.item_id || payload.quantity === undefined || payload.quantity === null) {
    throw buildError("item_id and quantity are required");
  }

  const quantity =
    normalizedType === "ADJUSTMENT" && payload.adjustment_direction === "DECREASE"
      ? Math.abs(Number(payload.quantity)) * -1
      : Number(payload.quantity);

  return recordMovementWithItems(
    client,
    {
      ...payload,
      movement_type: normalizedType,
      items: [
        {
          item_id: payload.item_id,
          quantity,
          cost: payload.unit_cost
        }
      ]
    },
    user
  );
}

async function transferStock(payload, user) {
  const movement = await recordMovement(
    {
      ...payload,
      movement_type: "TRANSFER",
      items: payload.items || [
        {
          item_id: payload.item_id,
          quantity: payload.quantity,
          cost: payload.unit_cost
        }
      ]
    },
    user
  );

  return {
    movement
  };
}

async function performTransferInTransaction(client, payload, user, options = {}) {
  const averageCost =
    options.averageCost ??
    (await movementModel.getAverageUnitCost(payload.item_id, payload.source_location_id));

  const outMovement = await applySingleMovement(
    client,
    {
      ...payload,
      location_id: payload.source_location_id,
      movement_type: "OUT",
      destination_location_id: payload.destination_location_id
    },
    user,
    { ...options, averageCost }
  );

  const inMovement = await applySingleMovement(
    client,
    {
      ...payload,
      location_id: payload.destination_location_id,
      movement_type: "IN",
      source_location_id: payload.source_location_id,
      unit_cost: averageCost
    },
    user,
    { ...options, averageCost }
  );

  return { outMovement, inMovement };
}

async function confirmTransfer(transferId, user) {
  const transfer = await withTransaction(async (client) => {
    const movement = await movementModel.getMovementHeaderById(transferId, {
      client,
      forUpdate: true
    });

    if (!movement) {
      throw buildError("Transfer not found", 404);
    }

    if (String(movement.movement_type || "").toUpperCase() !== "TRANSFER") {
      throw buildError("Only transfer movements can be confirmed");
    }

    if (movement.status !== "PENDING") {
      throw buildError("Only pending transfers can be confirmed");
    }

    if (!canManageTransferAtDestination(user, movement)) {
      throw buildError("Only destination admins can confirm this transfer", 403);
    }

    const movementItems = movement.items || [];
    await assertStockAvailabilityForItems(
      client,
      movementItems,
      movement.destination_location_id,
      "TRANSFER",
      "DESTINATION"
    );

    await applyMovementItemDeltas(
      client,
      movement,
      movementItems,
      movement.destination_location_id,
      "TRANSFER",
      "DESTINATION"
    );

    await movementModel.updateMovementStatus(client, transferId, "COMPLETED", {
      transfer_confirmed_by: user.id,
      transfer_confirmed_at: new Date()
    });

    await insertMovementAuditLog(client, user.id, "TRANSFER_CONFIRMED", transferId, {
      source_location_id: movement.source_location_id,
      destination_location_id: movement.destination_location_id,
      items: movementItems.length
    });

    return movementModel.getMovementHeaderById(transferId, { client });
  });

  await notificationService.notifyTransferConfirmed(
    transfer,
    transfer.source_location_name || "Source",
    transfer.destination_location_name || "Destination"
  );

  return transfer;
}

async function rejectTransfer(transferId, user, reason = null) {
  const transfer = await withTransaction(async (client) => {
    const movement = await movementModel.getMovementHeaderById(transferId, {
      client,
      forUpdate: true
    });

    if (!movement) {
      throw buildError("Transfer not found", 404);
    }

    if (String(movement.movement_type || "").toUpperCase() !== "TRANSFER") {
      throw buildError("Only transfer movements can be rejected");
    }

    if (movement.status !== "PENDING") {
      throw buildError("Only pending transfers can be rejected");
    }

    if (!canManageTransferAtDestination(user, movement)) {
      throw buildError("Only destination admins can reject this transfer", 403);
    }

    const movementItems = movement.items || [];
    await applyMovementItemDeltas(
      client,
      movement,
      movementItems,
      movement.source_location_id,
      "IN",
      "SOURCE"
    );

    await movementModel.updateMovementStatus(client, transferId, "REJECTED", {
      transfer_confirmed_by: user.id,
      transfer_confirmed_at: new Date()
    });

    await insertMovementAuditLog(client, user.id, "TRANSFER_REJECTED", transferId, {
      source_location_id: movement.source_location_id,
      destination_location_id: movement.destination_location_id,
      reason: reason || null,
      items: movementItems.length
    });

    return movementModel.getMovementHeaderById(transferId, { client });
  });

  await notificationService.notifyTransferRejected(
    transfer,
    transfer.source_location_name || "Source",
    transfer.destination_location_name || "Destination"
  );

  return transfer;
}

async function getDailyMovements(filters, user) {
  const scopedFilters = {
    movementType: filters.movementType ? normalizeIncomingMovementType(filters.movementType) : null,
    locationId: resolveReadLocation(user, filters.locationId),
    status: filters.status ? String(filters.status).toUpperCase() : null
  };

  if (filters.startDate || filters.endDate) {
    scopedFilters.startDate = filters.startDate || null;
    scopedFilters.endDate = filters.endDate || null;
  } else {
    const date = filters.date || new Date().toISOString().slice(0, 10);
    scopedFilters.startDate = `${date}T00:00:00`;
    scopedFilters.endDate = `${date}T23:59:59.999`;
  }

  const movements = await movementModel.listMovementHeaders(scopedFilters);
  return movements.map((movement) => serializeMovementHeader(movement, user));
}

async function listRequestLocations() {
  const locations = await systemModel.listLocations();
  return locations.filter((location) => location.is_active !== false);
}

async function getMovementHistory(filters, user) {
  const scopedFilters = {
    locationId: resolveReadLocation(user, filters.locationId),
    movementType: filters.movementType ? normalizeIncomingMovementType(filters.movementType) : null,
    startDate: filters.startDate || null,
    endDate: filters.endDate || null,
    status: filters.status ? String(filters.status).toUpperCase() : null
  };

  const movements = await movementModel.listMovementHeaders(scopedFilters);
  return movements.map((movement) => serializeMovementHeader(movement, user));
}

async function createRequest(payload, user) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw buildError("At least one request item is required");
  }

  await validateRequestItems(payload.items);

  const destinationLocationId = resolveWriteLocation(user, null, {
    requireLocation: true
  });
  const sourceLocationId = toInt(payload.source_location_id);

  if (!destinationLocationId) {
    throw buildError("Active location context is required to create a stock request");
  }

  if (!sourceLocationId) {
    throw buildError("source_location_id is required for stock requests");
  }

  if (Number(sourceLocationId) === Number(destinationLocationId)) {
    throw buildError("source_location_id cannot be the same as the requesting location");
  }

  assertRequestDestinationAccess(user, destinationLocationId);

  const request = await withTransaction(async (client) => {
    const request = await requestModel.createRequestHeader(client, {
      request_number:
        payload.request_number || `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      requester_id: user.id,
      location_id: destinationLocationId,
      source_location_id: sourceLocationId,
      destination_location_id: null,
      notes: payload.notes || null
    });

    await requestModel.createRequestItems(client, request.id, payload.items);
    const requestItems = await requestModel.getRequestItemsWithClient(client, request.id);
    const hydratedRequest = await requestModel.getRequestByIdWithClient(client, request.id);

    await client.query(
      `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        user.id,
        "REQUEST_CREATED",
        "stock_requests",
        request.id,
        JSON.stringify({
          source_location_id: sourceLocationId,
          destination_location_id: destinationLocationId,
          items: requestItems.length
        })
      ]
    );

    return {
      ...normalizeRequestResponse(hydratedRequest, user),
      items: requestItems
    };
  });

  await notificationService.notifyRequestCreated(request);
  return request;
}

async function approveRequest(requestId, user, approvalData = {}) {
  const approvedRequest = await withTransaction(async (client) => {
    const request = await requestModel.getRequestByIdForUpdate(client, requestId);

    if (!request) {
      throw buildError("Stock request not found", 404);
    }

    if (request.status !== "PENDING") {
      throw buildError("Only pending requests can be approved");
    }

    assertRequestApprovalAccess(user, request);

    const requestItems = await requestModel.getRequestItemsWithClient(client, requestId);
    const results = [];
    const route = resolveRequestRoute(request);

    for (const item of requestItems) {
      if (route.source_location_id) {
        results.push(
          await performTransferInTransaction(
            client,
            {
              item_id: item.item_id,
              source_location_id: route.source_location_id,
              destination_location_id: route.destination_location_id,
              movement_type: "TRANSFER",
              quantity: item.quantity,
              unit_cost: item.unit_cost || 0,
              reference: approvalData.reference || request.request_number,
              request_id: request.id,
              recipient_id: null,
              performed_by: user.id
            },
            user,
            { skipAccessCheck: true }
          )
        );
      } else {
        results.push(
          await applySingleMovement(
            client,
            {
              item_id: item.item_id,
              location_id: route.destination_location_id,
              movement_type: "IN",
              quantity: item.quantity,
              unit_cost: item.unit_cost || 0,
              reference: approvalData.reference || request.request_number,
              request_id: request.id,
              supplier_id: null,
              performed_by: user.id
            },
            user,
            { skipAccessCheck: true }
          )
        );
      }
    }

    await requestModel.updateRequestStatus(client, request.id, "APPROVED", {
      approvedBy: user.id
    });
    const resultRequest = await requestModel.getRequestByIdWithClient(client, request.id);

    try {
      await withSavepoint(client, async () => {
        await client.query(
          `
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            user.id,
            "REQUEST_APPROVED",
            "stock_requests",
            request.id,
            JSON.stringify({
              source_location_id: route.source_location_id,
              destination_location_id: route.destination_location_id,
              items: requestItems.length,
              reference: approvalData.reference || request.request_number
            })
          ]
        );
      });
    } catch (auditError) {
      console.warn("Failed to insert request approval audit log:", auditError.message);
    }


    return {
      ...normalizeRequestResponse(resultRequest, user),
      items: requestItems,
      results
    };
  });



  await notificationService.notifyRequestUpdated(approvedRequest, "CONFIRMED");

  await triggerLowStockAlerts(
    approvedRequest.results.flatMap((entry) => {
      if (entry?.outMovement && entry?.inMovement) {
        return [entry.outMovement, entry.inMovement];
      }

      return entry ? [entry] : [];
    })
  );

  return approvedRequest;
}

async function rejectRequest(requestId, user, reason = null) {
  const rejectedRequest = await withTransaction(async (client) => {
    const request = await requestModel.getRequestByIdForUpdate(client, requestId);

    if (!request) {
      throw buildError("Stock request not found", 404);
    }

    if (request.status !== "PENDING") {
      throw buildError("Only pending requests can be rejected");
    }

    assertRequestApprovalAccess(user, request);

    const requestItems = await requestModel.getRequestItemsWithClient(client, requestId);

    await requestModel.updateRequestStatus(client, request.id, "REJECTED");
    const rejectedRequest = await requestModel.getRequestByIdWithClient(client, request.id);

    try {
      await withSavepoint(client, async () => {
        await client.query(
          `
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [user.id, "REQUEST_REJECTED", "stock_requests", request.id, JSON.stringify({ reason })]
        );
      });
    } catch (auditError) {
      console.warn("Failed to insert request rejection audit log:", auditError.message);
    }


    return {
      ...normalizeRequestResponse(rejectedRequest, user),
      items: requestItems
    };
  });


  await notificationService.notifyRequestUpdated(rejectedRequest, "REJECTED");
  return rejectedRequest;
}

async function listRequests(filters, user) {
  const scopedFilters = { ...filters };

  if (isStaff(user)) {
    scopedFilters.requesterId = user.id;
  } else if (isAdmin(user) || isSuperAdmin(user)) {
    scopedFilters.accessLocationId = resolveReadLocation(user, filters.locationId);
  }

  const requests = await requestModel.listRequests(scopedFilters);

  return Promise.all(
    requests.map(async (request) => ({
      ...normalizeRequestResponse(request, user),
      items: await requestModel.getRequestItems(request.id)
    }))
  );
}

async function getRequestDetails(id, user) {
  const request = await requestModel.getRequestById(id);

  if (!request) {
    throw buildError("Stock request not found", 404);
  }

  if (!canViewRequest(user, request)) {
    throw buildError("You do not have access to this request", 403);
  }

  return {
    ...normalizeRequestResponse(request, user),
    items: await requestModel.getRequestItems(id)
  };
}

async function logMaintenance(payload, user) {
  if (!Array.isArray(payload.items_used) || payload.items_used.length === 0) {
    throw buildError("Maintenance must include at least one item used");
  }

  const locationId = resolveWriteLocation(user, null, {
    requireLocation: true
  });
  await validateAssetForLocation(payload.asset_id, locationId);

  return withTransaction(async (client) => {
    const log = await maintenanceModel.createMaintenanceLog(client, {
      asset_id: payload.asset_id,
      location_id: locationId,
      description: payload.description,
      performed_by: user.id
    });

    const usedItems = [];

    for (const item of payload.items_used) {
      await validateSectionForLocation(item.section_id, locationId);
      const movement = await applySingleMovement(
        client,
        {
          item_id: item.item_id,
          location_id: locationId,
          section_id: item.section_id || null,
          movement_type: "MAINTENANCE",
          quantity: item.quantity,
          unit_cost: item.unit_cost || 0,
          reference: payload.reference || `MAINT-${log.id}`,
          asset_id: payload.asset_id,
          performed_by: user.id
        },
        user
      );

      usedItems.push(
        await maintenanceModel.addMaintenanceItemUsed(client, {
          maintenance_id: log.id,
          movement_id: movement.id,
          item_id: item.item_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost || 0
        })
      );
    }

    return {
      ...log,
      items_used: usedItems
    };
  });
}

async function getMaintenanceHistory(filters, user) {
  const scopedFilters = { ...filters };

  scopedFilters.locationId = resolveReadLocation(user, filters.locationId);

  return maintenanceModel.getMaintenanceHistory(scopedFilters);
}

function assertMaintenanceModificationAccess(user, maintenanceLog) {
  if (user.role_code === "STAFF") {
    throw buildError("Staff cannot modify maintenance records", 403);
  }

  if (user.role_code === "ADMIN") {
    assertStoreAccess(user, maintenanceLog.location_id);
  }
}

async function removeMaintenanceUsageEntries(client, maintenanceId) {
  const usageEntries = await maintenanceModel.getMaintenanceUsageEntries(maintenanceId, { client });
  const affectedEntries = [];

  for (const usage of usageEntries) {
    if (!usage.movement_id) {
      continue;
    }

    const movement = await movementModel.getMovementById(usage.movement_id, {
      client,
      forUpdate: true
    });

    if (!movement) {
      continue;
    }

    await reverseExistingMovement(client, movement);
    await movementModel.deleteLedgerEntries(client, movement.id);
    await movementModel.deleteMovement(client, movement.id);
    affectedEntries.push({
      item_id: movement.item_id,
      location_id: movement.location_id
    });
  }

  await maintenanceModel.deleteMaintenanceItemsUsed(client, maintenanceId);

  return {
    usageEntries,
    affectedEntries
  };
}

async function updateMaintenanceRecord(id, payload, user) {
  if (!Array.isArray(payload.items_used) || payload.items_used.length === 0) {
    throw buildError("Maintenance must include at least one item used");
  }

  const locationId = resolveWriteLocation(user, null, {
    requireLocation: true
  });
  await validateAssetForLocation(payload.asset_id, locationId);

  const updatedMaintenance = await withTransaction(async (client) => {
    const existingLog = await maintenanceModel.getMaintenanceLogById(id, {
      client,
      forUpdate: true
    });

    if (!existingLog) {
      throw buildError("Maintenance log not found", 404);
    }

    assertMaintenanceModificationAccess(user, existingLog);
    assertStoreAccess(user, locationId);

    const { usageEntries, affectedEntries: reversedEntries } = await removeMaintenanceUsageEntries(client, id);

    const updatedLog = await maintenanceModel.updateMaintenanceLog(client, id, {
      asset_id: Number(payload.asset_id),
      location_id: Number(locationId),
      description: payload.description
    });

    const usedItems = [];
    const createdEntries = [];

    for (const item of payload.items_used) {
      await validateSectionForLocation(item.section_id, locationId);
      const movement = await applySingleMovement(
        client,
        {
          item_id: Number(item.item_id),
          location_id: Number(locationId),
          section_id: item.section_id ? Number(item.section_id) : null,
          movement_type: "MAINTENANCE",
          quantity: Number(item.quantity),
          unit_cost: item.unit_cost ? Number(item.unit_cost) : 0,
          reference: payload.reference || `MAINT-${updatedLog.id}`,
          asset_id: Number(payload.asset_id),
          performed_by: user.id
        },
        user
      );

      usedItems.push(
        await maintenanceModel.addMaintenanceItemUsed(client, {
          maintenance_id: updatedLog.id,
          movement_id: movement.id,
          item_id: Number(item.item_id),
          quantity: Number(item.quantity),
          unit_cost: item.unit_cost ? Number(item.unit_cost) : 0
        })
      );

      createdEntries.push({
        item_id: movement.item_id,
        location_id: movement.location_id
      });
    }

    await insertMaintenanceAuditLog(client, user.id, "MAINTENANCE_UPDATED", id, {
      old_value: {
        ...existingLog,
        items_used: usageEntries
      },
      new_value: {
        ...updatedLog,
        items_used: usedItems
      }
    });

    return {
      maintenance: {
        ...updatedLog,
        items_used: usedItems
      },
      affectedEntries: [...reversedEntries, ...createdEntries]
    };
  });

  await triggerLowStockAlerts(updatedMaintenance.affectedEntries);
  return updatedMaintenance.maintenance;
}

async function deleteMaintenanceRecord(id, user) {
  const deletedMaintenance = await withTransaction(async (client) => {
    const existingLog = await maintenanceModel.getMaintenanceLogById(id, {
      client,
      forUpdate: true
    });

    if (!existingLog) {
      throw buildError("Maintenance log not found", 404);
    }

    assertMaintenanceModificationAccess(user, existingLog);

    const { usageEntries, affectedEntries } = await removeMaintenanceUsageEntries(client, id);
    const deletedLog = await maintenanceModel.deleteMaintenanceLog(client, id);

    await insertMaintenanceAuditLog(client, user.id, "MAINTENANCE_DELETED", id, {
      old_value: {
        ...existingLog,
        items_used: usageEntries
      }
    });

    return {
      maintenance: deletedLog || existingLog,
      affectedEntries
    };
  });

  await triggerLowStockAlerts(deletedMaintenance.affectedEntries);
  return deletedMaintenance.maintenance;
}

function assertMovementModificationAccess(user, movement) {
  if (user.role_code === "STAFF") {
    throw buildError("Staff cannot modify stock movements", 403);
  }

  if (user.role_code === "ADMIN") {
    assertStoreAccess(user, movement.location_id);
  }
}

function assertMovementCanBeSafelyModified(movement) {
  if (!movement) {
    throw buildError("Movement not found", 404);
  }

  if (String(movement.movement_type || "").toUpperCase() === "TRANSFER") {
    throw buildError("Transfer movements cannot be modified through this endpoint");
  }

  if (movement.request_id) {
    throw buildError("Movements created from stock requests cannot be modified safely", 400);
  }

  if (Number(movement.maintenance_usage_count || 0) > 0) {
    throw buildError("Movements linked to maintenance records cannot be modified safely", 400);
  }
}

function resolveOptionalRelation(nextValue, fallbackValue) {
  if (nextValue === undefined) {
    return fallbackValue || null;
  }

  if (nextValue === null || nextValue === "") {
    return null;
  }

  return Number(nextValue);
}

async function reverseExistingMovement(client, movement) {
  const currentBalance = await movementModel.getBalanceForUpdate(
    client,
    movement.item_id,
    movement.location_id
  );
  const currentQuantity = Number(currentBalance?.quantity || 0);
  const reverseDelta = computeDeltaQuantity(
    movement.movement_type,
    Number(movement.quantity),
    resolveAdjustmentDirection(movement.movement_type, null, movement.ledger_quantity),
    movement.ledger_quantity
  ) * -1;

  if (currentQuantity + reverseDelta < 0) {
    throw buildError(
      "This movement can no longer be reversed safely because it would create negative stock",
      409
    );
  }

  const balance = await movementModel.upsertBalance(
    client,
    movement.item_id,
    movement.location_id,
    reverseDelta
  );

  if (!balance || Number(balance.quantity) < 0) {
    throw buildError("Inventory balance cannot become negative");
  }

  return reverseDelta;
}

async function updateMovement(id, payload, user) {
  const updatedMovement = await withTransaction(async (client) => {
    const existingMovement = await movementModel.getMovementById(id, {
      client,
      forUpdate: true
    });

    assertMovementCanBeSafelyModified(existingMovement);
    assertMovementModificationAccess(user, existingMovement);

    await reverseExistingMovement(client, existingMovement);

    const nextPayload = {
      item_id: Number(payload.item_id),
      location_id: Number(existingMovement.location_id),
      section_id: resolveOptionalRelation(payload.section_id, existingMovement.section_id),
      movement_type: payload.movement_type,
      quantity: Number(payload.quantity),
      unit_cost:
        payload.unit_cost !== undefined &&
        payload.unit_cost !== null &&
        String(payload.unit_cost).trim() !== ""
          ? Number(payload.unit_cost)
          : undefined,
      reference:
        payload.reference === undefined
          ? existingMovement.reference || null
          : String(payload.reference || "").trim() || null,
      asset_id: resolveOptionalRelation(payload.asset_id, existingMovement.asset_id),
      recipient_id: resolveOptionalRelation(payload.recipient_id, existingMovement.recipient_id),
      supplier_id: resolveOptionalRelation(payload.supplier_id, existingMovement.supplier_id),
      source_location_id: resolveOptionalRelation(
        payload.source_location_id,
        existingMovement.source_location_id
      ),
      destination_location_id: resolveOptionalRelation(
        payload.destination_location_id,
        existingMovement.destination_location_id
      ),
      request_id: existingMovement.request_id || null,
      performed_by: existingMovement.performed_by,
      created_at: payload.created_at || existingMovement.created_at,
      adjustment_direction: payload.adjustment_direction
    };

    if (isLocationBoundUser(user)) {
      nextPayload.location_id = Number(user.location_id);
    }

    const prepared = await prepareSingleMovement(client, nextPayload, user);

    const movement = await movementModel.updateMovement(client, id, {
      ...nextPayload,
      movement_type: prepared.movementType,
      quantity: prepared.quantity,
      detail_quantity: prepared.movementType === "ADJUSTMENT" ? prepared.deltaQuantity : prepared.quantity,
      unit_cost: prepared.resolvedUnitCost
    });

    if (!movement) {
      throw buildError("Movement not found", 404);
    }

    const appliedBalance = await movementModel.upsertBalance(
      client,
      nextPayload.item_id,
      nextPayload.location_id,
      prepared.deltaQuantity
    );

    if (!appliedBalance || Number(appliedBalance.quantity) < 0) {
      throw buildError("Inventory balance cannot become negative");
    }

    await movementModel.saveLedgerEntry(client, {
      item_id: nextPayload.item_id,
      location_id: nextPayload.location_id,
      movement_id: id,
      quantity: prepared.deltaQuantity,
      unit_cost: prepared.resolvedUnitCost,
      total_cost: prepared.deltaQuantity * prepared.resolvedUnitCost,
      created_at: nextPayload.created_at
    });

    const oldSnapshot = serializeMovementRecord(existingMovement);
    const newSnapshot = serializeMovementRecord({
      ...movement,
      ledger_quantity: prepared.deltaQuantity,
      maintenance_usage_count: existingMovement.maintenance_usage_count
    });

    await movementModel.insertMovementLog(client, {
      movement_id: id,
      action: "UPDATED",
      old_value: oldSnapshot,
      new_value: newSnapshot,
      changed_by: user.id
    });

    await insertMovementAuditLog(client, user.id, "MOVEMENT_UPDATED", id, {
      old_value: oldSnapshot,
      new_value: newSnapshot
    });

    return {
      movement: {
        ...movement,
        ledger_quantity: prepared.deltaQuantity,
        maintenance_usage_count: existingMovement.maintenance_usage_count
      },
      affectedEntries: [
        { item_id: existingMovement.item_id, location_id: existingMovement.location_id },
        { item_id: nextPayload.item_id, location_id: nextPayload.location_id }
      ]
    };
  });

  await triggerLowStockAlerts(updatedMovement.affectedEntries);
  return updatedMovement.movement;
}

async function deleteMovement(id, user) {
  const deletedMovement = await withTransaction(async (client) => {
    const existingMovement = await movementModel.getMovementById(id, {
      client,
      forUpdate: true
    });

    assertMovementCanBeSafelyModified(existingMovement);
    assertMovementModificationAccess(user, existingMovement);

    await reverseExistingMovement(client, existingMovement);
    await movementModel.deleteLedgerEntries(client, id);

    const deleted = await movementModel.deleteMovement(client, id);

    if (!deleted) {
      throw buildError("Movement not found", 404);
    }

    const snapshot = serializeMovementRecord(existingMovement);

    await insertMovementAuditLog(client, user.id, "MOVEMENT_DELETED", id, {
      old_value: snapshot
    });

    return {
      movement: existingMovement,
      affectedEntries: [
        { item_id: existingMovement.item_id, location_id: existingMovement.location_id }
      ]
    };
  });

  await triggerLowStockAlerts(deletedMovement.affectedEntries);
  return deletedMovement.movement;
}

function normalizeMovementRecord(record) {
  return serializeMovementRecord(record);
}

async function getMaintenanceItems(maintenanceId) {
  return maintenanceModel.getMaintenanceItems(maintenanceId);
}

async function getMaintenanceItemsForUser(maintenanceId, user) {
  const maintenanceLog = await maintenanceModel.getMaintenanceLogById(maintenanceId);

  if (!maintenanceLog) {
    throw buildError("Maintenance log not found", 404);
  }

  assertStoreAccess(user, maintenanceLog.location_id);
  return maintenanceModel.getMaintenanceItems(maintenanceId);
}

module.exports = {
  recordMovement,
  recordMovementInTransaction,
  transferStock,
  confirmTransfer,
  rejectTransfer,
  updateMovement,
  deleteMovement,
  getDailyMovements,
  getMovementHistory,
  listRequestLocations,
  createRequest,
  approveRequest,
  rejectRequest,
  listRequests,
  getRequestDetails,
  logMaintenance,
  getMaintenanceHistory,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceItems,
  getMaintenanceItemsForUser,
  normalizeMovementRecord,
  serializeMovementRecord
};
