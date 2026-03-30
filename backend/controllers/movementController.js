const movementService = require("../services/movementService");
const { asyncHandler, sendSuccess } = require("../utils/http");
const { buildItemImageUrl } = require("../utils/itemImage");

function isLocationBoundUser(user) {
  return (user.role_code === "ADMIN" || user.role_code === "STAFF") && user.location_id;
}

function canManageMovement(user, movement) {
  if (!movement.can_modify) {
    return false;
  }

  if (user.role_code === "SUPERADMIN") {
    return true;
  }

  return user.role_code === "ADMIN" && Number(user.location_id) === Number(movement.location_id);
}

function serializeMovement(movement, req) {
  if (!movement) {
    return movement;
  }

  return {
    ...movement,
    item_image: buildItemImageUrl(req, movement.item_image),
    can_modify: canManageMovement(req.user, movement)
  };
}

const recordMovement = asyncHandler(async (req, res) => {
  const resolvedLocationId = isLocationBoundUser(req.user)
    ? Number(req.user.location_id)
    : (req.body.location_id ? Number(req.body.location_id) : null);
  const payload = {
    item_id: req.body.item_id,
    location_id: resolvedLocationId,
    section_id: req.body.section_id,
    movement_type: req.body.movement_type,
    quantity: req.body.quantity,
    unit_cost: req.body.unit_cost,
    reference: req.body.reference,
    asset_id: req.body.asset_id,
    recipient_id: req.body.recipient_id,
    supplier_id: req.body.supplier_id,
    adjustment_direction: req.body.adjustment_direction,
    created_at: req.body.created_at || null,
    performed_by: req.user.id
  };

  const result =
    String(payload.movement_type || "").toUpperCase() === "TRANSFER"
      ? await movementService.transferStock(
          {
            ...payload,
            source_location_id: isLocationBoundUser(req.user)
              ? Number(req.user.location_id)
              : (req.body.source_location_id ? Number(req.body.source_location_id) : null),
            destination_location_id: req.body.destination_location_id ? Number(req.body.destination_location_id) : null
          },
          req.user
        )
      : await movementService.recordMovement(payload, req.user);

  const data = Array.isArray(result)
    ? result.map((movement) => serializeMovement(movementService.normalizeMovementRecord(movement), req))
    : result?.outMovement || result?.inMovement
      ? {
          outMovement: serializeMovement(movementService.normalizeMovementRecord(result.outMovement), req),
          inMovement: serializeMovement(movementService.normalizeMovementRecord(result.inMovement), req)
        }
      : serializeMovement(movementService.normalizeMovementRecord(result), req);

  return sendSuccess(res, data, {
    statusCode: 201,
    message: "Movement recorded successfully"
  });
});

const getMovements = asyncHandler(async (req, res) => {
  const movements = await movementService.getMovementHistory(
    {
      itemId: req.query.item_id,
      locationId: req.query.location_id,
      movementType: req.query.movement_type,
      startDate: req.query.start_date,
      endDate: req.query.end_date
    },
    req.user
  );

  return sendSuccess(res, {
    count: movements.length,
    movements: movements.map((movement) =>
      serializeMovement(movementService.normalizeMovementRecord(movement), req)
    )
  });
});

const getDailyMovements = asyncHandler(async (req, res) => {
  const movements = await movementService.getDailyMovements(
    {
      date: req.query.date,
      itemId: req.query.item_id,
      locationId: req.query.location_id,
      movementType: req.query.movement_type
    },
    req.user
  );

  return sendSuccess(
    res,
    movements.map((movement) =>
      serializeMovement(movementService.normalizeMovementRecord(movement), req)
    )
  );
});

const updateMovement = asyncHandler(async (req, res) => {
  const resolvedLocationId = isLocationBoundUser(req.user)
    ? Number(req.user.location_id)
    : (req.body.location_id ? Number(req.body.location_id) : null);
  const payload = {
    item_id: req.body.item_id,
    location_id: resolvedLocationId,
    section_id: req.body.section_id,
    movement_type: req.body.movement_type,
    quantity: req.body.quantity,
    unit_cost: req.body.unit_cost,
    reference: req.body.reference,
    asset_id: req.body.asset_id,
    recipient_id: req.body.recipient_id,
    supplier_id: req.body.supplier_id,
    source_location_id: req.body.source_location_id,
    destination_location_id: req.body.destination_location_id,
    adjustment_direction: req.body.adjustment_direction,
    created_at: req.body.created_at || null
  };

  const movement = await movementService.updateMovement(req.params.id, payload, req.user);

  return sendSuccess(res, serializeMovement(movementService.normalizeMovementRecord(movement), req), {
    message: "Movement updated successfully"
  });
});

const deleteMovement = asyncHandler(async (req, res) => {
  const movement = await movementService.deleteMovement(req.params.id, req.user);

  return sendSuccess(res, serializeMovement(movementService.normalizeMovementRecord(movement), req), {
    message: "Movement deleted successfully"
  });
});

module.exports = {
  recordMovement,
  getMovements,
  getDailyMovements,
  updateMovement,
  deleteMovement
};
