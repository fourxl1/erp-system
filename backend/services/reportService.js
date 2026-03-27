const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { Parser } = require("json2csv");
const { query } = require("../config/db");
const { calculateAverageCost } = require("../utils/averageCost");
const { toPublicMovementType } = require("../utils/movementTypes");

function applyLocationScope(filters, user) {
  if (user.role_code === "ADMIN" && user.location_id) {
    return {
      ...filters,
      locationId: user.location_id
    };
  }

  return filters;
}

function resolveLocalReportImagePath(imagePath) {
  if (!imagePath) {
    return null;
  }

  const uploadsRoot = path.resolve(__dirname, "..", "uploads", "items");
  const normalizedPath = String(imagePath).replace(/^\/+/, "");
  const localPath = path.resolve(__dirname, "..", normalizedPath);

  if (!localPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return null;
  }

  return fs.existsSync(localPath) ? localPath : null;
}

async function getMovementReport(filters, user) {
  const scopedFilters = applyLocationScope(filters, user);
  const conditions = ["1 = 1"];
  const values = [];

  if (scopedFilters.itemId) {
    values.push(scopedFilters.itemId);
    conditions.push(`sm.item_id = $${values.length}`);
  }

  if (scopedFilters.categoryId) {
    values.push(scopedFilters.categoryId);
    conditions.push(`i.category_id = $${values.length}`);
  }

  if (scopedFilters.locationId) {
    values.push(scopedFilters.locationId);
    conditions.push(`sm.location_id = $${values.length}`);
  }

  if (scopedFilters.recipientId) {
    values.push(scopedFilters.recipientId);
    conditions.push(`sm.recipient_id = $${values.length}`);
  }

  if (scopedFilters.movementType) {
    values.push(scopedFilters.movementType);
    conditions.push(`sm.movement_type = $${values.length}`);
  }

  if (scopedFilters.startDate) {
    values.push(scopedFilters.startDate);
    conditions.push(`sm.created_at >= $${values.length}`);
  }

  if (scopedFilters.endDate) {
    values.push(scopedFilters.endDate);
    conditions.push(`sm.created_at <= $${values.length}`);
  }

  const movementResult = await query(
    `
      SELECT
        sm.created_at AS date,
        sm.movement_type,
        sm.quantity,
        sm.unit_cost,
        COALESCE(il.quantity, 0) AS delta_quantity,
        (sm.quantity * sm.unit_cost) AS total_cost,
        a.name AS asset,
        supplier.name AS supplier,
        recipient.name AS recipient,
        l.name AS location,
        ss.name AS section,
        sm.reference,
        performer.full_name AS entered_by,
        i.id AS item_id,
        i.name AS item_name,
        i.unit AS item_unit,
        i.description AS item_description,
        i.image_path AS item_image,
        c.name AS category
      FROM stock_movements sm
      JOIN items i ON i.id = sm.item_id
      LEFT JOIN categories c ON c.id = i.category_id
      JOIN locations l ON l.id = sm.location_id
      LEFT JOIN store_sections ss ON ss.id = sm.section_id
      LEFT JOIN assets a ON a.id = sm.asset_id
      LEFT JOIN suppliers supplier ON supplier.id = sm.supplier_id
      LEFT JOIN recipients recipient ON recipient.id = sm.recipient_id
      LEFT JOIN inventory_ledger il ON il.movement_id = sm.id
      JOIN users performer ON performer.id = sm.performed_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY sm.created_at DESC
    `,
    values
  );

  let currentStock = null;

  if (scopedFilters.itemId) {
    const balanceValues = [scopedFilters.itemId];
    let balanceWhere = "WHERE item_id = $1";

    if (scopedFilters.locationId) {
      balanceValues.push(scopedFilters.locationId);
      balanceWhere += ` AND location_id = $2`;
    }

    const stockResult = await query(
      `
        SELECT COALESCE(SUM(quantity), 0) AS current_stock
        FROM inventory_balance
        ${balanceWhere}
      `,
      balanceValues
    );

    currentStock = Number(stockResult.rows[0]?.current_stock || 0);
  }

  return {
    header: {
      companyName: "Latex Foam Store",
      reportTitle: "Item Movement Report",
      fromDate: scopedFilters.startDate || null,
      toDate: scopedFilters.endDate || null,
      generatedAt: new Date().toISOString()
    },
    item: movementResult.rows[0]
      ? {
          itemId: movementResult.rows[0].item_id,
          itemName: movementResult.rows[0].item_name,
          unit: movementResult.rows[0].item_unit,
          itemDescription: movementResult.rows[0].item_description,
          category: movementResult.rows[0].category,
          itemImage: movementResult.rows[0].item_image,
          currentStock
        }
      : null,
    movements: movementResult.rows.map((row) => ({
      ...row,
      movement_type: toPublicMovementType(row.movement_type),
      delta_quantity: Number(row.delta_quantity || 0),
      unit_cost: Number(row.unit_cost || 0),
      total_cost: Number(row.total_cost || 0)
    }))
  };
}

function renderMovementPdf(report, res) {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=item-movement-report.pdf");

  doc.pipe(res);

  const reportImagePath = resolveLocalReportImagePath(report.item?.itemImage);
  const headerTextWidth = reportImagePath ? 380 : 515;

  doc.fontSize(22).fillColor("#dc1c23").text("Latex Foam Store", 40, 40, { width: headerTextWidth });
  doc.fontSize(17).fillColor("#111111").text("Item Report", 40, 68, { width: headerTextWidth });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#374151").text(`From Date: ${report.header.fromDate || "-"}`, 40, 96, {
    width: headerTextWidth
  });
  doc.text(`To Date: ${report.header.toDate || "-"}`, 40, 112, { width: headerTextWidth });
  doc.text(`Date Generated: ${new Date(report.header.generatedAt).toLocaleString()}`, 40, 128, {
    width: headerTextWidth
  });

  if (reportImagePath) {
    try {
      doc.roundedRect(440, 40, 90, 90, 12).fillAndStroke("#f8fafc", "#cbd5e1");
      doc.image(reportImagePath, 446, 46, { fit: [78, 78], align: "center", valign: "center" });
    } catch (error) {
      console.warn("Failed to embed report image in PDF:", error.message);
    }
  }

  doc.y = 154;
  doc.moveDown(1);

  if (report.item) {
    doc.fontSize(12).fillColor("#111111").text(`Item Name: ${report.item.itemName}`);
    doc.text(`Item Description: ${report.item.itemDescription || "-"}`);
    doc.text(`Category: ${report.item.category || "-"}`);
    doc.text(`Unit: ${report.item.unit || "-"}`);
    doc.text(`Current Stock: ${report.item.currentStock ?? "-"} ${report.item.unit || ""}`.trim());
    doc.moveDown(1);
  }

  const columns = [40, 105, 170, 220, 300, 365, 430, 500];
  doc.fontSize(9).fillColor("#111111");
  doc.text("Date", columns[0], doc.y);
  doc.text("Type", columns[1], doc.y - 10);
  doc.text("Qty", columns[2], doc.y - 10);
  doc.text("Unit", columns[3], doc.y - 10);
  doc.text("Machine/Asset", columns[4], doc.y - 10);
  doc.text("Section", columns[5], doc.y - 10);
  doc.text("Reference", columns[6], doc.y - 10);
  doc.text("Entered By", columns[7], doc.y - 10);
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cbd5e1").stroke();
  doc.moveDown(0.5);

  report.movements.forEach((row) => {
    if (doc.y > 720) {
      doc.addPage();
    }

    const lineY = doc.y;
    doc.fontSize(8).fillColor("#374151");
    doc.text(new Date(row.date).toLocaleDateString(), columns[0], lineY);
    doc.text(row.movement_type, columns[1], lineY);
    doc.text(String(row.quantity), columns[2], lineY);
    doc.text(row.item_unit || "-", columns[3], lineY, { width: 45 });
    doc.text(row.asset || "-", columns[4], lineY, { width: 60 });
    doc.text(row.section || "-", columns[5], lineY, { width: 55 });
    doc.text(row.reference || "-", columns[6], lineY, { width: 60 });
    doc.text(row.entered_by || "-", columns[7], lineY, { width: 55 });
    doc.moveDown(1.2);
  });

  const totalValue = report.movements.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
  doc.moveDown(0.8);
  doc.fontSize(10).fillColor("#111111").text(`Total Movement Value: ${totalValue.toFixed(2)}`);

  const pageCount = doc.bufferedPageRange().count;

  for (let index = 0; index < pageCount; index += 1) {
    doc.switchToPage(index);
    doc.fontSize(9).fillColor("#6b7280");
    doc.text(`Page ${index + 1} of ${pageCount}`, 40, 780, { align: "right" });
  }

  doc.end();
}

async function exportMovementReportCsv(filters, user) {
  const report = await getMovementReport(filters, user);
  const parser = new Parser({
    fields: [
      { label: "Date", value: "date" },
      { label: "Movement Type", value: "movement_type" },
      { label: "Quantity", value: "quantity" },
      { label: "Unit", value: "item_unit" },
      { label: "Unit Cost", value: "unit_cost" },
      { label: "Total Cost", value: "total_cost" },
      { label: "Machine/Asset", value: "asset" },
      { label: "Supplier", value: "supplier" },
      { label: "Recipient", value: "recipient" },
      { label: "Location", value: "location" },
      { label: "Section", value: "section" },
      { label: "Reference", value: "reference" },
      { label: "Entered By", value: "entered_by" }
    ]
  });

  return parser.parse(report.movements);
}

async function exportMovementReportExcel(filters, user) {
  const report = await getMovementReport(filters, user);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Movements");

  sheet.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Item", key: "item_name", width: 28 },
    { header: "Movement Type", key: "movement_type", width: 18 },
    { header: "Quantity", key: "quantity", width: 14 },
    { header: "Unit", key: "item_unit", width: 12 },
    { header: "Unit Cost", key: "unit_cost", width: 14 },
    { header: "Total Cost", key: "total_cost", width: 16 },
    { header: "Location", key: "location", width: 22 },
    { header: "Section", key: "section", width: 18 },
    { header: "Reference", key: "reference", width: 24 },
    { header: "Entered By", key: "entered_by", width: 22 }
  ];

  report.movements.forEach((row) => {
    sheet.addRow({
      ...row,
      date: new Date(row.date).toLocaleString()
    });
  });

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  return workbook.xlsx.writeBuffer();
}

async function getInventoryValue(filters, user) {
  const scopedFilters = applyLocationScope(filters, user);
  const conditions = ["i.is_active = TRUE"];
  const values = [];

  if (scopedFilters.itemId) {
    values.push(scopedFilters.itemId);
    conditions.push(`i.id = $${values.length}`);
  }

  if (scopedFilters.categoryId) {
    values.push(scopedFilters.categoryId);
    conditions.push(`i.category_id = $${values.length}`);
  }

  const locationParamIndex = scopedFilters.locationId ? values.push(scopedFilters.locationId) : null;

  const result = await query(
    `
      SELECT
        i.id,
        i.name,
        i.unit,
        i.image_path AS item_image,
        COALESCE(balance.current_quantity, 0) AS current_quantity,
        COALESCE(ledger.total_purchase_value, 0) AS total_purchase_value,
        COALESCE(ledger.total_quantity_purchased, 0) AS total_quantity_purchased
      FROM items i
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(b.quantity), 0) AS current_quantity
        FROM inventory_balance b
        WHERE b.item_id = i.id
          ${locationParamIndex ? `AND b.location_id = $${locationParamIndex}` : ""}
      ) balance ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(CASE WHEN il.quantity > 0 THEN il.total_cost ELSE 0 END), 0) AS total_purchase_value,
          COALESCE(SUM(CASE WHEN il.quantity > 0 THEN il.quantity ELSE 0 END), 0) AS total_quantity_purchased
        FROM inventory_ledger il
        WHERE il.item_id = i.id
          ${locationParamIndex ? `AND il.location_id = $${locationParamIndex}` : ""}
      ) ledger ON TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY i.name
    `,
    values
  );

  return result.rows.map((row) => {
    const averageCost = calculateAverageCost(row.total_purchase_value, row.total_quantity_purchased);
    const currentQuantity = Number(row.current_quantity || 0);

    return {
      item: row.name,
      unit: row.unit,
      item_image: row.item_image,
      current_quantity: currentQuantity,
      average_cost: averageCost,
      total_value: currentQuantity * averageCost
    };
  });
}

module.exports = {
  getMovementReport,
  renderMovementPdf,
  exportMovementReportCsv,
  exportMovementReportExcel,
  getInventoryValue
};
