const reportService = require("../services/reportService");
const { asyncHandler, sendSuccess } = require("../utils/http");
const { buildItemImageUrl } = require("../utils/itemImage");

function getReportFilters(req) {
  return {
    itemId: req.query.item_id,
    categoryId: req.query.category_id,
    recipientId: req.query.recipient_id,
    locationId: req.query.location_id,
    movementType: req.query.movement_type,
    startDate: req.query.start_date,
    endDate: req.query.end_date
  };
}

const getMovementReport = asyncHandler(async (req, res) => {
  const report = await reportService.getMovementReport(getReportFilters(req), req.user);
  return sendSuccess(res, {
    ...report,
    item: report.item
      ? {
          ...report.item,
          itemImage: buildItemImageUrl(req, report.item.itemImage)
        }
      : null,
    movements: report.movements.map((movement) => ({
      ...movement,
      item_image: buildItemImageUrl(req, movement.item_image)
    }))
  });
});

const exportMovementReportPdf = asyncHandler(async (req, res) => {
  const report = await reportService.getMovementReport(getReportFilters(req), req.user);
  return reportService.renderMovementPdf(report, res);
});

const exportMovementReportCsv = asyncHandler(async (req, res) => {
  const csv = await reportService.exportMovementReportCsv(getReportFilters(req), req.user);

  res.header("Content-Type", "text/csv");
  res.attachment(req.query.item_id ? "item-movement-report.csv" : "movement-history-report.csv");
  return res.send(csv);
});

const exportMovementReportExcel = asyncHandler(async (req, res) => {
  const workbook = await reportService.exportMovementReportExcel(getReportFilters(req), req.user);

  res.header(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.attachment(req.query.item_id ? "item-movement-report.xlsx" : "movement-history-report.xlsx");
  return res.send(Buffer.from(workbook));
});

const exportInventoryValueReportPdf = asyncHandler(async (req, res) => {
  return reportService.exportInventoryValuePdf(
    {
      itemId: req.query.item_id,
      categoryId: req.query.category_id,
      locationId: req.query.location_id
    },
    req.user,
    res
  );
});

const exportInventoryValueReportCsv = asyncHandler(async (req, res) => {
  const csv = await reportService.exportInventoryValueCsv(
    {
      itemId: req.query.item_id,
      categoryId: req.query.category_id,
      locationId: req.query.location_id
    },
    req.user
  );

  res.header("Content-Type", "text/csv");
  res.attachment("inventory-valuation-report.csv");
  return res.send(csv);
});

const exportInventoryValueReportExcel = asyncHandler(async (req, res) => {
  const workbook = await reportService.exportInventoryValueExcel(
    {
      itemId: req.query.item_id,
      categoryId: req.query.category_id,
      locationId: req.query.location_id
    },
    req.user
  );

  res.header(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.attachment("inventory-valuation-report.xlsx");
  return res.send(Buffer.from(workbook));
});

const getInventoryValueReport = asyncHandler(async (req, res) => {
  const rows = await reportService.getInventoryValue(
    {
      itemId: req.query.item_id,
      categoryId: req.query.category_id,
      locationId: req.query.location_id
    },
    req.user
  );

  const serializedRows = rows.map((row) => ({
    ...row,
    item_image: buildItemImageUrl(req, row.item_image)
  }));

  const summary = serializedRows.reduce(
    (accumulator, row) => ({
      item_count: accumulator.item_count + 1,
      total_quantity: accumulator.total_quantity + Number(row.current_quantity || 0),
      total_value: accumulator.total_value + Number(row.total_value || 0)
    }),
    {
      item_count: 0,
      total_quantity: 0,
      total_value: 0
    }
  );

  return sendSuccess(res, {
    rows: serializedRows,
    summary
  });
});

module.exports = {
  getMovementReport,
  exportMovementReportPdf,
  exportMovementReportCsv,
  exportMovementReportExcel,
  exportInventoryValueReportPdf,
  exportInventoryValueReportCsv,
  exportInventoryValueReportExcel,
  getInventoryValueReport
};
