const issueService = require("../services/issueService");
const { asyncHandler, sendSuccess } = require("../utils/http");

const createIssue = asyncHandler(async (req, res) => {
  const issue = await issueService.createIssue(req.body, req.user);

  return sendSuccess(res, issue, {
    statusCode: 201,
    message: "Issue reported successfully"
  });
});

module.exports = {
  createIssue
};
