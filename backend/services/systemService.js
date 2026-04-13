const bcrypt = require("bcryptjs");
const { query, withTransaction } = require("../config/db");
const systemModel = require("../models/systemModel");
const movementService = require("./movementService");
const {
  isStaff,
  isAdmin,
  isSuperAdmin,
  resolveWriteLocation,
  resolveReadLocation
} = require("../utils/locationContext");

function buildError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isLocationBoundUser(user) {
  return isStaff(user) && user.location_id;
}

function assertAdminScope(user, locationId) {
  if (isStaff(user) && user.location_id && Number(user.location_id) !== Number(locationId)) {
    throw buildError("Users can only manage their assigned store", 403);
  }

  if (isAdmin(user) && locationId) {
    const activeLocationId = resolveWriteLocation(user, null, { requireLocation: false });

    if (!activeLocationId) {
      throw buildError("Active location context is required for Admin operations", 403);
    }

    if (Number(activeLocationId) !== Number(locationId)) {
      throw buildError("Admin operations are restricted to the active location context", 403);
    }
  }

  if (isSuperAdmin(user) && locationId) {
    const activeLocationId = resolveWriteLocation(user, null, { requireLocation: false });

    if (!activeLocationId) {
      throw buildError("Active location context is required for SuperAdmin operations", 403);
    }

    if (Number(activeLocationId) !== Number(locationId)) {
      throw buildError("SuperAdmin operations are restricted to the active location context", 403);
    }
  }
}

function normalizeRecipientPayload(payload = {}) {
  const name = String(payload.name || payload.full_name || "").trim();
  const department =
    payload.department === undefined || payload.department === null || String(payload.department).trim() === ""
      ? null
      : String(payload.department).trim();

  return {
    name,
    department
  };
}

function toRecipientResponse(recipient) {
  return {
    ...recipient,
    full_name: recipient.name,
    location: recipient.department,
    email: null,
    is_active: true
  };
}

function normalizeRoleName(roleName) {
  return String(roleName || "").trim().toLowerCase();
}

function normalizeUserPayload(payload = {}) {
  return {
    full_name: String(payload.full_name || "").trim(),
    email: String(payload.email || "").trim().toLowerCase(),
    password: payload.password ? String(payload.password) : null,
    role_name:
      payload.role_name === undefined && payload.role === undefined
        ? null
        : String(payload.role_name || payload.role || "").trim() || null,
    location_id:
      payload.location_id === undefined
        ? undefined
        : payload.location_id === null || payload.location_id === ""
          ? null
        : Number(payload.location_id),
    is_active: typeof payload.is_active === "boolean" ? payload.is_active : undefined
  };
}

function assertUserManagementScope(actor, targetRoleName, locationId, existingUser = null) {
  if (actor.role_code !== "ADMIN") {
    return;
  }

  const activeLocationId = resolveWriteLocation(actor, null, { requireLocation: true });

  if (!activeLocationId) {
    throw buildError("Active location context is required for Admin user management", 403);
  }

  if (normalizeRoleName(targetRoleName) !== "staff") {
    throw buildError("Admins can only manage Staff users", 403);
  }

  if (existingUser && normalizeRoleName(existingUser.role_name) !== "staff") {
    throw buildError("Admins can only manage Staff users", 403);
  }

  if (
    existingUser &&
    existingUser.location_id &&
    Number(existingUser.location_id) !== Number(activeLocationId)
  ) {
    throw buildError("Admins can only manage users in their active location context", 403);
  }

  if (locationId && Number(locationId) !== Number(activeLocationId)) {
    throw buildError("Admins can only manage users in their active location context", 403);
  }
}

function assertUserLocationRequirement(roleName, locationId) {
  if (normalizeRoleName(roleName) !== "superadmin" && !locationId) {
    throw buildError("Active location context is required for Admin and Staff users");
  }
}

async function listLocations(user) {
  const locations = await systemModel.listLocations();
  const visibleLocations =
    isLocationBoundUser(user)
      ? locations.filter((location) => Number(location.id) === Number(user.location_id))
      : locations;

  return Promise.all(
    visibleLocations.map(async (location) => ({
      ...location,
      sections: await systemModel.listSections(location.id)
    }))
  );
}

async function createLocation(payload, user) {
  const location = await systemModel.createLocation(payload);
  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "LOCATION_CREATED",
      entity_type: "locations",
      entity_id: location.id,
      details: {
        location_id: location.id,
        name: location.name,
        code: location.code
      }
    }
  );
  return location;
}

async function updateLocation(id, payload, user) {
  const location = await systemModel.updateLocation(id, payload);

  if (!location) {
    throw buildError("Location not found", 404);
  }

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "LOCATION_UPDATED",
      entity_type: "locations",
      entity_id: location.id,
      details: {
        location_id: location.id,
        name: location.name,
        code: location.code,
        is_active: location.is_active
      }
    }
  );

  return location;
}

async function listSections(locationId, user) {
  const scopedLocationId = resolveReadLocation(user, locationId);
  return systemModel.listSections(scopedLocationId);
}

async function createSection(payload, user) {
  const locationId = resolveWriteLocation(user, null, { requireLocation: true });
  assertAdminScope(user, locationId);
  const section = await systemModel.createSection({ ...payload, location_id: locationId });
  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "SECTION_CREATED",
      entity_type: "store_sections",
      entity_id: section.id,
      details: {
        location_id: section.location_id,
        name: section.name
      }
    }
  );
  return section;
}

async function updateSection(id, payload, user) {
  const locationId = resolveWriteLocation(user, null, { requireLocation: true });
  const existingSection = await systemModel.getSectionById(id);

  if (!existingSection) {
    throw buildError("Section not found", 404);
  }

  assertAdminScope(user, existingSection.location_id);
  const section = await systemModel.updateSection(id, { ...payload, location_id: locationId });

  if (!section) {
    throw buildError("Section not found", 404);
  }

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "SECTION_UPDATED",
      entity_type: "store_sections",
      entity_id: section.id,
      details: {
        location_id: section.location_id,
        name: section.name
      }
    }
  );

  return section;
}

async function listAssets(locationId, user) {
  const scopedLocationId = resolveReadLocation(user, locationId);
  return systemModel.listAssets(scopedLocationId);
}

async function createAsset(payload, user) {
  const locationId = resolveWriteLocation(user, null, { requireLocation: true });
  assertAdminScope(user, locationId);
  const asset = await systemModel.createAsset({ ...payload, location_id: locationId });
  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "ASSET_CREATED",
      entity_type: "assets",
      entity_id: asset.id,
      details: {
        location_id: asset.location_id,
        asset_code: asset.asset_code,
        name: asset.name
      }
    }
  );
  return asset;
}

async function updateAsset(id, payload, user) {
  const locationId = resolveWriteLocation(user, null, { requireLocation: true });
  const existingAsset = await systemModel.getAssetById(id);

  if (!existingAsset) {
    throw buildError("Asset not found", 404);
  }

  assertAdminScope(user, existingAsset.location_id);
  const asset = await systemModel.updateAsset(id, { ...payload, location_id: locationId });

  if (!asset) {
    throw buildError("Asset not found", 404);
  }

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "ASSET_UPDATED",
      entity_type: "assets",
      entity_id: asset.id,
      details: {
        location_id: asset.location_id,
        asset_code: asset.asset_code,
        name: asset.name
      }
    }
  );

  return asset;
}

async function createInventoryCount(payload, user) {
  const locationId = resolveWriteLocation(user, null, { requireLocation: true });
  assertAdminScope(user, locationId);

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw buildError("items must contain at least one count line");
  }

  return withTransaction(async (client) => {
    const count = await systemModel.createCountHeader(client, {
      location_id: locationId,
      section_id: payload.section_id || null,
      counted_by: user.id,
      count_date: payload.count_date || null,
      notes: payload.notes || null
    });

    const items = [];

    for (const entry of payload.items) {
      const systemQuantity = await systemModel.getCurrentBalance(entry.item_id, locationId);
      items.push(
        await systemModel.addCountItem(client, {
          count_id: count.id,
          item_id: entry.item_id,
          system_quantity: systemQuantity,
          counted_quantity: entry.counted_quantity
        })
      );
    }

    await systemModel.insertAuditLog(client, {
      user_id: user.id,
      action: "COUNT_CREATED",
      entity_type: "inventory_counts",
      entity_id: count.id,
      details: {
        location_id: locationId,
        section_id: payload.section_id || null,
        items: payload.items.length
      }
    });

    return {
      ...count,
      items
    };
  });
}

async function listInventoryCounts(locationId, user) {
  const scopedLocationId = resolveReadLocation(user, locationId);

  const counts = await systemModel.listCounts(scopedLocationId);

  return Promise.all(
    counts.map(async (count) => ({
      ...count,
      items: await systemModel.getCountItems(count.id)
    }))
  );
}

async function postInventoryCount(countId, user) {
  const count = await systemModel.getCountById(countId);

  if (!count) {
    throw buildError("Inventory count not found", 404);
  }

  assertAdminScope(user, count.location_id);

  if (count.status !== "DRAFT") {
    throw buildError("Only draft counts can be posted");
  }

  const items = await systemModel.getCountItems(countId);

  return withTransaction(async (client) => {
    for (const item of items) {
      const varianceQuantity = Number(item.variance_quantity);

      if (varianceQuantity === 0) {
        continue;
      }

      await movementService.recordMovementInTransaction(
        client,
        {
          item_id: item.item_id,
          location_id: count.location_id,
          movement_type: "ADJUSTMENT",
          quantity: Math.abs(varianceQuantity),
          unit_cost: null,
          reference: `COUNT-${count.id}`,
          adjustment_direction: varianceQuantity < 0 ? "DECREASE" : "INCREASE"
        },
        user
      );
    }

    const posted = await systemModel.updateCountStatus(client, count.id, "POSTED");
    await systemModel.insertAuditLog(client, {
      user_id: user.id,
      action: "COUNT_POSTED",
      entity_type: "inventory_counts",
      entity_id: count.id,
      details: {
        location_id: count.location_id
      }
    });
    return posted;
  });
}

async function listAlerts(user, locationId) {
  const scopedLocationId = resolveReadLocation(user, locationId);
  return systemModel.listAlerts(scopedLocationId);
}

async function markAlertAsRead(id, user) {
  const alert = await systemModel.markAlertAsRead(id, user.role_code === "SUPERADMIN" ? null : user.id);

  if (!alert) {
    throw buildError("Alert not found", 404);
  }

  return alert;
}

async function listAuditLogs(filters, user) {
  if (user.role_code !== "SUPERADMIN" && user.role_code !== "ADMIN") {
    throw buildError("Access denied", 403);
  }

  const scopedFilters =
    user.role_code === "ADMIN"
      ? {
          ...filters,
          locationId: resolveReadLocation(user, filters.locationId)
        }
      : filters;

  return systemModel.listAuditLogs(scopedFilters);
}

async function listCategories() {
  return systemModel.listCategories();
}

async function createCategory(payload, user) {
  const category = await systemModel.createCategory(payload);
  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "CATEGORY_CREATED",
      entity_type: "categories",
      entity_id: category.id,
      details: {
        name: category.name
      }
    }
  );
  return category;
}

async function updateCategory(id, payload, user) {
  const category = await systemModel.updateCategory(id, payload);

  if (!category) {
    throw buildError("Category not found", 404);
  }

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "CATEGORY_UPDATED",
      entity_type: "categories",
      entity_id: category.id,
      details: {
        name: category.name
      }
    }
  );

  return category;
}

async function listUnits() {
  return systemModel.listUnits();
}

async function createUnit(payload, user) {
  const unit = await systemModel.createUnit(payload);
  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "UNIT_CREATED",
      entity_type: "units",
      entity_id: unit.id,
      details: {
        name: unit.name
      }
    }
  );
  return unit;
}

async function updateUnit(id, payload, user) {
  const unit = await systemModel.updateUnit(id, payload);

  if (!unit) {
    throw buildError("Unit not found", 404);
  }

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "UNIT_UPDATED",
      entity_type: "units",
      entity_id: unit.id,
      details: {
        name: unit.name
      }
    }
  );

  return unit;
}

async function listSuppliers(user, locationId = null) {
  const scopedLocationId = resolveReadLocation(user, locationId);
  return systemModel.listSuppliers(scopedLocationId);
}

async function createSupplier(payload, user) {
  const locationId = resolveWriteLocation(user, null, { requireLocation: true });
  const supplier = await systemModel.createSupplier({
    ...payload,
    location_id: locationId
  });
  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "SUPPLIER_CREATED",
      entity_type: "suppliers",
      entity_id: supplier.id,
      details: {
        name: supplier.name,
        location_id: supplier.location_id
      }
    }
  );
  return supplier;
}

async function updateSupplier(id, payload, user) {
  const locationId = resolveWriteLocation(user, null, { requireLocation: true });
  const existingSupplier = await systemModel.getSupplierById(id);

  if (!existingSupplier) {
    throw buildError("Supplier not found", 404);
  }

  assertAdminScope(user, existingSupplier.location_id);

  const supplier = await systemModel.updateSupplier(id, {
    ...payload,
    location_id: locationId
  });

  if (!supplier) {
    throw buildError("Supplier not found", 404);
  }

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "SUPPLIER_UPDATED",
      entity_type: "suppliers",
      entity_id: supplier.id,
      details: {
        name: supplier.name,
        location_id: supplier.location_id
      }
    }
  );

  return supplier;
}

async function listUsers(user) {
  const locationId =
    user.role_code === "ADMIN" || user.role_code === "SUPERADMIN"
      ? resolveReadLocation(user, null)
      : null;

  if (user.role_code === "ADMIN" && !locationId) {
    throw buildError("Active location context is required for Admin user management", 403);
  }

  const users = await systemModel.listUsers(locationId || null);

  if (user.role_code === "ADMIN") {
    return users.filter((entry) => normalizeRoleName(entry.role_name) === "staff");
  }

  return users;
}

async function createUser(payload, user) {
  const userPayload = normalizeUserPayload(payload);

  if (!userPayload.full_name || !userPayload.email || !userPayload.password) {
    throw buildError("full_name, email, and password are required for users");
  }

  const resolvedRoleName = userPayload.role_name || "Staff";
  const contextLocationId = resolveWriteLocation(user, null, { requireLocation: false });
  const resolvedLocationId =
    normalizeRoleName(resolvedRoleName) === "superadmin"
      ? null
      : contextLocationId;
  assertUserLocationRequirement(resolvedRoleName, resolvedLocationId);
  assertUserManagementScope(user, resolvedRoleName, resolvedLocationId);

  const roleId = await systemModel.getRoleIdByName(resolvedRoleName);

  if (!roleId) {
    throw buildError("The requested role does not exist", 400);
  }

  const hashedPassword = await bcrypt.hash(userPayload.password, 10);
  const createdUser = await systemModel.createUser({
    role_id: roleId,
    full_name: userPayload.full_name,
    email: userPayload.email,
    password: hashedPassword,
    location_id: resolvedLocationId,
    is_active: userPayload.is_active
  });

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "USER_CREATED",
      entity_type: "users",
      entity_id: createdUser.id,
      details: {
        email: createdUser.email,
        role_name: resolvedRoleName,
        location_id: resolvedLocationId
      }
    }
  );

  return {
    ...createdUser,
    role_name: resolvedRoleName
  };
}

async function updateUser(id, payload, user) {
  const existingUser = await systemModel.getUserById(id);

  if (!existingUser) {
    throw buildError("User not found", 404);
  }

  const userPayload = normalizeUserPayload(payload);

  if (!userPayload.full_name || !userPayload.email) {
    throw buildError("full_name and email are required for users");
  }

  const resolvedRoleName = userPayload.role_name || existingUser.role_name;
  const contextLocationId = resolveWriteLocation(user, null, { requireLocation: false });
  const resolvedLocationId =
    normalizeRoleName(resolvedRoleName) === "superadmin"
      ? null
      : contextLocationId;

  assertUserLocationRequirement(resolvedRoleName, resolvedLocationId);
  assertUserManagementScope(user, resolvedRoleName, resolvedLocationId, existingUser);

  const roleId = await systemModel.getRoleIdByName(resolvedRoleName);

  if (!roleId) {
    throw buildError("The requested role does not exist", 400);
  }

  const updatedUser = await systemModel.updateUser(id, {
    role_id: roleId,
    full_name: userPayload.full_name,
    email: userPayload.email,
    location_id: resolvedLocationId,
    is_active: userPayload.is_active
  });

  if (!updatedUser) {
    throw buildError("User not found", 404);
  }

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "USER_UPDATED",
      entity_type: "users",
      entity_id: updatedUser.id,
      details: {
        email: updatedUser.email,
        role_name: resolvedRoleName,
        location_id: resolvedLocationId,
        is_active: updatedUser.is_active
      }
    }
  );

  return {
    ...updatedUser,
    role_name: resolvedRoleName
  };
}

async function listRecipients(locationId, user) {
  const scopedLocationId = resolveReadLocation(user, locationId);
  return (await systemModel.listRecipients(scopedLocationId)).map(toRecipientResponse);
}

async function createRecipient(payload, user) {
  const recipientPayload = normalizeRecipientPayload(payload);

  if (!recipientPayload.name) {
    throw buildError("name is required for recipients");
  }

  const locationId = resolveWriteLocation(user, null, { requireLocation: true });
  const recipient = await systemModel.createRecipient({
    ...recipientPayload,
    location_id: locationId
  });

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "RECIPIENT_CREATED",
      entity_type: "recipients",
      entity_id: recipient.id,
      details: {
        name: recipient.name,
        department: recipient.department,
        location_id: recipient.location_id
      }
    }
  );

  return toRecipientResponse(recipient);
}

async function updateRecipient(id, payload, user) {
  const recipientPayload = normalizeRecipientPayload(payload);

  if (!recipientPayload.name) {
    throw buildError("name is required for recipients");
  }

  const locationId = resolveWriteLocation(user, null, { requireLocation: true });
  const existingRecipient = await systemModel.getRecipientById(id);

  if (!existingRecipient) {
    throw buildError("Recipient not found", 404);
  }

  assertAdminScope(user, existingRecipient.location_id);

  const recipient = await systemModel.updateRecipient(id, {
    ...recipientPayload,
    location_id: locationId
  });

  if (!recipient) {
    throw buildError("Recipient not found", 404);
  }

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: "RECIPIENT_UPDATED",
      entity_type: "recipients",
      entity_id: recipient.id,
      details: {
        name: recipient.name,
        department: recipient.department,
        location_id: recipient.location_id
      }
    }
  );

  return toRecipientResponse(recipient);
}

async function deleteMasterData(table, id, user) {
  const entityMap = {
    locations: "LOCATION",
    store_sections: "SECTION",
    assets: "ASSET",
    categories: "CATEGORY",
    units: "UNIT",
    suppliers: "SUPPLIER",
    recipients: "RECIPIENT",
    users: "USER"
  };

  const actionPrefix = entityMap[table] || "ENTITY";

  if (table === "locations" && user.role_code !== "SUPERADMIN") {
    throw buildError("Only SuperAdmin can delete locations", 403);
  }

  if (table === "store_sections" && (user.role_code === "ADMIN" || user.role_code === "SUPERADMIN")) {
    const section = await systemModel.getSectionById(id);

    if (!section) {
      throw buildError("SECTION not found", 404);
    }

    assertAdminScope(user, section.location_id);
  }

  if (table === "assets" && (user.role_code === "ADMIN" || user.role_code === "SUPERADMIN")) {
    const asset = await systemModel.getAssetById(id);

    if (!asset) {
      throw buildError("ASSET not found", 404);
    }

    assertAdminScope(user, asset.location_id);
  }

  if (table === "suppliers" && (user.role_code === "ADMIN" || user.role_code === "SUPERADMIN")) {
    const supplier = await systemModel.getSupplierById(id);

    if (!supplier) {
      throw buildError("SUPPLIER not found", 404);
    }

    assertAdminScope(user, supplier.location_id);
  }

  if (table === "recipients") {
    const existingRecipient = await systemModel.getRecipientById(id);

    if (!existingRecipient) {
      throw buildError("Recipient not found", 404);
    }

    if (user.role_code === "ADMIN" || user.role_code === "SUPERADMIN") {
      assertAdminScope(user, existingRecipient.location_id);
    }

    const recipient = await systemModel.deleteEntity("recipients", id);

    if (!recipient) {
      throw buildError("Recipient not found", 404);
    }

    await systemModel.insertAuditLog(
      { query },
      {
        user_id: user.id,
        action: "RECIPIENT_DELETED",
        entity_type: "recipients",
        entity_id: id,
        details: {
          name: recipient.name,
          department: recipient.department
        }
      }
    );

    return recipient;
  }

  if (table === "users") {
    const existingUser = await systemModel.getUserById(id);

    if (!existingUser) {
      throw buildError("User not found", 404);
    }

    if (Number(existingUser.id) === Number(user.id)) {
      throw buildError("Users cannot deactivate their own account", 400);
    }

    assertUserManagementScope(user, existingUser.role_name, existingUser.location_id, existingUser);

    const managedUser = await systemModel.deactivateUser(id);

    if (!managedUser) {
      throw buildError("User not found", 404);
    }

    await systemModel.insertAuditLog(
      { query },
      {
        user_id: user.id,
        action: "USER_DEACTIVATED",
        entity_type: "users",
        entity_id: id,
        details: {
          email: managedUser.email,
          full_name: managedUser.full_name
        }
      }
    );

    return managedUser;
  }

  if (!entityMap[table]) {
    throw buildError("Unsupported master data table", 400);
  }

  const deleted = await systemModel.deleteEntity(table, id);

  if (!deleted) {
    throw buildError(`${actionPrefix} not found`, 404);
  }

  await systemModel.insertAuditLog(
    { query },
    {
      user_id: user.id,
      action: `${actionPrefix}_DELETED`,
      entity_type: table,
      entity_id: id,
      details: { name: deleted.name || deleted.full_name || deleted.asset_code }
    }
  );

  return deleted;
}

module.exports = {
  listLocations,
  createLocation,
  updateLocation,
  listSections,
  createSection,
  updateSection,
  listAssets,
  createAsset,
  updateAsset,
  createInventoryCount,
  listInventoryCounts,
  postInventoryCount,
  listAlerts,
  markAlertAsRead,
  listAuditLogs,
  listCategories,
  createCategory,
  updateCategory,
  listUnits,
  createUnit,
  updateUnit,
  listSuppliers,
  createSupplier,
  updateSupplier,
  listUsers,
  createUser,
  updateUser,
  listRecipients,
  createRecipient,
  updateRecipient,
  deleteMasterData
};
