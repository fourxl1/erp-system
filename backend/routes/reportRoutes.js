const express = require("express");
const reportController = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { validate, validationSchemas } = require("../middleware/validationMiddleware");

const router = express.Router();

router.get("/movements", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.getMovementReport);
router.get("/movements/pdf", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.exportMovementReportPdf);
router.get("/movements/csv", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.exportMovementReportCsv);
router.get("/movements/excel", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.exportMovementReportExcel);
router.get("/inventory-value", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.getInventoryValueReport);

module.exports = router;
