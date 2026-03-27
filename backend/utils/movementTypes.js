const PUBLIC_MOVEMENT_TYPES = [
  "STOCK_IN",
  "STOCK_OUT",
  "TRANSFER",
  "ADJUSTMENT",
  "MAINTENANCE",
  "ASSET_ISSUE"
];

const INPUT_TO_DB_TYPE = {
  STOCK_IN: "IN",
  IN: "IN",
  STOCK_OUT: "OUT",
  OUT: "OUT",
  TRANSFER: "TRANSFER",
  ADJUSTMENT: "ADJUSTMENT",
  MAINTENANCE: "MAINTENANCE",
  ASSET_ISSUE: "ASSET_ISSUE"
};

const DB_TO_PUBLIC_TYPE = {
  IN: "STOCK_IN",
  OUT: "STOCK_OUT",
  TRANSFER: "TRANSFER",
  ADJUSTMENT: "ADJUSTMENT",
  MAINTENANCE: "MAINTENANCE",
  ASSET_ISSUE: "ASSET_ISSUE"
};

function normalizeIncomingMovementType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return INPUT_TO_DB_TYPE[normalized] || null;
}

function toPublicMovementType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return DB_TO_PUBLIC_TYPE[normalized] || normalized;
}

module.exports = {
  PUBLIC_MOVEMENT_TYPES,
  normalizeIncomingMovementType,
  toPublicMovementType
};
