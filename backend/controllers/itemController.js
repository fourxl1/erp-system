const inventoryService = require("../services/inventoryService");
const { asyncHandler, createHttpError, sendSuccess } = require("../utils/http");
const {
  buildItemImagePath,
  buildItemImageUrl,
  parseItemImageInput
} = require("../utils/itemImage");

function sanitizeImagePath(imagePath) {
  if (imagePath === undefined || imagePath === null || String(imagePath).trim() === "") {
    return null;
  }

  const normalizedPath = parseItemImageInput(imagePath);

  if (!normalizedPath) {
    throw createHttpError(400, "image_path must reference an uploaded item image");
  }

  return normalizedPath;
}

function serializeItem(item, req) {
  const imagePath = buildItemImagePath(item.image_path);
  const imageUrl = buildItemImageUrl(req, item.image_path);

  return {
    ...item,
    image_path: imagePath,
    image_url: imageUrl
  };
}

function normalizeItemPayload(req) {
  return {
    category_id: req.body.category_id || null,
    supplier_id: req.body.supplier_id || null,
    name: req.body.name,
    description: req.body.description || null,
    unit: req.body.unit,
    reorder_level: req.body.reorder_level || req.body.minimum_quantity || 0,
    image_path: req.file ? req.file.filename : sanitizeImagePath(req.body.image_path)
  };
}

const getItems = asyncHandler(async (req, res) => {
  const items = await inventoryService.listItems(
    {
      categoryId: req.query.category_id,
      search: req.query.search,
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(res, {
    count: items.length,
    items: items.map((item) => serializeItem(item, req))
  });
});

const getItem = asyncHandler(async (req, res) => {
  const item = await inventoryService.getItem(req.params.id, req.user, req.query.location_id);

  if (!item) {
    throw createHttpError(404, "Item not found");
  }

  return sendSuccess(res, serializeItem(item, req));
});

const createNewItem = asyncHandler(async (req, res) => {
  const payload = normalizeItemPayload(req);

  if (!payload.name || !payload.unit) {
    throw createHttpError(400, "Name and unit are required");
  }

  const item = await inventoryService.createItem(payload, req.user);

  return sendSuccess(
    res,
    {
      item: serializeItem(item, req)
    },
    {
      statusCode: 201,
      message: "Item created successfully"
    }
  );
});

const updateItemController = asyncHandler(async (req, res) => {
  const payload = normalizeItemPayload(req);

  if (!payload.name || !payload.unit) {
    throw createHttpError(400, "Name and unit are required");
  }

  const item = await inventoryService.updateItem(req.params.id, payload, req.user);

  if (!item) {
    throw createHttpError(404, "Item not found");
  }

  return sendSuccess(res, {
    item: serializeItem(item, req)
  }, {
    message: "Item updated successfully"
  });
});

const deleteItemController = asyncHandler(async (req, res) => {
  const item = await inventoryService.deleteItem(req.params.id, req.user);

  if (!item) {
    throw createHttpError(404, "Item not found");
  }

  return sendSuccess(res, {
    item: serializeItem(item, req)
  }, {
    message: "Item deleted successfully"
  });
});

const getInventoryStats = asyncHandler(async (req, res) => {
  const stats = await inventoryService.getInventoryStats(req.user, req.query.location_id);
  return sendSuccess(res, stats);
});

const getItemStock = asyncHandler(async (req, res) => {
  const balances = await inventoryService.getCurrentStockByLocation(req.params.id, req.user);
  return sendSuccess(res, balances);
});

const getAvailableInventory = asyncHandler(async (req, res) => {
  const snapshot = await inventoryService.getStockSnapshot(
    {
      itemId: req.query.item_id,
      locationId: req.query.location_id
    },
    req.user
  );

  return sendSuccess(
    res,
    Array.isArray(snapshot)
      ? snapshot.map((entry) => ({
          ...entry,
          item_image: buildItemImageUrl(req, entry.item_image)
        }))
      : snapshot
  );
});

module.exports = {
  getItems,
  getItem,
  createNewItem,
  updateItemController,
  deleteItemController,
  getInventoryStats,
  getItemStock,
  getAvailableInventory
};
