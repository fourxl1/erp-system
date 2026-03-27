const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { validate, validationSchemas } = require("../middleware/validationMiddleware");

const { getAlerts, markAlertAsRead } = require("../controllers/alertController");

// Get system alerts
router.get(
  "/",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate(validationSchemas.dashboardQuery),
  getAlerts
);

router.put(
  "/:id/read",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate(validationSchemas.messageIdParam),
  markAlertAsRead
);

module.exports = router;
