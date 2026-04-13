const express = require("express");
const maintenanceController = require("../controllers/maintenanceController");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { validate, validationSchemas } = require("../middleware/validationMiddleware");

const router = express.Router();

router.post("/log", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.maintenanceLog), maintenanceController.logMaintenance);
router.get("/history", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.maintenanceHistoryQuery), maintenanceController.getMaintenanceHistory);
router.put(
  "/:id",
  protect,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  validate({
    ...validationSchemas.maintenanceLog,
    params: [{ field: "id", required: true, type: "id" }]
  }),
  maintenanceController.updateMaintenance
);
router.delete("/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate({ params: [{ field: "id", required: true, type: "id" }] }), maintenanceController.deleteMaintenance);
router.get("/:id/items", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate({ params: [{ field: "id", required: true, type: "id" }] }), maintenanceController.getMaintenanceItems);
router.get("/asset/:asset_id", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.assetParam), maintenanceController.getAssetMaintenanceHistory);

module.exports = router;
