const systemService = require("../services/systemService");
const { asyncHandler, sendSuccess } = require("../utils/http");

const getAlerts = asyncHandler(async (req, res) => {
  const alerts = await systemService.listAlerts(req.user, req.query.location_id);

  return sendSuccess(
    res,
    alerts.map((alert) => ({
      ...alert,
      type: alert.alert_type
    }))
  );
});

const markAlertAsRead = asyncHandler(async (req, res) => {
  const alert = await systemService.markAlertAsRead(req.params.id, req.user);

  return sendSuccess(res, {
    alert
  }, {
    message: "Alert marked as read"
  });
});

module.exports = {
  getAlerts,
  markAlertAsRead
};
