const notificationService = require("../services/notificationService");
const { asyncHandler, sendSuccess } = require("../utils/http");

const listNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listNotifications(req.user, req.query);
  return sendSuccess(res, notifications);
});

const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationAsRead(req.params.id, req.user);
  return sendSuccess(
    res,
    { notification },
    {
      message: "Notification marked as read"
    }
  );
});

const setNotificationReadState = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationAsRead(
    req.params.id,
    req.user,
    req.body?.is_read === true
  );

  return sendSuccess(
    res,
    { notification },
    {
      message: req.body?.is_read === true ? "Notification marked as read" : "Notification marked as unread"
    }
  );
});

const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const count = await notificationService.markAllAsRead(req.user, req.body?.type || null);

  return sendSuccess(
    res,
    { updated: count },
    {
      message: "Notifications marked as read"
    }
  );
});

module.exports = {
  listNotifications,
  markNotificationAsRead,
  setNotificationReadState,
  markAllNotificationsAsRead
};
