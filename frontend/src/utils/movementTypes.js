export const MOVEMENT_TYPE_OPTIONS = [
  { value: "IN", label: "Stock In" },
  { value: "OUT", label: "Stock Out" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "ADJUSTMENT", label: "Adjustment" }
];

export function formatMovementType(value) {
  const normalized = String(value || "").trim().toUpperCase();

  if (normalized === "IN" || normalized === "STOCK_IN") return "Stock In";
  if (normalized === "OUT" || normalized === "STOCK_OUT") return "Stock Out";
  if (normalized === "TRANSFER") return "Transfer";
  if (normalized === "ADJUSTMENT") return "Adjustment";
  return normalized || "-";
}
