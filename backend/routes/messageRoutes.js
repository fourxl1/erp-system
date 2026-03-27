const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { validate, validationSchemas } = require("../middleware/validationMiddleware");

const {
  sendMessage,
  getMessageUsers,
  getMessages,
  markMessageAsRead
} = require("../controllers/messageController");

// Inbox
router.get(
  "/",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate(validationSchemas.dashboardQuery),
  getMessages
);

router.get(
  "/users",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  getMessageUsers
);

// Mark message as read
router.put(
  "/:id/read",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate(validationSchemas.messageIdParam),
  markMessageAsRead
);

// Send message
router.post(
  "/",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate(validationSchemas.messagePayload),
  sendMessage
);

module.exports = router;
