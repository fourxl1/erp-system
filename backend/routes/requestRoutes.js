const express = require("express");
const requestController = require("../controllers/requestController");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { validate, validationSchemas } = require("../middleware/validationMiddleware");

const router = express.Router();

router.get("/locations", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), requestController.getRequestLocations);
router.get("/", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.requestQuery), requestController.listRequests);
router.get("/:id", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.requestIdParam), requestController.getRequest);
router.post("/", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.createRequest), requestController.createRequest);
router.post("/:id/approve", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(validationSchemas.approveRequest), requestController.approveRequest);
router.post("/:id/reject", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(validationSchemas.rejectRequest), requestController.rejectRequest);
router.put("/:id/approve", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(validationSchemas.approveRequest), requestController.approveRequest);
router.put("/:id/reject", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(validationSchemas.rejectRequest), requestController.rejectRequest);
router.patch("/:id/approve", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(validationSchemas.approveRequest), requestController.approveRequest);
router.patch("/:id/reject", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(validationSchemas.rejectRequest), requestController.rejectRequest);

module.exports = router;
