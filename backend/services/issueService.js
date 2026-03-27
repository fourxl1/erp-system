const issueModel = require("../models/issueModel");

function buildError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function createIssue(payload, user) {
  const title = String(payload.title || "").trim();
  const description = String(payload.description || payload.message || "").trim();
  const relatedReport =
    payload.related_report === undefined || payload.related_report === null
      ? null
      : String(payload.related_report).trim() || null;

  if (!title) {
    throw buildError("title is required");
  }

  if (!description) {
    throw buildError("description is required");
  }

  return issueModel.createIssue({
    user_id: user.id,
    title,
    description,
    related_report: relatedReport,
    created_at: payload.created_at || null
  });
}

module.exports = {
  createIssue
};
