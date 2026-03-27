const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { validate } = require("../middleware/validationMiddleware");
const systemController = require("../controllers/systemController");

const router = express.Router();

const recipientCreateSchema = {
  body: [
    { field: "name", type: "string", minLength: 2 },
    { field: "full_name", type: "string", minLength: 2 },
    { field: "department", type: "string" },
    { field: "email", type: "email" },
    { field: "password", type: "string", minLength: 6 },
    {
      field: "name",
      custom: (_, body) => {
        if (!body.name && !body.full_name) {
          return "name is required";
        }
        return true;
      }
    }
  ]
};

const recipientUpdateSchema = {
  params: [{ field: "id", required: true, type: "id" }],
  body: [
    { field: "name", type: "string", minLength: 2 },
    { field: "full_name", type: "string", minLength: 2 },
    { field: "department", type: "string" },
    { field: "email", type: "email" },
    {
      field: "name",
      custom: (_, body) => {
        if (!body.name && !body.full_name) {
          return "name is required";
        }
        return true;
      }
    }
  ]
};

router.get("/", protect, authorizeRoles("Staff", "Admin", "SuperAdmin"), systemController.getRecipients);
router.post(
  "/",
  protect,
  authorizeRoles("Admin", "SuperAdmin"),
  validate(recipientCreateSchema),
  systemController.createRecipient
);
router.put(
  "/:id",
  protect,
  authorizeRoles("Admin", "SuperAdmin"),
  validate(recipientUpdateSchema),
  systemController.updateRecipient
);

module.exports = router;
