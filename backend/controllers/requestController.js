const movementService = require("../services/movementService");
const { asyncHandler, sendSuccess } = require("../utils/http");

const createRequest = asyncHandler(async (req, res) => {
  const request = await movementService.createRequest(req.body, req.user);

  return sendSuccess(res, { request }, {
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
    requests
  });
});

const getRequest = asyncHandler(async (req, res) => {
  const request = await movementService.getRequestDetails(req.params.id, req.user);
  return sendSuccess(res, request);
});

const approveRequest = asyncHandler(async (req, res) => {
  const request = await movementService.approveRequest(req.params.id, req.user, req.body);

  return sendSuccess(res, { request }, {
    message: "Stock request approved successfully"
  });
});

const rejectRequest = asyncHandler(async (req, res) => {
  const request = await movementService.rejectRequest(
    req.params.id,
    req.user,
    req.body.reason || null
  );

  return sendSuccess(res, { request }, {
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
