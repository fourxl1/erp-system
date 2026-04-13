const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { validate } = require("../middleware/validationMiddleware");
const systemController = require("../controllers/systemController");

const router = express.Router();

const simpleIdQuery = { query: [{ field: "location_id", type: "id" }] };
const createLocationSchema = {
  body: [
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "code", type: "string", minLength: 2 },
    { field: "address", type: "string" }
  ]
};
const updateLocationSchema = {
  params: [{ field: "id", required: true, type: "id" }],
  body: [
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "code", type: "string", minLength: 2 },
    { field: "address", type: "string" },
    { field: "is_active", type: "boolean" }
  ]
};
const createSectionSchema = {
  body: [
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "description", type: "string" }
  ]
};
const updateSectionSchema = {
  params: [{ field: "id", required: true, type: "id" }],
  body: [
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "description", type: "string" }
  ]
};
const createAssetSchema = {
  body: [
    { field: "asset_code", required: true, type: "string", minLength: 2 },
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "description", type: "string" }
  ]
};
const createCategorySchema = {
  body: [
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "description", type: "string" }
  ]
};
const updateCategorySchema = {
  params: [{ field: "id", required: true, type: "id" }],
  body: [
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "description", type: "string" }
  ]
};
const createUnitSchema = {
  body: [
    { field: "name", required: true, type: "string", minLength: 1 },
    { field: "description", type: "string" }
  ]
};
const updateUnitSchema = {
  params: [{ field: "id", required: true, type: "id" }],
  body: [
    { field: "name", required: true, type: "string", minLength: 1 },
    { field: "description", type: "string" }
  ]
};
const createSupplierSchema = {
  body: [
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "contact_name", type: "string" },
    { field: "phone", type: "string" },
    { field: "email", type: "email" },
    { field: "notes", type: "string" }
  ]
};
const updateSupplierSchema = {
  params: [{ field: "id", required: true, type: "id" }],
  body: [
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "contact_name", type: "string" },
    { field: "phone", type: "string" },
    { field: "email", type: "email" },
    { field: "notes", type: "string" }
  ]
};
const createUserSchema = {
  body: [
    { field: "full_name", required: true, type: "string", minLength: 2 },
    { field: "email", required: true, type: "email" },
    { field: "password", required: true, type: "string", minLength: 6 },
    { field: "role_name", type: "string", minLength: 5 },
    { field: "is_active", type: "boolean" }
  ]
};
const updateUserSchema = {
  params: [{ field: "id", required: true, type: "id" }],
  body: [
    { field: "full_name", required: true, type: "string", minLength: 2 },
    { field: "email", required: true, type: "email" },
    { field: "role_name", type: "string", minLength: 5 },
    { field: "is_active", type: "boolean" }
  ]
};
const createRecipientSchema = {
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
const updateRecipientSchema = {
  params: [{ field: "id", required: true, type: "id" }],
  body: [
    { field: "name", type: "string", minLength: 2 },
    { field: "full_name", type: "string", minLength: 2 },
    { field: "department", type: "string" },
    { field: "email", type: "email" },
    { field: "is_active", type: "boolean" },
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
const updateAssetSchema = {
  params: [{ field: "id", required: true, type: "id" }],
  body: [
    { field: "asset_code", required: true, type: "string", minLength: 2 },
    { field: "name", required: true, type: "string", minLength: 2 },
    { field: "description", type: "string" }
  ]
};
const createCountSchema = {
  body: [
    { field: "section_id", type: "id" },
    { field: "count_date", type: "string" },
    { field: "notes", type: "string" },
    {
      field: "items",
      required: true,
      type: "array",
      custom: (value) => {
        if (!Array.isArray(value) || value.length === 0) {
          return "items must contain at least one count line";
        }
        for (const entry of value) {
          if (!/^\d+$/.test(String(entry.item_id || "")) || Number(entry.item_id) <= 0) {
            return "each count line must include a valid item_id";
          }
          if (entry.counted_quantity === undefined || entry.counted_quantity === null || String(entry.counted_quantity).trim() === "") {
            return "each count line must include counted_quantity";
          }
          if (Number.isNaN(Number(entry.counted_quantity)) || Number(entry.counted_quantity) < 0) {
            return "each count line counted_quantity must be a non-negative number";
          }
        }
        return true;
      }
    }
  ]
};

router.get("/locations", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), systemController.getLocations);
router.post("/locations", protect, authorizeRoles("SUPERADMIN"), validate(createLocationSchema), systemController.createLocation);
router.put("/locations/:id", protect, authorizeRoles("SUPERADMIN"), validate(updateLocationSchema), systemController.updateLocation);

router.get("/sections", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(simpleIdQuery), systemController.getSections);
router.post("/sections", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(createSectionSchema), systemController.createSection);
router.put("/sections/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(updateSectionSchema), systemController.updateSection);

router.get("/assets", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(simpleIdQuery), systemController.getAssets);
router.post("/assets", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(createAssetSchema), systemController.createAsset);
router.put("/assets/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(updateAssetSchema), systemController.updateAsset);

router.get("/categories", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), systemController.getCategories);
router.post("/categories", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(createCategorySchema), systemController.createCategory);
router.put("/categories/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(updateCategorySchema), systemController.updateCategory);

router.get("/units", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), systemController.getUnits);
router.post("/units", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(createUnitSchema), systemController.createUnit);
router.put("/units/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(updateUnitSchema), systemController.updateUnit);

router.get("/suppliers", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), systemController.getSuppliers);
router.post("/suppliers", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(createSupplierSchema), systemController.createSupplier);
router.put("/suppliers/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(updateSupplierSchema), systemController.updateSupplier);

router.get("/users", protect, authorizeRoles("ADMIN", "SUPERADMIN"), systemController.getUsers);
router.post("/users", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(createUserSchema), systemController.createUser);
router.put("/users/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(updateUserSchema), systemController.updateUser);

router.get("/recipients", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(simpleIdQuery), systemController.getRecipients);
router.post("/recipients", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(createRecipientSchema), systemController.createRecipient);
router.put("/recipients/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(updateRecipientSchema), systemController.updateRecipient);

router.delete("/:table/:id", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate({ params: [{ field: "id", required: true, type: "id" }, { field: "table", required: true, type: "string" }] }), systemController.deleteMasterDataController);

router.get("/counts", protect, authorizeRoles("STAFF", "ADMIN", "SUPERADMIN"), validate(simpleIdQuery), systemController.getInventoryCounts);
router.post("/counts", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate(createCountSchema), systemController.createInventoryCount);
router.post("/counts/:id/post", protect, authorizeRoles("ADMIN", "SUPERADMIN"), validate({ params: [{ field: "id", required: true, type: "id" }] }), systemController.postInventoryCount);

router.get("/audit-logs", protect, authorizeRoles("ADMIN", "SUPERADMIN"), systemController.getAuditLogs);

module.exports = router;
