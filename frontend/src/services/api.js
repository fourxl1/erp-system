const configuredApiUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
export const API_BASE_URL = configuredApiUrl
  ? (configuredApiUrl.endsWith("/api") ? configuredApiUrl : `${configuredApiUrl}/api`)
  : "/api";
export const API_ORIGIN = configuredApiUrl.replace(/\/api$/i, "");

export function resolveApiUrl(path) {
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) return path;

  return API_ORIGIN
    ? `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`
    : (path.startsWith("/") ? path : `/${path}`);
}

function getToken() {
  return localStorage.getItem("token");
}

function buildAuthHeaders(extraHeaders = {}) {
  const token = getToken();
  const headers = { ...extraHeaders };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
    const activeLocationId = getActiveLocationId();

    if (activeLocationId) {
      headers["X-Active-Location-Id"] = activeLocationId;
    }
  }

  return headers;
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("inventory-user");
  localStorage.removeItem("inventory-user-data");
  localStorage.removeItem("inventory-active-location-id");
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });

  return search.size ? `?${search.toString()}` : "";
}

function unwrapResponse(payload) {
  if (payload && typeof payload === "object" && payload.success === true && "data" in payload) {
    return payload.data;
  }

  return payload;
}

function getActiveLocationId() {
  const raw = localStorage.getItem("inventory-active-location-id");

  if (raw && /^\d+$/.test(String(raw))) {
    return String(raw);
  }

  try {
    const user = JSON.parse(localStorage.getItem("inventory-user-data") || "{}");
    if (user?.location_id && /^\d+$/.test(String(user.location_id))) {
      return String(user.location_id);
    }
  } catch {
    return "";
  }

  return "";
}

function buildNetworkError(error) {
  if (error instanceof Error && error.name === "TypeError") {
    return new Error(`Unable to reach the API at ${API_BASE_URL}. Check backend availability and CORS.`);
  }

  return error;
}

async function request(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...buildAuthHeaders(options.headers)
  };

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw buildNetworkError(error);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
      window.location.replace("/login");
    }

    throw new Error(data?.message || "Request failed");
  }

  return unwrapResponse(data);
}

async function downloadFile(path, fallbackName) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: buildAuthHeaders()
    });
  } catch (error) {
    throw buildNetworkError(error);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "Download failed");
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const disposition = response.headers.get("Content-Disposition") || "";
  const matchedName = /filename="?([^"]+)"?/i.exec(disposition)?.[1];

  link.href = objectUrl;
  link.download = matchedName || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export const loginUser = (data) =>
  request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchCurrentUser = () => request("/auth/me");

export const fetchItems = (params = {}) => request(`/items${buildQuery(params)}`);
export const fetchAvailableInventory = (params = {}) => request(`/items/availability${buildQuery(params)}`);
export const fetchInventoryStats = () => request("/items/stats");
export const fetchUploadedItemImages = () => request("/items/uploaded-images");
export const createItem = (data) => request("/items", { method: "POST", body: data });
export const updateItem = (id, data) => request(`/items/${id}`, { method: "PUT", body: data });
export const deleteItem = (id) => request(`/items/${id}`, { method: "DELETE" });

export const createStockMovement = (data) =>
  request("/stock-movements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const updateStockMovement = (id, data) =>
  request(`/stock-movements/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const deleteStockMovement = (id) =>
  request(`/stock-movements/${id}`, {
    method: "DELETE"
  });

export const confirmTransfer = (id) =>
  request(`/stock-movements/${id}/confirm`, {
    method: "PUT"
  });

export const rejectTransfer = (id, data = {}) =>
  request(`/stock-movements/${id}/reject`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchDailyMovements = (params = {}) =>
  request(`/movements/daily${buildQuery(params)}`);

export const fetchRequests = (params = {}) =>
  request(`/requests${buildQuery(params)}`);

export const fetchRequestLocations = () => request("/requests/locations");

export const createRequest = (data) =>
  request("/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const approveRequest = (id, data = {}) =>
  request(`/requests/${id}/approve`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const rejectRequest = (id, data = {}) =>
  request(`/requests/${id}/reject`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchAlerts = () => request("/alerts");
export const markAlertAsRead = (id) =>
  request(`/alerts/${id}/read`, { method: "PUT" });

export const fetchNotifications = (params = {}) =>
  request(`/notifications${buildQuery(params)}`);

export const markNotificationAsRead = (id) =>
  request(`/notifications/${id}/read`, { method: "PUT" });

export const setNotificationReadState = (id, isRead) =>
  request(`/notifications/${id}/read-state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_read: Boolean(isRead) })
  });

export const markAllNotificationsAsRead = (type = "") =>
  request("/notifications/read-all", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(type ? { type } : {})
  });

export const fetchMessageUsers = () => request("/messages/users");
export const fetchMessages = () => request("/messages");
export const sendMessage = (data) =>
  request("/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const markMessageAsRead = (id) =>
  request(`/messages/${id}/read`, { method: "PUT" });

export const fetchLocations = () => request("/system/locations");
export const createLocation = (data) =>
  request("/system/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const updateLocation = (id, data) =>
  request(`/system/locations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchCategories = () => request("/system/categories");
export const createCategory = (data) =>
  request("/system/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const updateCategory = (id, data) =>
  request(`/system/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchSuppliers = () => request("/system/suppliers");
export const createSupplier = (data) =>
  request("/system/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const updateSupplier = (id, data) =>
  request(`/system/suppliers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchRecipients = (params = {}) =>
  request(`/system/recipients${buildQuery(params)}`);

export const createRecipient = (data) =>
  request("/system/recipients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const updateRecipient = (id, data) =>
  request(`/system/recipients/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchUnits = () => request("/system/units");
export const createUnit = (data) =>
  request("/system/units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const updateUnit = (id, data) =>
  request(`/system/units/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchUsers = () => request("/system/users");
export const createUser = (data) =>
  request("/system/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const updateUser = (id, data) =>
  request(`/system/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchSections = () => request("/system/sections");

export const createSection = (data) =>
  request("/system/sections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const updateSection = (id, data) =>
  request(`/system/sections/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchAssets = () => request("/system/assets");

export const createAsset = (data) =>
  request("/system/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const updateAsset = (id, data) =>
  request(`/system/assets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const deleteMasterData = (table, id) =>
  request(`/system/${table}/${id}`, { method: "DELETE" });

export const createMaintenanceLog = (data) =>
  request("/maintenance/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const fetchMaintenanceHistory = (params = {}) =>
  request(`/maintenance/history${buildQuery(params)}`);

export const fetchMaintenanceItems = (id) =>
  request(`/maintenance/${id}/items`);

export const updateMaintenanceLog = (id, data) =>
  request(`/maintenance/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const deleteMaintenanceLog = (id) =>
  request(`/maintenance/${id}`, {
    method: "DELETE"
  });

export const createInventoryCount = (data) =>
  request("/system/counts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const postInventoryCount = (id) =>
  request(`/system/counts/${id}/post`, { method: "POST" });

export const fetchMovementReport = (params = {}) =>
  request(`/reports/movements${buildQuery(params)}`);

export const fetchInventoryValueReport = (params = {}) =>
  request(`/reports/inventory-value${buildQuery(params)}`);

export const fetchCurrentStockReport = (params = {}) =>
  request(`/reports/current-stock${buildQuery(params)}`);

export const downloadInventoryValueReportPdf = (params = {}) =>
  downloadFile(`/reports/inventory-value/pdf${buildQuery(params)}`, "inventory-valuation-report.pdf");

export const downloadInventoryValueReportCsv = (params = {}) =>
  downloadFile(`/reports/inventory-value/csv${buildQuery(params)}`, "inventory-valuation-report.csv");

export const downloadInventoryValueReportExcel = (params = {}) =>
  downloadFile(`/reports/inventory-value/excel${buildQuery(params)}`, "inventory-valuation-report.xlsx");

export const downloadMovementReportPdf = (params = {}) =>
  downloadFile(`/reports/movements/pdf${buildQuery(params)}`, "item-movement-report.pdf");

export const downloadMovementReportCsv = (params = {}) =>
  downloadFile(`/reports/movements/csv${buildQuery(params)}`, "item-movement-report.csv");

export const downloadMovementReportExcel = (params = {}) =>
  downloadFile(`/reports/movements/excel${buildQuery(params)}`, "item-movement-report.xlsx");

export const downloadCurrentStockReportPdf = (params = {}) =>
  downloadFile(`/reports/current-stock/pdf${buildQuery(params)}`, "current-stock-report.pdf");

export const downloadCurrentStockReportCsv = (params = {}) =>
  downloadFile(`/reports/current-stock/csv${buildQuery(params)}`, "current-stock-report.csv");

export const downloadCurrentStockReportExcel = (params = {}) =>
  downloadFile(`/reports/current-stock/excel${buildQuery(params)}`, "current-stock-report.xlsx");

export const createIssue = (data) =>
  request("/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
