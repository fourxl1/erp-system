const messageService = require("../services/messageService");
const { asyncHandler, sendSuccess } = require("../utils/http");

const sendMessage = asyncHandler(async (req, res) => {
  const data = await messageService.sendMessage(req.body, req.user);

  return sendSuccess(res, data, {
    statusCode: 201,
    message: "Message sent successfully"
  });
});

const getMessageUsers = asyncHandler(async (req, res) => {
  const users = await messageService.listMessageUsers(req.user);
  return sendSuccess(res, users);
});

const getMessages = asyncHandler(async (req, res) => {
  const messages = await messageService.getInbox(req.user);
  return sendSuccess(res, messages);
});

const markMessageAsRead = asyncHandler(async (req, res) => {
  const data = await messageService.markMessageAsRead(req.params.id, req.user);

  return sendSuccess(res, data, {
    message: "Message marked as read"
  });
});

module.exports = {
  sendMessage,
  getMessageUsers,
  getMessages,
  markMessageAsRead
};
