export const MOVEMENT_TYPE_OPTIONS = [
  { value: "STOCK_IN", label: "Stock In" },
  { value: "STOCK_OUT", label: "Stock Out" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "ASSET_ISSUE", label: "Asset Issue" }
];

export function formatMovementType(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized === "IN" || normalized === "STOCK_IN") {
    return "STOCK_IN";
  }

  if (normalized === "OUT" || normalized === "STOCK_OUT") {
    return "STOCK_OUT";
  }

  return normalized;
}
