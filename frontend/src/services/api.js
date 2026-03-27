const API_BASE_URL = "http://161.35.213.198:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");
/* ================= IMAGE RESOLVER ================= */
export function resolveApiUrl(path) {
  if (!path) return "";

  // If already full URL
  if (/^https?:\/\//i.test(path)) return path;

  // Attach backend origin
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/* ================= CORE ================= */
function getToken() {
  return localStorage.getItem("token");
}

function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("inventory-user");
  localStorage.removeItem("inventory-user-data");
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      search.set(k, v);
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

function buildNetworkError(error) {
  if (error instanceof Error && error.name === "TypeError") {
    return new Error(`Unable to reach the API at ${API_BASE_URL}. Check backend availability, LAN access, and CORS.`);
  }

  return error;
}

async function request(path, options = {}) {
  const token = getToken();

  const headers = {
    Accept: "application/json",
    ...options.headers
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  let res;

  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw buildNetworkError(error);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      window.location.replace("/login");
    }
    throw new Error(data?.message || "Request failed");
  }

  return unwrapResponse(data);
}

async function downloadFile(path, fallbackName) {
  const token = getToken();
  let res;

  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
  } catch (error) {
    throw buildNetworkError(error);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || "Download failed");
  }

  const blob = await res.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const disposition = res.headers.get("Content-Disposition") || "";
  const matchedName = /filename="?([^"]+)"?/i.exec(disposition)?.[1];

  link.href = objectUrl;
  link.download = matchedName || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

/* ================= AUTH ================= */
export const loginUser = (data) =>
  request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
/* ================= CURRENT USER ================= */
export const fetchCurrentUser = () =>
  request("/auth/me");
/* ================= ITEMS ================= */
export const fetchItems = (p = {}) => request(`/items${buildQuery(p)}`);
export const fetchAvailableInventory = (p = {}) => request(`/items/availability${buildQuery(p)}`);
export const fetchInventoryStats = () => request("/items/stats");
export const createItem = (data) => request("/items", { method: "POST", body: data });
export const updateItem = (id, data) => request(`/items/${id}`, { method: "PUT", body: data });
export const deleteItem = (id) => request(`/items/${id}`, { method: "DELETE" });

/* ================= MOVEMENTS ================= */
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

export const fetchDailyMovements = (p = {}) =>
  request(`/movements/daily${buildQuery(p)}`);

/* ================= REQUESTS ================= */
export const fetchRequests = (p = {}) =>
  request(`/requests${buildQuery(p)}`);

export const fetchRequestLocations = () =>
  request("/requests/locations");

export const createRequest = (data) =>
  request("/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

export const approveRequest = (id) =>
  request(`/requests/${id}/approve`, { method: "POST" });

export const rejectRequest = (id) =>
  request(`/requests/${id}/reject`, { method: "POST" });

/* ================= ALERTS ================= */
export const fetchAlerts = () => request("/alerts");
export const markAlertAsRead = (id) =>
  request(`/alerts/${id}/read`, { method: "PUT" });

/* ================= MESSAGES ================= */
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

/* ================= SYSTEM ================= */
export const fetchLocations = () => request("/system/locations");
export const createLocation = (d) =>
  request("/system/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const updateLocation = (id, d) =>
  request(`/system/locations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const fetchCategories = () => request("/system/categories");
export const createCategory = (d) =>
  request("/system/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const updateCategory = (id, d) =>
  request(`/system/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const fetchSuppliers = () => request("/system/suppliers");
export const createSupplier = (d) =>
  request("/system/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const updateSupplier = (id, d) =>
  request(`/system/suppliers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const fetchRecipients = (p = {}) =>
  request(`/system/recipients${buildQuery(p)}`);

export const createRecipient = (d) =>
  request("/system/recipients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const updateRecipient = (id, d) =>
  request(`/system/recipients/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const fetchUnits = () => request("/system/units");
export const createUnit = (d) =>
  request("/system/units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const updateUnit = (id, d) =>
  request(`/system/units/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const fetchUsers = () => request("/system/users");
export const createUser = (d) =>
  request("/system/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const updateUser = (id, d) =>
  request(`/system/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const fetchSections = (locationId) =>
  request(`/system/sections${buildQuery({ location_id: locationId })}`);

export const createSection = (d) =>
  request("/system/sections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const updateSection = (id, d) =>
  request(`/system/sections/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const fetchAssets = (locationId) =>
  request(`/system/assets${buildQuery({ location_id: locationId })}`);

export const createAsset = (d) =>
  request("/system/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const updateAsset = (id, d) =>
  request(`/system/assets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const deleteMasterData = (table, id) =>
  request(`/system/${table}/${id}`, { method: "DELETE" });

/* ================= MAINTENANCE ================= */
export const createMaintenanceLog = (d) =>
  request("/maintenance/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const fetchMaintenanceHistory = (p = {}) =>
  request(`/maintenance/history${buildQuery(p)}`);

export const fetchMaintenanceItems = (id) =>
  request(`/maintenance/${id}/items`);

/* ================= COUNTS ================= */
export const createInventoryCount = (d) =>
  request("/system/counts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(d)
  });

export const postInventoryCount = (id) =>
  request(`/system/counts/${id}/post`, { method: "POST" });

/* ================= REPORTS ================= */
export const fetchMovementReport = (p = {}) =>
  request(`/reports/movements${buildQuery(p)}`);

export const fetchInventoryValueReport = (p = {}) =>
  request(`/reports/inventory-value${buildQuery(p)}`);

export const downloadMovementReportPdf = (p = {}) =>
  downloadFile(`/reports/movements/pdf${buildQuery(p)}`, "item-movement-report.pdf");

export const downloadMovementReportCsv = (p = {}) =>
  downloadFile(`/reports/movements/csv${buildQuery(p)}`, "item-movement-report.csv");

export const downloadMovementReportExcel = (p = {}) =>
  downloadFile(`/reports/movements/excel${buildQuery(p)}`, "item-movement-report.xlsx");

export const createIssue = (data) =>
  request("/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
