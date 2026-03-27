const express = require("express");
const itemController = require("../controllers/itemController");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { validate, validationSchemas } = require("../middleware/validationMiddleware");

const router = express.Router();

router.get("/", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.itemQuery), itemController.getItems);
router.get("/availability", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.itemQuery), itemController.getAvailableInventory);
router.get("/stats", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.dashboardQuery), itemController.getInventoryStats);
router.get("/:id/stock", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.itemIdParam), itemController.getItemStock);
router.get("/:id", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.itemIdParam), itemController.getItem);
router.post("/", protect, authorizeRoles("ADMIN", "SUPERADMIN"), upload.single("image"), validate(validationSchemas.itemPayload), itemController.createNewItem);
router.put("/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), upload.single("image"), validate({ ...validationSchemas.itemPayload, params: validationSchemas.itemIdParam.params }), itemController.updateItemController);
router.delete("/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(validationSchemas.itemIdParam), itemController.deleteItemController);

module.exports = router;
