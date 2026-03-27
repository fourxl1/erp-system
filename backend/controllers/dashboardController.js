const inventoryService = require("../services/inventoryService");
const movementService = require("../services/movementService");
const reportService = require("../services/reportService");
const { asyncHandler, sendSuccess } = require("../utils/http");

const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await inventoryService.getInventoryStats(req.user, req.query.location_id);
  const requests = await movementService.listRequests({}, req.user);

  return sendSuccess(res, {
    total_items: stats.totalItems,
    low_stock_items: stats.lowStock,
    pending_requests: requests.filter((request) => request.status === "PENDING").length,
    approved_requests: requests.filter((request) => request.status === "APPROVED").length
  });
});

const getRecentMovements = asyncHandler(async (req, res) => {
  const history = await movementService.getMovementHistory(
    {
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(res, history.slice(0, 5));
});

const getLowStockItems = asyncHandler(async (req, res) => {
  const items = await inventoryService.listItems(
    {
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(res,
    items.filter((item) => Number(item.current_quantity || 0) <= Number(item.reorder_level || 0))
  );
});

const getRecentRequests = asyncHandler(async (req, res) => {
  const requests = await movementService.listRequests(
    {
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(res, requests.slice(0, 5));
});

const getDashboardData = asyncHandler(async (req, res) => {
  const [stats, recentMovements, lowStockItems, recentRequests] = await Promise.all([
    inventoryService.getInventoryStats(req.user, req.query.location_id),
    movementService.getMovementHistory({ locationId: req.query.location_id }, req.user),
    inventoryService.listItems({ locationId: req.query.location_id }, req.user),
    movementService.listRequests({ locationId: req.query.location_id }, req.user)
  ]);

  return sendSuccess(res, {
    stats: {
      total_items: stats.totalItems,
      low_stock_items: stats.lowStock,
      pending_requests: recentRequests.filter((request) => request.status === "PENDING").length,
      approved_requests: recentRequests.filter((request) => request.status === "APPROVED").length
    },
    recent_movements: recentMovements.slice(0, 5),
    low_stock_items: lowStockItems.filter(
      (item) => Number(item.current_quantity || 0) <= Number(item.reorder_level || 0)
    ),
    recent_requests: recentRequests.slice(0, 5)
  });
});

const getInventoryValue = asyncHandler(async (req, res) => {
  const rows = await reportService.getInventoryValue(
    {
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(res, {
    total_inventory_value_usd: rows.reduce((sum, row) => sum + Number(row.total_value || 0), 0)
  });
});

module.exports = {
  getDashboardStats,
  getRecentMovements,
  getLowStockItems,
  getRecentRequests,
  getDashboardData,
  getInventoryValue
};
