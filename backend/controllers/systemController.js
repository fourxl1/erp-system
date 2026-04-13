const systemService = require("../services/systemService");
const { asyncHandler, sendSuccess } = require("../utils/http");

const getLocations = asyncHandler(async (req, res) => {
  const locations = await systemService.listLocations(req.user);
  return sendSuccess(res, locations);
});

const createLocation = asyncHandler(async (req, res) => {
  const location = await systemService.createLocation(req.body, req.user);
  return sendSuccess(res, { location }, { statusCode: 201, message: "Location created successfully" });
});

const updateLocation = asyncHandler(async (req, res) => {
  const location = await systemService.updateLocation(req.params.id, req.body, req.user);
  return sendSuccess(res, { location }, { message: "Location updated successfully" });
});

const getSections = asyncHandler(async (req, res) => {
  const sections = await systemService.listSections(req.query.location_id, req.user);
  return sendSuccess(res, sections);
});

const createSection = asyncHandler(async (req, res) => {
  const section = await systemService.createSection(req.body, req.user);
  return sendSuccess(res, { section }, { statusCode: 201, message: "Section created successfully" });
});

const updateSection = asyncHandler(async (req, res) => {
  const section = await systemService.updateSection(req.params.id, req.body, req.user);
  return sendSuccess(res, { section }, { message: "Section updated successfully" });
});

const getAssets = asyncHandler(async (req, res) => {
  const assets = await systemService.listAssets(req.query.location_id, req.user);
  return sendSuccess(res, assets);
});

const createAsset = asyncHandler(async (req, res) => {
  const asset = await systemService.createAsset(req.body, req.user);
  return sendSuccess(res, { asset }, { statusCode: 201, message: "Asset created successfully" });
});

const updateAsset = asyncHandler(async (req, res) => {
  const asset = await systemService.updateAsset(req.params.id, req.body, req.user);
  return sendSuccess(res, { asset }, { message: "Asset updated successfully" });
});

const createInventoryCount = asyncHandler(async (req, res) => {
  const count = await systemService.createInventoryCount(req.body, req.user);
  return sendSuccess(res, { count }, { statusCode: 201, message: "Inventory count created successfully" });
});

const getInventoryCounts = asyncHandler(async (req, res) => {
  const counts = await systemService.listInventoryCounts(req.query.location_id, req.user);
  return sendSuccess(res, counts);
});

const postInventoryCount = asyncHandler(async (req, res) => {
  const count = await systemService.postInventoryCount(req.params.id, req.user);
  return sendSuccess(res, { count }, { message: "Inventory count posted successfully" });
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const logs = await systemService.listAuditLogs(
    {
      entityType: req.query.entity_type,
      userId: req.query.user_id,
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(res, logs);
});

const getCategories = asyncHandler(async (req, res) => {
  const categories = await systemService.listCategories();
  return sendSuccess(res, categories);
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await systemService.createCategory(req.body, req.user);
  return sendSuccess(res, { category }, { statusCode: 201, message: "Category created successfully" });
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await systemService.updateCategory(req.params.id, req.body, req.user);
  return sendSuccess(res, { category }, { message: "Category updated successfully" });
});

const getUnits = asyncHandler(async (req, res) => {
  const units = await systemService.listUnits();
  return sendSuccess(res, units);
});

const createUnit = asyncHandler(async (req, res) => {
  const unit = await systemService.createUnit(req.body, req.user);
  return sendSuccess(res, { unit }, { statusCode: 201, message: "Unit created successfully" });
});

const updateUnit = asyncHandler(async (req, res) => {
  const unit = await systemService.updateUnit(req.params.id, req.body, req.user);
  return sendSuccess(res, { unit }, { message: "Unit updated successfully" });
});

const getSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await systemService.listSuppliers(req.user, req.query.location_id);
  return sendSuccess(res, suppliers);
});

const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await systemService.createSupplier(req.body, req.user);
  return sendSuccess(res, { supplier }, { statusCode: 201, message: "Supplier created successfully" });
});

const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await systemService.updateSupplier(req.params.id, req.body, req.user);
  return sendSuccess(res, { supplier }, { message: "Supplier updated successfully" });
});

const getUsers = asyncHandler(async (req, res) => {
  const users = await systemService.listUsers(req.user);
  return sendSuccess(res, users);
});

const createUser = asyncHandler(async (req, res) => {
  const user = await systemService.createUser(req.body, req.user);
  return sendSuccess(res, { user }, { statusCode: 201, message: "User created successfully" });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await systemService.updateUser(req.params.id, req.body, req.user);
  return sendSuccess(res, { user }, { message: "User updated successfully" });
});

const getRecipients = asyncHandler(async (req, res) => {
  const recipients = await systemService.listRecipients(req.query.location_id, req.user);
  return sendSuccess(res, recipients);
});

const createRecipient = asyncHandler(async (req, res) => {
  const recipient = await systemService.createRecipient(req.body, req.user);
  return sendSuccess(res, { recipient }, { statusCode: 201, message: "Recipient created successfully" });
});

const updateRecipient = asyncHandler(async (req, res) => {
  const recipient = await systemService.updateRecipient(req.params.id, req.body, req.user);
  return sendSuccess(res, { recipient }, { message: "Recipient updated successfully" });
});

const deleteMasterDataController = asyncHandler(async (req, res) => {
  const { table, id } = req.params;
  await systemService.deleteMasterData(table, id, req.user);
  return sendSuccess(res, null, { message: "Entity deleted successfully" });
});

module.exports = {
  getLocations,
  createLocation,
  updateLocation,
  getSections,
  createSection,
  updateSection,
  getAssets,
  createAsset,
  updateAsset,
  createInventoryCount,
  getInventoryCounts,
  postInventoryCount,
  getAuditLogs,
  getCategories,
  createCategory,
  updateCategory,
  getUnits,
  createUnit,
  updateUnit,
  getSuppliers,
  createSupplier,
  updateSupplier,
  getUsers,
  createUser,
  updateUser,
  getRecipients,
  createRecipient,
  updateRecipient,
  deleteMasterDataController
};
