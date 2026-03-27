const express = require("express");
const { loginUser, getCurrentUser } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { validate, validationSchemas } = require("../middleware/validationMiddleware");

const router = express.Router();

router.post("/login", validate(validationSchemas.login), loginUser);
router.get("/me", protect, getCurrentUser);

module.exports = router;
