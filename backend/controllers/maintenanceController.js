const movementService = require("../services/movementService");
const { asyncHandler, sendSuccess } = require("../utils/http");

const logMaintenance = asyncHandler(async (req, res) => {
  const maintenance = await movementService.logMaintenance(req.body, req.user);

  return sendSuccess(res, { maintenance }, {
    statusCode: 201,
    message: "Maintenance logged successfully"
  });
});

const getMaintenanceHistory = asyncHandler(async (req, res) => {
  const history = await movementService.getMaintenanceHistory(
    {
      assetId: req.query.asset_id,
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(res, history);
});

const getAssetMaintenanceHistory = asyncHandler(async (req, res) => {
  const history = await movementService.getMaintenanceHistory(
    {
      assetId: req.params.asset_id,
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(res, history);
});

const getMaintenanceItems = asyncHandler(async (req, res) => {
  const items = await movementService.getMaintenanceItemsForUser(req.params.id, req.user);
  return sendSuccess(res, items);
});

module.exports = {
  logMaintenance,
  getMaintenanceHistory,
  getAssetMaintenanceHistory,
  getMaintenanceItems
};
