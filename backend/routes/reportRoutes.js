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
router.get("/inventory-value/pdf", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.exportInventoryValueReportPdf);
router.get("/inventory-value/csv", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.exportInventoryValueReportCsv);
router.get("/inventory-value/excel", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.exportInventoryValueReportExcel);
router.get("/current-stock", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.getCurrentStockReport);
router.get("/current-stock/pdf", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.exportCurrentStockReportPdf);
router.get("/current-stock/csv", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.exportCurrentStockReportCsv);
router.get("/current-stock/excel", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.reportQuery), reportController.exportCurrentStockReportExcel);

module.exports = router;
