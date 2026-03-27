export function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("inventory-user-data") || "{}");
  } catch {
    return {};
  }
}

export function normalizeRoleName(roleName) {
  return String(roleName || "").trim().toLowerCase();
}

export function hasAllowedRole(user, allowedRoles = []) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    return true;
  }

  return allowedRoles.includes(normalizeRoleName(user?.role_name));
}
