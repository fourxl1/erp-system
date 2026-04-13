const express = require("express");
const movementController = require("../controllers/movementController");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { validate, validationSchemas } = require("../middleware/validationMiddleware");

const router = express.Router();

router.get("/", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.movementQuery), movementController.getMovements);
router.get("/daily", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.dailyMovementQuery), movementController.getDailyMovements);
router.post("/", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(validationSchemas.movementPayload), movementController.recordMovement);
router.put(
  "/:id/confirm",
  protect,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  validate(validationSchemas.movementIdParam),
  movementController.confirmTransfer
);
router.put(
  "/:id/reject",
  protect,
  authorizeRoles("ADMIN", "SUPERADMIN"),
  validate({
    ...validationSchemas.movementIdParam,
    body: [{ field: "reason", type: "string", minLength: 3 }]
  }),
  movementController.rejectTransfer
);
router.put(
  "/:id",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate({ ...validationSchemas.movementPayload, params: validationSchemas.movementIdParam.params }),
  movementController.updateMovement
);
router.delete(
  "/:id",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate(validationSchemas.movementIdParam),
  movementController.deleteMovement
);

module.exports = router;
