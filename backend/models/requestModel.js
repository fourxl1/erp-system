const { query } = require("../config/db");

async function createRequestHeader(client, requestData) {
  const result = await client.query(
    `
      INSERT INTO stock_requests (
        request_number,
        requester_id,
        location_id,
        source_location_id,
        destination_location_id,
        status,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
      RETURNING *
    `,
    [
      requestData.request_number,
      requestData.requester_id,
      requestData.location_id,
      requestData.source_location_id || null,
      requestData.destination_location_id || null,
      requestData.notes || null
    ]
  );

  return result.rows[0];
}

async function createRequestItems(client, requestId, items) {
  const created = [];

  for (const item of items) {
    const result = await client.query(
      `
        INSERT INTO stock_request_items (request_id, item_id, quantity, unit_cost)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [requestId, item.item_id, item.quantity, item.unit_cost || 0]
    );

    created.push(result.rows[0]);
  }

  return created;
}

async function getRequestById(id) {
  const result = await query(
    `
      SELECT
        sr.*,
        requester.full_name AS requester_name,
        approver.full_name AS approver_name,
        requested_for_location.name AS location_name,
        source_location.name AS source_location_name,
        legacy_destination_location.name AS legacy_destination_location_name
      FROM stock_requests sr
      JOIN users requester ON requester.id = sr.requester_id
      LEFT JOIN users approver ON approver.id = sr.approved_by
      JOIN locations requested_for_location ON requested_for_location.id = sr.location_id
      LEFT JOIN locations source_location ON source_location.id = sr.source_location_id
      LEFT JOIN locations legacy_destination_location ON legacy_destination_location.id = sr.destination_location_id
      WHERE sr.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getRequestByIdWithClient(client, id) {
  const result = await client.query(
    `
      SELECT
        sr.*,
        requester.full_name AS requester_name,
        approver.full_name AS approver_name,
        requested_for_location.name AS location_name,
        source_location.name AS source_location_name,
        legacy_destination_location.name AS legacy_destination_location_name
      FROM stock_requests sr
      JOIN users requester ON requester.id = sr.requester_id
      LEFT JOIN users approver ON approver.id = sr.approved_by
      JOIN locations requested_for_location ON requested_for_location.id = sr.location_id
      LEFT JOIN locations source_location ON source_location.id = sr.source_location_id
      LEFT JOIN locations legacy_destination_location ON legacy_destination_location.id = sr.destination_location_id
      WHERE sr.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getRequestByIdForUpdate(client, id) {
  const result = await client.query(
    `
      SELECT
        sr.*,
        requester.full_name AS requester_name,
        approver.full_name AS approver_name,
        requested_for_location.name AS location_name,
        source_location.name AS source_location_name,
        legacy_destination_location.name AS legacy_destination_location_name
      FROM stock_requests sr
      JOIN users requester ON requester.id = sr.requester_id
      LEFT JOIN users approver ON approver.id = sr.approved_by
      JOIN locations requested_for_location ON requested_for_location.id = sr.location_id
      LEFT JOIN locations source_location ON source_location.id = sr.source_location_id
      LEFT JOIN locations legacy_destination_location ON legacy_destination_location.id = sr.destination_location_id
      WHERE sr.id = $1
      FOR UPDATE OF sr
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getRequestItems(requestId) {
  const result = await query(
    `
      SELECT
        sri.*,
        i.name AS item_name,
        i.unit,
        i.image_path AS item_image
      FROM stock_request_items sri
      JOIN items i ON i.id = sri.item_id
      WHERE sri.request_id = $1
      ORDER BY i.name
    `,
    [requestId]
  );

  return result.rows;
}

async function getRequestItemsWithClient(client, requestId) {
  const result = await client.query(
    `
      SELECT
        sri.*,
        i.name AS item_name,
        i.unit,
        i.image_path AS item_image
      FROM stock_request_items sri
      JOIN items i ON i.id = sri.item_id
      WHERE sri.request_id = $1
      ORDER BY i.name
    `,
    [requestId]
  );

  return result.rows;
}

async function listRequests(filters = {}) {
  const conditions = ["1 = 1"];
  const values = [];

  if (filters.locationId) {
    values.push(filters.locationId);
    conditions.push(`sr.location_id = $${values.length}`);
  }

  if (filters.sourceLocationId) {
    values.push(filters.sourceLocationId);
    conditions.push(`COALESCE(sr.source_location_id, sr.location_id) = $${values.length}`);
  }

  if (filters.accessLocationId) {
    values.push(filters.accessLocationId);
    conditions.push(
      `(
        sr.location_id = $${values.length}
        OR COALESCE(sr.source_location_id, sr.location_id) = $${values.length}
        OR sr.destination_location_id = $${values.length}
      )`
    );
  }

  if (filters.requesterId) {
    values.push(filters.requesterId);
    conditions.push(`sr.requester_id = $${values.length}`);
  }

  if (filters.status) {
    values.push(String(filters.status).toUpperCase());
    conditions.push(`sr.status = $${values.length}`);
  }

  const result = await query(
    `
      SELECT
        sr.id,
        sr.request_number,
        sr.status,
        sr.notes,
        sr.requester_id,
        sr.location_id,
        sr.source_location_id,
        sr.destination_location_id,
        sr.created_at,
        requester.full_name AS requester_name,
        requested_for_location.name AS location_name,
        source_location.name AS source_location_name,
        legacy_destination_location.name AS legacy_destination_location_name
      FROM stock_requests sr
      JOIN users requester ON requester.id = sr.requester_id
      JOIN locations requested_for_location ON requested_for_location.id = sr.location_id
      LEFT JOIN locations source_location ON source_location.id = sr.source_location_id
      LEFT JOIN locations legacy_destination_location ON legacy_destination_location.id = sr.destination_location_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY sr.created_at DESC
    `,
    values
  );

  return result.rows;
}

async function updateRequestStatus(client, id, status, options = {}) {
  const normalizedStatus = String(status).toUpperCase();
  const values = [normalizedStatus, id];
  const assignments = ["status = $1"];

  if (normalizedStatus === "APPROVED") {
    values.push(options.approvedBy || null);
    assignments.push(`approved_by = $${values.length}`);
    assignments.push("approved_at = NOW()");
  } else {
    assignments.push("approved_by = NULL");
    assignments.push("approved_at = NULL");
  }

  const result = await client.query(
    `
      UPDATE stock_requests
      SET ${assignments.join(", ")}
      WHERE id = $2
      RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

module.exports = {
  createRequestHeader,
  createRequestItems,
  getRequestById,
  getRequestByIdWithClient,
  getRequestByIdForUpdate,
  getRequestItems,
  getRequestItemsWithClient,
  listRequests,
  updateRequestStatus
};
