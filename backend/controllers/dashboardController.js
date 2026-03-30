const inventoryService = require("../services/inventoryService");
const movementService = require("../services/movementService");
const reportService = require("../services/reportService");
const { asyncHandler, sendSuccess } = require("../utils/http");
const { buildItemImagePath, buildItemImageUrl } = require("../utils/itemImage");

function serializeInventoryItem(item, req) {
  return {
    ...item,
    image_path: buildItemImagePath(item.image_path),
    image_url: buildItemImageUrl(req, item.image_path)
  };
}

function serializeMovement(movement, req) {
  return {
    ...movement,
    item_image: buildItemImageUrl(req, movement.item_image)
  };
}

function serializeRequest(request, req) {
  return {
    ...request,
    items: Array.isArray(request.items)
      ? request.items.map((item) => ({
          ...item,
          item_image: buildItemImageUrl(req, item.item_image)
        }))
      : []
  };
}

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

  return sendSuccess(res, history.slice(0, 5).map((movement) => serializeMovement(movement, req)));
});

const getLowStockItems = asyncHandler(async (req, res) => {
  const items = await inventoryService.listItems(
    {
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(res,
    items
      .filter((item) => Number(item.current_quantity || 0) <= Number(item.reorder_level || 0))
      .map((item) => serializeInventoryItem(item, req))
  );
});

const getRecentRequests = asyncHandler(async (req, res) => {
  const requests = await movementService.listRequests(
    {
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(res, requests.slice(0, 5).map((request) => serializeRequest(request, req)));
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
    recent_movements: recentMovements.slice(0, 5).map((movement) => serializeMovement(movement, req)),
    low_stock_items: lowStockItems.filter(
      (item) => Number(item.current_quantity || 0) <= Number(item.reorder_level || 0)
    ).map((item) => serializeInventoryItem(item, req)),
    recent_requests: recentRequests.slice(0, 5).map((request) => serializeRequest(request, req))
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
