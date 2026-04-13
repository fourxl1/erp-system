const { PUBLIC_MOVEMENT_TYPES, normalizeIncomingMovementType } = require("../utils/movementTypes");
const { sendError } = require("../utils/http");

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function isPositiveInteger(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

function isNonNegativeNumber(value) {
  return !Number.isNaN(Number(value)) && Number(value) >= 0;
}

function isPositiveNumber(value) {
  return !Number.isNaN(Number(value)) && Number(value) > 0;
}

function validate(schema = {}) {
  return (req, res, next) => {
    const errors = [];

    for (const [sourceName, rules] of Object.entries(schema)) {
      const source = req[sourceName] || {};

      for (const rule of rules) {
        const value = source[rule.field];

        if (rule.required && isBlank(value)) {
          errors.push(`${rule.field} is required`);
          continue;
        }

        if (!rule.required && isBlank(value)) {
          continue;
        }

        if (rule.type === "string" && typeof value !== "string") {
          errors.push(`${rule.field} must be a string`);
          continue;
        }

        if (rule.type === "boolean" && typeof value !== "boolean") {
          errors.push(`${rule.field} must be a boolean`);
          continue;
        }

        if (rule.type === "email") {
          const ok = typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
          if (!ok) {
            errors.push(`${rule.field} must be a valid email address`);
            continue;
          }
        }

        if (rule.type === "id" && !isPositiveInteger(value)) {
          errors.push(`${rule.field} must be a positive integer`);
          continue;
        }

        if (rule.type === "number" && !isNonNegativeNumber(value)) {
          errors.push(`${rule.field} must be a non-negative number`);
          continue;
        }

        if (rule.type === "positive-number" && !isPositiveNumber(value)) {
          errors.push(`${rule.field} must be greater than zero`);
          continue;
        }

        if (rule.type === "enum" && !rule.values.includes(String(value).toUpperCase())) {
          errors.push(`${rule.field} must be one of: ${rule.values.join(", ")}`);
          continue;
        }

        if (rule.type === "array" && !Array.isArray(value)) {
          errors.push(`${rule.field} must be an array`);
          continue;
        }

        if (rule.minLength && String(value).trim().length < rule.minLength) {
          errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
          continue;
        }

        if (rule.custom) {
          const result = rule.custom(value, source, req);

          if (result !== true) {
            errors.push(result || `${rule.field} is invalid`);
          }
        }
      }
    }

    if (errors.length) {
      return sendError(res, 400, "Validation failed", { errors });
    }

    return next();
  };
}

const movementTypes = PUBLIC_MOVEMENT_TYPES;
const acceptedMovementTypes = [...movementTypes, "IN", "OUT"];

const validationSchemas = {
  login: {
    body: [
      { field: "email", required: true, type: "email" },
      { field: "password", required: true, type: "string", minLength: 3 }
    ]
  },
  itemQuery: {
    query: [
      { field: "item_id", type: "id" },
      { field: "category_id", type: "id" },
      { field: "location_id", type: "id" },
      { field: "search", type: "string" }
    ]
  },
  itemIdParam: {
    params: [{ field: "id", required: true, type: "id" }],
    query: [{ field: "location_id", type: "id" }]
  },
  itemPayload: {
    body: [
      { field: "name", required: true, type: "string", minLength: 2 },
      { field: "unit", required: true, type: "string", minLength: 1 },
      { field: "category_id", type: "id" },
      { field: "supplier_id", type: "id" },
      { field: "reorder_level", type: "number" },
      { field: "minimum_quantity", type: "number" },
      { field: "description", type: "string" }
    ]
  },
  movementQuery: {
    query: [
      { field: "item_id", type: "id" },
      { field: "location_id", type: "id" },
      { field: "movement_type", type: "enum", values: acceptedMovementTypes },
      { field: "status", type: "string" },
      { field: "start_date", type: "string" },
      { field: "end_date", type: "string" }
    ]
  },
  dailyMovementQuery: {
    query: [
      { field: "date", type: "string" },
      { field: "start_date", type: "string" },
      { field: "end_date", type: "string" },
      { field: "item_id", type: "id" },
      { field: "location_id", type: "id" },
      { field: "movement_type", type: "enum", values: acceptedMovementTypes },
      { field: "status", type: "string" }
    ]
  },
  movementPayload: {
    body: [
      { field: "movement_type", required: true, type: "enum", values: acceptedMovementTypes },
      { field: "section_id", type: "id" },
      { field: "asset_id", type: "id" },
      { field: "recipient_id", type: "id" },
      { field: "supplier_id", type: "id" },
      { field: "destination_location_id", type: "id" },
      { field: "item_id", type: "id" },
      { field: "quantity", type: "number" },
      { field: "unit_cost", type: "number" },
      {
        field: "items",
        type: "array",
        custom: (value, body) => {
          if ((!Array.isArray(value) || value.length === 0) && !(body.item_id && body.quantity !== undefined)) {
            return "items is required";
          }

          if (Array.isArray(value)) {
            for (const entry of value) {
              if (!isPositiveInteger(entry.item_id)) {
                return "each movement item must include a valid item_id";
              }

              if (Number.isNaN(Number(entry.quantity)) || Number(entry.quantity) === 0) {
                return "each movement item must include a non-zero quantity";
              }

              if (!isBlank(entry.cost) && !isNonNegativeNumber(entry.cost)) {
                return "each movement item cost must be a non-negative number";
              }
            }
          }

          return true;
        }
      },
      {
        field: "movement_type",
        custom: (value, body) => {
          const type = normalizeIncomingMovementType(value);
          const items = Array.isArray(body.items) ? body.items : [];
          const legacyQuantity = body.quantity;

          if (type === "TRANSFER") {
            if (!isPositiveInteger(body.destination_location_id)) {
              return "destination_location_id is required for transfers";
            }
          }

          if (type === "IN" && !isPositiveInteger(body.supplier_id)) {
            return "supplier_id is required for IN movements";
          }

          if (type === "OUT" && !isPositiveInteger(body.recipient_id)) {
            return "recipient_id is required for OUT movements";
          }

          if (type !== "ADJUSTMENT") {
            if (Array.isArray(items) && items.some((entry) => Number(entry.quantity) < 0)) {
              return "negative quantities are only allowed for ADJUSTMENT movements";
            }

            if (!Array.isArray(items) && legacyQuantity !== undefined && Number(legacyQuantity) < 0) {
              return "negative quantity is only allowed for ADJUSTMENT movements";
            }
          }

          return true;
        }
      }
    ]
  },
  requestQuery: {
    query: [
      { field: "location_id", type: "id" },
      { field: "source_location_id", type: "id" },
      { field: "status", type: "string" }
    ]
  },
  requestIdParam: {
    params: [{ field: "id", required: true, type: "id" }]
  },
  createRequest: {
    body: [
      { field: "source_location_id", required: true, type: "id" },
      { field: "notes", type: "string" },
      {
        field: "items",
        required: true,
        type: "array",
        custom: (value) => {
          if (!Array.isArray(value) || value.length === 0) {
            return "items must contain at least one request item";
          }

          for (const entry of value) {
            if (!isPositiveInteger(entry.item_id)) {
              return "each request item must include a valid item_id";
            }
            if (!isPositiveNumber(entry.quantity)) {
              return "each request item must include a quantity greater than zero";
            }
            if (!isBlank(entry.unit_cost) && !isNonNegativeNumber(entry.unit_cost)) {
              return "each request item unit_cost must be a non-negative number";
            }
          }

          return true;
        }
      }
    ]
  },
  rejectRequest: {
    params: [{ field: "id", required: true, type: "id" }],
    body: [{ field: "reason", type: "string", minLength: 3 }]
  },
  approveRequest: {
    params: [{ field: "id", required: true, type: "id" }],
    body: [{ field: "reference", type: "string", minLength: 1 }]
  },
  maintenanceLog: {
    body: [
      { field: "asset_id", required: true, type: "id" },
      { field: "description", required: true, type: "string", minLength: 3 },
      { field: "reference", type: "string" },
      {
        field: "items_used",
        required: true,
        type: "array",
        custom: (value) => {
          if (!Array.isArray(value) || value.length === 0) {
            return "items_used must contain at least one item";
          }

          for (const entry of value) {
            if (!isPositiveInteger(entry.item_id)) {
              return "each maintenance item must include a valid item_id";
            }
            if (!isPositiveNumber(entry.quantity)) {
              return "each maintenance item quantity must be greater than zero";
            }
            if (!isBlank(entry.section_id) && !isPositiveInteger(entry.section_id)) {
              return "each maintenance item section_id must be a positive integer";
            }
            if (!isBlank(entry.unit_cost) && !isNonNegativeNumber(entry.unit_cost)) {
              return "each maintenance item unit_cost must be a non-negative number";
            }
          }

          return true;
        }
      }
    ]
  },
  maintenanceHistoryQuery: {
    query: [
      { field: "asset_id", type: "id" },
      { field: "location_id", type: "id" }
    ]
  },
  assetParam: {
    params: [{ field: "asset_id", required: true, type: "id" }],
    query: [{ field: "location_id", type: "id" }]
  },
  reportQuery: {
    query: [
      { field: "item_id", type: "id" },
      { field: "category_id", type: "id" },
      { field: "recipient_id", type: "id" },
      { field: "location_id", type: "id" },
      { field: "movement_type", type: "enum", values: acceptedMovementTypes },
      { field: "start_date", type: "string" },
      { field: "end_date", type: "string" }
    ]
  },
  dashboardQuery: {
    query: [{ field: "location_id", type: "id" }]
  },
  messagePayload: {
    body: [
      { field: "receiver_id", required: true, type: "id" },
      { field: "subject", type: "string" },
      { field: "message", required: true, type: "string", minLength: 1 }
    ]
  },
  messageIdParam: {
    params: [{ field: "id", required: true, type: "id" }]
  },
  movementIdParam: {
    params: [{ field: "id", required: true, type: "id" }]
  }
};

module.exports = {
  validate,
  validationSchemas
};
