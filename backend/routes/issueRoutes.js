const express = require("express");
const router = express.Router();

const { createIssue } = require("../controllers/issueController");
const { protect } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validationMiddleware");

const issueSchema = {
  body: [
    { field: "title", required: true, type: "string", minLength: 3 },
    { field: "description", type: "string", minLength: 3 },
    { field: "message", type: "string", minLength: 3 },
    { field: "related_report", type: "string" },
    {
      field: "description",
      custom: (_, body) => {
        if (!body.description && !body.message) {
          return "description is required";
        }

        return true;
      }
    }
  ]
};

// POST /api/issues
router.post("/", protect, validate(issueSchema), createIssue);

module.exports = router;
