const movementService = require("../services/movementService");
const { asyncHandler, sendSuccess } = require("../utils/http");

const recordMovement = asyncHandler(async (req, res) => {
  const payload = {
    item_id: req.body.item_id,
    location_id: req.body.location_id || req.user.location_id,
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
            source_location_id: req.body.source_location_id || req.user.location_id,
            destination_location_id: req.body.destination_location_id
          },
          req.user
        )
      : await movementService.recordMovement(payload, req.user);

  const data = Array.isArray(result)
    ? result.map(movementService.normalizeMovementRecord)
    : result?.outMovement || result?.inMovement
      ? {
          outMovement: movementService.normalizeMovementRecord(result.outMovement),
          inMovement: movementService.normalizeMovementRecord(result.inMovement)
        }
      : movementService.normalizeMovementRecord(result);

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
    movements: movements.map(movementService.normalizeMovementRecord)
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

  return sendSuccess(res, movements.map(movementService.normalizeMovementRecord));
});

const updateMovement = asyncHandler(async (req, res) => {
  const payload = {
    item_id: req.body.item_id,
    location_id: req.body.location_id || req.user.location_id,
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

  return sendSuccess(res, movementService.normalizeMovementRecord(movement), {
    message: "Movement updated successfully"
  });
});

const deleteMovement = asyncHandler(async (req, res) => {
  const movement = await movementService.deleteMovement(req.params.id, req.user);

  return sendSuccess(res, movementService.normalizeMovementRecord(movement), {
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
