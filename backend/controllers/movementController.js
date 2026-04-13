const movementService = require("../services/movementService");
const { asyncHandler, sendSuccess } = require("../utils/http");
const { buildItemImageUrl } = require("../utils/itemImage");

function getStatusLabel(movement) {
  const normalizedType = String(movement?.movement_type || "").toUpperCase();
  const normalizedStatus = String(movement?.status || "").toUpperCase();

  if (normalizedType !== "TRANSFER") {
    return normalizedStatus;
  }

  if (normalizedStatus === "PENDING") {
    return "Not Received";
  }

  if (normalizedStatus === "COMPLETED") {
    return "Received";
  }

  if (normalizedStatus === "REJECTED") {
    return "Rejected";
  }

  return normalizedStatus;
}

function serializeMovement(movement, req) {
  if (!movement) {
    return movement;
  }

  return {
    ...movement,
    status_label: getStatusLabel(movement),
    items: Array.isArray(movement.items)
      ? movement.items.map((item) => ({
          ...item,
          item_image: buildItemImageUrl(req, item.item_image)
        }))
      : []
  };
}

const recordMovement = asyncHandler(async (req, res) => {
  const payload = {
    movement_type: req.body.movement_type,
    location_id: null,
    source_location_id: null,
    destination_location_id: req.body.destination_location_id,
    section_id: req.body.section_id,
    asset_id: req.body.asset_id,
    recipient_id: req.body.recipient_id,
    supplier_id: req.body.supplier_id,
    reference: req.body.reference,
    created_at: req.body.created_at || null,
    items:
      Array.isArray(req.body.items) && req.body.items.length > 0
        ? req.body.items
        : req.body.item_id
          ? [
              {
                item_id: req.body.item_id,
                quantity: req.body.quantity,
                cost: req.body.unit_cost
              }
            ]
          : []
  };

  const movement = await movementService.recordMovement(payload, req.user);

  return sendSuccess(res, serializeMovement(movement, req), {
    statusCode: 201,
    message: "Movement recorded successfully"
  });
});

const getMovements = asyncHandler(async (req, res) => {
  const movements = await movementService.getMovementHistory(
    {
      locationId: req.query.location_id,
      movementType: req.query.movement_type,
      status: req.query.status,
      startDate: req.query.start_date,
      endDate: req.query.end_date
    },
    req.user
  );

  return sendSuccess(res, {
    count: movements.length,
    movements: movements.map((movement) => serializeMovement(movement, req))
  });
});

const getDailyMovements = asyncHandler(async (req, res) => {
  const movements = await movementService.getDailyMovements(
    {
      date: req.query.date,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      locationId: req.query.location_id,
      movementType: req.query.movement_type,
      status: req.query.status
    },
    req.user
  );

  return sendSuccess(res, movements.map((movement) => serializeMovement(movement, req)));
});

const confirmTransfer = asyncHandler(async (req, res) => {
  const movement = await movementService.confirmTransfer(req.params.id, req.user);

  return sendSuccess(res, serializeMovement(movement, req), {
    message: "Transfer confirmed successfully"
  });
});

const rejectTransfer = asyncHandler(async (req, res) => {
  const movement = await movementService.rejectTransfer(
    req.params.id,
    req.user,
    req.body.reason || null
  );

  return sendSuccess(res, serializeMovement(movement, req), {
    message: "Transfer rejected successfully"
  });
});

const updateMovement = asyncHandler(async (req, res) => {
  const payload = {
    item_id: req.body.item_id,
    section_id: req.body.section_id,
    movement_type: req.body.movement_type,
    quantity: req.body.quantity,
    unit_cost: req.body.unit_cost,
    reference: req.body.reference,
    asset_id: req.body.asset_id,
    recipient_id: req.body.recipient_id,
    supplier_id: req.body.supplier_id,
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
  confirmTransfer,
  rejectTransfer,
  updateMovement,
  deleteMovement
};
