const movementService = require("../services/movementService");
const { asyncHandler, sendSuccess } = require("../utils/http");
const { buildItemImageUrl } = require("../utils/itemImage");

function serializeRequestItems(items, req) {
  return Array.isArray(items)
    ? items.map((item) => ({
        ...item,
        item_image: buildItemImageUrl(req, item.item_image)
      }))
    : [];
}

function serializeRequest(request, req, options = {}) {
  if (!request) {
    return request;
  }

  const serialized = {
    ...request,
    items: serializeRequestItems(request.items, req)
  };

  if (Object.prototype.hasOwnProperty.call(options, "rejection_reason")) {
    serialized.rejection_reason = options.rejection_reason;
  }

  return serialized;
}

const createRequest = asyncHandler(async (req, res) => {
  const request = await movementService.createRequest(req.body, req.user);

  return sendSuccess(res, { request: serializeRequest(request, req) }, {
    statusCode: 201,
    message: "Stock request created successfully"
  });
});

const getRequestLocations = asyncHandler(async (req, res) => {
  const locations = await movementService.listRequestLocations(req.user);
  return sendSuccess(res, locations);
});

const listRequests = asyncHandler(async (req, res) => {
  const requests = await movementService.listRequests(
    {
      locationId: req.query.location_id,
      sourceLocationId: req.query.source_location_id,
      status: req.query.status
    },
    req.user
  );

  return sendSuccess(res, {
    count: requests.length,
    requests: requests.map((request) => serializeRequest(request, req))
  });
});

const getRequest = asyncHandler(async (req, res) => {
  const request = await movementService.getRequestDetails(req.params.id, req.user);
  return sendSuccess(res, serializeRequest(request, req));
});

const approveRequest = asyncHandler(async (req, res) => {
  const request = await movementService.approveRequest(req.params.id, req.user, req.body);

  return sendSuccess(res, { request: serializeRequest(request, req) }, {
    message: "Stock request approved successfully"
  });
});

const rejectRequest = asyncHandler(async (req, res) => {
  const request = await movementService.rejectRequest(
    req.params.id,
    req.user,
    req.body.reason || null
  );

  return sendSuccess(res, {
    request: serializeRequest(request, req, {
      rejection_reason: req.body.reason || null
    })
  }, {
    message: "Stock request rejected successfully"
  });
});

module.exports = {
  createRequest,
  getRequestLocations,
  listRequests,
  getRequest,
  approveRequest,
  rejectRequest
};
