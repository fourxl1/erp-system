export const REQUEST_REFRESH_EVENT = "inventory-requests-changed";
export const REQUEST_NOTIFICATION_STATE_EVENT = "inventory-request-notification-state";

function getStorageKey(userId) {
  return `inventory-dismissed-request-notifications:${userId || "guest"}`;
}

function readStoredArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getDismissedRequestNotificationKeys(userId) {
  return readStoredArray(getStorageKey(userId));
}

export function dismissRequestNotificationKeys(userId, keys = []) {
  const storageKey = getStorageKey(userId);
  const existing = new Set(readStoredArray(storageKey));

  keys.filter(Boolean).forEach((key) => existing.add(key));

  const next = [...existing];
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

function formatQuantity(value) {
  const quantity = Number(value || 0);

  if (Number.isInteger(quantity)) {
    return String(quantity);
  }

  return quantity.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function summarizeRequestItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return "stock items";
  }

  if (items.length === 1) {
    return `${items[0].item_name} x${formatQuantity(items[0].quantity)}`;
  }

  const firstItem = `${items[0].item_name} x${formatQuantity(items[0].quantity)}`;
  return `${firstItem} and ${items.length - 1} more item${items.length > 2 ? "s" : ""}`;
}

function getPrimaryRequestItem(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return items[0];
}

function createNotificationDescriptor(request, userId) {
  const sourceStore = request.source_location_name || "source store";
  const destinationStore = request.destination_location_name || request.location_name || "requested store";
  const itemSummary = summarizeRequestItems(request.items);
  const primaryItem = getPrimaryRequestItem(request.items);
  const isRequester = Number(request.requester_id) === Number(userId);
  const itemDetails = {
    itemImage: primaryItem?.item_image || null,
    itemName: primaryItem?.item_name || null
  };

  if (request.status === "PENDING" && request.can_approve) {
    return {
      key: `approver:${request.id}:PENDING`,
      id: request.id,
      status: request.status,
      title: "Pending Request",
      message: `You have a pending request from ${request.requester_name} of ${destinationStore} for ${itemSummary}.`,
      meta: `${request.request_number} | ${destinationStore}`,
      sortValue: request.created_at || "",
      ...itemDetails
    };
  }

  if (!isRequester) {
    return null;
  }

  if (request.status === "PENDING") {
    return {
      key: `requester:${request.id}:PENDING`,
      id: request.id,
      status: request.status,
      title: "Request Pending",
      message: `Your request for ${itemSummary} from ${sourceStore} is pending approval.`,
      meta: `${request.request_number} | ${sourceStore}`,
      sortValue: request.created_at || "",
      ...itemDetails
    };
  }

  if (request.status === "APPROVED") {
    return {
      key: `requester:${request.id}:APPROVED`,
      id: request.id,
      status: request.status,
      title: "Request Approved",
      message: `Your request for ${itemSummary} from ${sourceStore} has been approved.`,
      meta: `${request.request_number} | ${sourceStore}`,
      sortValue: request.created_at || "",
      ...itemDetails
    };
  }

  if (request.status === "REJECTED") {
    return {
      key: `requester:${request.id}:REJECTED`,
      id: request.id,
      status: request.status,
      title: "Request Rejected",
      message: `Your request for ${itemSummary} from ${sourceStore} has been rejected.`,
      meta: `${request.request_number} | ${sourceStore}`,
      sortValue: request.created_at || "",
      ...itemDetails
    };
  }

  return null;
}

export function buildRequestNotifications(requests, userId, dismissedKeys = []) {
  const dismissed = new Set(dismissedKeys);

  return requests
    .map((request) => createNotificationDescriptor(request, userId))
    .filter(Boolean)
    .filter((notification) => !dismissed.has(notification.key))
    .sort((left, right) => new Date(right.sortValue || 0) - new Date(left.sortValue || 0));
}
