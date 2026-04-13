function buildError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toInt(value) {
  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

function normalizeRole(roleName) {
  return String(roleName || "").trim().toUpperCase();
}

function isStaff(user) {
  return normalizeRole(user?.role_code || user?.role_name) === "STAFF";
}

function isAdmin(user) {
  return normalizeRole(user?.role_code || user?.role_name) === "ADMIN";
}

function isSuperAdmin(user) {
  return normalizeRole(user?.role_code || user?.role_name) === "SUPERADMIN";
}

function resolveUserActiveLocation(user) {
  return (
    toInt(user?.active_location_id) ||
    toInt(user?.session_location_id) ||
    toInt(user?.location_id) ||
    null
  );
}

function assertStaffLocation(user) {
  const locationId = toInt(user?.location_id);

  if (!locationId) {
    throw buildError("Staff account has no assigned location", 403);
  }

  return locationId;
}

function resolveWriteLocation(user, providedLocationId = null, options = {}) {
  const requestedLocationId = toInt(providedLocationId);
  const requireLocation = options.requireLocation !== false;

  if (isStaff(user)) {
    const locationId = assertStaffLocation(user);

    if (requestedLocationId && requestedLocationId !== locationId) {
      throw buildError("Staff users can only operate in their assigned location", 403);
    }

    return locationId;
  }

  if (isAdmin(user)) {
    const locationId = requestedLocationId || resolveUserActiveLocation(user);

    if (!locationId && requireLocation) {
      throw buildError("Active location context is required for this action", 400);
    }

    return locationId || null;
  }

  if (isSuperAdmin(user)) {
    const locationId = requestedLocationId || resolveUserActiveLocation(user);

    if (!locationId && requireLocation) {
      throw buildError("Active location context is required for this action", 400);
    }

    return locationId || null;
  }

  throw buildError("Unsupported role for location-scoped operation", 403);
}

function resolveReadLocation(user, requestedLocationId = null, options = {}) {
  const locationId = toInt(requestedLocationId);
  const useActiveContextByDefault = options.useActiveContextByDefault !== false;

  if (isStaff(user)) {
    return assertStaffLocation(user);
  }

  if (isAdmin(user) || isSuperAdmin(user)) {
    if (locationId) {
      return locationId;
    }

    if (useActiveContextByDefault) {
      return resolveUserActiveLocation(user);
    }
  }

  return locationId;
}

function isLocationAccessible(user, locationId) {
  const resolvedLocationId = toInt(locationId);

  if (!resolvedLocationId) {
    return true;
  }

  if (isStaff(user)) {
    return resolvedLocationId === assertStaffLocation(user);
  }

  return true;
}

module.exports = {
  buildError,
  toInt,
  normalizeRole,
  isStaff,
  isAdmin,
  isSuperAdmin,
  resolveUserActiveLocation,
  resolveWriteLocation,
  resolveReadLocation,
  isLocationAccessible
};
