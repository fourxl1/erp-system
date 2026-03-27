const { withTransaction } = require("../config/db");
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

function assertStoreAccess(user, locationId) {
  if (
    user.role_code === "STAFF" &&
    user.location_id &&
    Number(user.location_id) !== Number(locationId)
  ) {
    throw buildError("Staff can only manage inventory in their assigned store", 403);
  }
}

function assertRequestDestinationAccess(user, destinationLocationId) {
  if (
    user.role_code === "STAFF" &&
    user.location_id &&
    Number(user.location_id) !== Number(destinationLocationId)
  ) {
    throw buildError("Staff can only request stock for their assigned store", 403);
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
  const route = resolveRequestRoute(request);

  if (user.role_code === "SUPERADMIN") {
    return true;
  }

  if (user.role_code === "STAFF") {
    return Number(request.requester_id) === Number(user.id);
  }

  if (user.role_code === "ADMIN") {
    return (
      Number(route.destination_location_id) === Number(user.location_id) ||
      Number(route.source_location_id || route.destination_location_id) === Number(user.location_id)
    );
  }

  return false;
}

function canApproveRequest(user, request) {
  const route = resolveRequestRoute(request);
  const approvalLocationId = route.source_location_id || route.destination_location_id;

  if (user.role_code === "SUPERADMIN") {
    return true;
  }

  if (user.role_code !== "ADMIN" || !user.location_id) {
    return false;
  }

  return Number(approvalLocationId) === Number(user.location_id);
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
    can_modify: !record.request_id && Number(record.maintenance_usage_count || 0) === 0
  };
}

async function insertMovementAuditLog(client, userId, action, entityId, details) {
  await client.query(
    `
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, action, "stock_movements", entityId, JSON.stringify(details)]
  );
}

async function triggerLowStockAlerts(entries = []) {
  const uniqueEntries = [...new Map(
    entries
      .filter((entry) => entry?.item_id && entry?.location_id)
      .map((entry) => [
        `${Number(entry.item_id)}:${Number(entry.location_id)}`,
        { itemId: Number(entry.item_id), locationId: Number(entry.location_id) }
      ])
  ).values()];

  for (const entry of uniqueEntries) {
    await notificationService.ensureLowStockAlert(entry.itemId, entry.locationId);
  }
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

  await insertMovementAuditLog(client, user.id, `MOVEMENT_${prepared.movementType}`, movement.id, {
    item_id: payload.item_id,
    location_id: payload.location_id,
    quantity: prepared.quantity,
    delta_quantity: prepared.deltaQuantity,
    reference: payload.reference || null,
    request_id: payload.request_id || null
  });

  return movement;
}

async function recordMovement(payload, user) {
  const movement = await withTransaction((client) => applySingleMovement(client, payload, user));
  await triggerLowStockAlerts([movement]);
  return movement;
}

async function recordMovementInTransaction(client, payload, user, options = {}) {
  return applySingleMovement(client, payload, user, options);
}

async function transferStock(payload, user) {
  if (!payload.source_location_id || !payload.destination_location_id) {
    throw buildError("Source and destination locations are required for transfers");
  }

  if (Number(payload.source_location_id) === Number(payload.destination_location_id)) {
    throw buildError("Transfer source and destination cannot be the same");
  }

  assertStoreAccess(user, payload.source_location_id);
  assertStoreAccess(user, payload.destination_location_id);

  const transferResult = await withTransaction((client) =>
    performTransferInTransaction(client, payload, user)
  );
  await triggerLowStockAlerts([transferResult.outMovement, transferResult.inMovement]);
  return transferResult;
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

async function getDailyMovements(filters, user) {
  const scopedFilters = { ...filters };

  if (filters.movementType) {
    scopedFilters.movementType = normalizeIncomingMovementType(filters.movementType);
  }

  if (user.role_code === "STAFF" && user.location_id) {
    scopedFilters.locationId = user.location_id;
  }

  return movementModel.listDailyMovements(scopedFilters);
}

async function listRequestLocations() {
  const locations = await systemModel.listLocations();
  return locations.filter((location) => location.is_active !== false);
}

async function getMovementHistory(filters, user) {
  const scopedFilters = { ...filters };

  if (filters.movementType) {
    scopedFilters.movementType = normalizeIncomingMovementType(filters.movementType);
  }

  if (user.role_code === "STAFF" && user.location_id) {
    scopedFilters.locationId = user.location_id;
  }

  return movementModel.listMovements(scopedFilters);
}

async function createRequest(payload, user) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw buildError("At least one request item is required");
  }

  await validateRequestItems(payload.items);

  const destinationLocationId = payload.location_id || user.location_id;
  const sourceLocationId = payload.source_location_id;

  if (!destinationLocationId) {
    throw buildError("location_id is required when the requester has no assigned location");
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

  await notificationService.notifyStockRequestCreated(request);
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
              movement_type: "OUT",
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
      }
    }

    await requestModel.updateRequestStatus(client, request.id, "APPROVED", {
      approvedBy: user.id
    });
    const approvedRequest = await requestModel.getRequestByIdWithClient(client, request.id);

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

    return {
      ...normalizeRequestResponse(approvedRequest, user),
      items: requestItems,
      results
    };
  });

  await notificationService.notifyStockRequestStatus(approvedRequest, "stock_request_approved");
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

    await client.query(
      `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [user.id, "REQUEST_REJECTED", "stock_requests", request.id, JSON.stringify({ reason })]
    );

    return {
      ...normalizeRequestResponse(rejectedRequest, user),
      items: requestItems
    };
  });

  await notificationService.notifyStockRequestStatus(rejectedRequest, "stock_request_rejected");
  return rejectedRequest;
}

async function listRequests(filters, user) {
  const scopedFilters = { ...filters };

  if (user.role_code === "STAFF") {
    scopedFilters.requesterId = user.id;
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

  if (!payload.location_id) {
    throw buildError("location_id is required for maintenance logs");
  }

  assertStoreAccess(user, payload.location_id);

  return withTransaction(async (client) => {
    const log = await maintenanceModel.createMaintenanceLog(client, {
      asset_id: payload.asset_id,
      location_id: payload.location_id,
      description: payload.description,
      performed_by: user.id
    });

    const usedItems = [];

    for (const item of payload.items_used) {
      const movement = await applySingleMovement(
        client,
        {
          item_id: item.item_id,
          location_id: payload.location_id,
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

  if (user.role_code === "STAFF" && user.location_id) {
    scopedFilters.locationId = user.location_id;
  }

  return maintenanceModel.getMaintenanceHistory(scopedFilters);
}

function assertMovementModificationAccess(user, movement) {
  if (user.role_code === "STAFF") {
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
      location_id: Number(payload.location_id || existingMovement.location_id),
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

    if (user.role_code === "STAFF") {
      assertStoreAccess(user, nextPayload.location_id);
    }

    const prepared = await prepareSingleMovement(client, nextPayload, user);

    const movement = await movementModel.updateMovement(client, id, {
      ...nextPayload,
      movement_type: prepared.movementType,
      quantity: prepared.quantity,
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
  getMaintenanceItems,
  getMaintenanceItemsForUser,
  normalizeMovementRecord,
  serializeMovementRecord
};
