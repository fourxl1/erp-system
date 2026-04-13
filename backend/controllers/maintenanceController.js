const movementService = require("../services/movementService");
const { asyncHandler, sendSuccess } = require("../utils/http");
const { buildItemImageUrl } = require("../utils/itemImage");

function canManageMaintenance(user, entry) {
  if (!entry) {
    return false;
  }

  const activeLocationId = Number(user.active_location_id || user.location_id || 0);

  if ((user.role_code === "ADMIN" || user.role_code === "SUPERADMIN") && activeLocationId > 0) {
    return Number(activeLocationId) === Number(entry.location_id);
  }

  return false;
}

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

  return sendSuccess(
    res,
    history.map((entry) => ({
      ...entry,
      can_manage: canManageMaintenance(req.user, entry)
    }))
  );
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
  return sendSuccess(
    res,
    items.map((item) => ({
      ...item,
      item_image: buildItemImageUrl(req, item.item_image)
    }))
  );
});

const updateMaintenance = asyncHandler(async (req, res) => {
  const maintenance = await movementService.updateMaintenanceRecord(req.params.id, req.body, req.user);

  return sendSuccess(res, { maintenance }, { message: "Maintenance updated successfully" });
});

const deleteMaintenance = asyncHandler(async (req, res) => {
  const maintenance = await movementService.deleteMaintenanceRecord(req.params.id, req.user);

  return sendSuccess(res, { maintenance }, { message: "Maintenance deleted successfully" });
});

module.exports = {
  logMaintenance,
  getMaintenanceHistory,
  getAssetMaintenanceHistory,
  getMaintenanceItems,
  updateMaintenance,
  deleteMaintenance
};
