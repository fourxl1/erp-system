const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { validate, validationSchemas } = require("../middleware/validationMiddleware");

const {
  getDashboardStats,
  getRecentMovements,
  getLowStockItems,
  getRecentRequests,
  getDashboardData,
  getInventoryValue
} = require("../controllers/dashboardController");


// Dashboard stats
router.get(
  "/stats",
  protect,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  validate(validationSchemas.dashboardQuery),
  getDashboardStats
);


// Recent stock movements
router.get(
  "/recent-movements",
  protect,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  validate(validationSchemas.dashboardQuery),
  getRecentMovements
);


// Low stock items
router.get(
  "/low-stock",
  protect,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  validate(validationSchemas.dashboardQuery),
  getLowStockItems
);
// Recent stock requests
router.get(
  "/recent-requests",
  protect,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  validate(validationSchemas.dashboardQuery),
  getRecentRequests
);
router.get(
  "/",
  protect,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  validate(validationSchemas.dashboardQuery),
  getDashboardData
);
router.get(
  "/inventory-value",
  protect,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  validate(validationSchemas.dashboardQuery),
  getInventoryValue
);
module.exports = router;
