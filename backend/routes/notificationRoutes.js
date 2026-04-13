const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { validate } = require("../middleware/validationMiddleware");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

const listSchema = {
  query: [
    { field: "type", type: "string" },
    { field: "is_read", type: "string" },
    { field: "limit", type: "id" },
    { field: "offset", type: "id" }
  ]
};

const idParamSchema = {
  params: [{ field: "id", required: true, type: "id" }]
};

const setReadStateSchema = {
  params: [{ field: "id", required: true, type: "id" }],
  body: [{ field: "is_read", required: true, type: "boolean" }]
};

const markAllSchema = {
  body: [{ field: "type", type: "string" }]
};

router.get(
  "/",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate(listSchema),
  notificationController.listNotifications
);

router.put(
  "/read-all",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate(markAllSchema),
  notificationController.markAllNotificationsAsRead
);

router.put(
  "/:id/read",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate(idParamSchema),
  notificationController.markNotificationAsRead
);

router.put(
  "/:id/read-state",
  protect,
  authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"),
  validate(setReadStateSchema),
  notificationController.setNotificationReadState
);

module.exports = router;
