const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { Parser } = require("json2csv");
const { query } = require("../config/db");
const { calculateAverageCost } = require("../utils/averageCost");
const { toPublicMovementType, normalizeIncomingMovementType } = require("../utils/movementTypes");
const { resolveItemImageFilePath } = require("../utils/itemImage");
const { resolveReadLocation } = require("../utils/locationContext");

function applyLocationScope(filters, user) {
  return {
    ...filters,
    locationId: resolveReadLocation(user, filters.locationId)
  };
}

function resolveLocalReportImagePath(imagePath) {
  return resolveItemImageFilePath(imagePath);
}

function computeMovementDelta(row, locationId = null) {
  const type = String(row.movement_type || "").toUpperCase();
  const quantity = Math.abs(Number(row.quantity || 0));
  const scopedLocationId = Number(locationId || 0);

  if (type === "IN") {
    return quantity;
  }

  if (type === "OUT" || type === "MAINTENANCE" || type === "ASSET_ISSUE") {
    return quantity * -1;
  }

  if (type === "ADJUSTMENT") {
    return Number(row.quantity || 0);
  }

  if (type === "TRANSFER") {
    const status = String(row.status || "").toUpperCase();

    if (status === "REJECTED") {
      return 0;
    }

    if (
      scopedLocationId &&
      status === "COMPLETED" &&
      Number(row.destination_location_id || 0) === scopedLocationId
    ) {
      return quantity;
    }

    return quantity * -1;
  }

  return Number(row.quantity || 0);
}

async function getMovementReport(filters, user) {
  const scopedFilters = applyLocationScope(filters, user);
  const conditions = ["1 = 1"];
  const values = [];
  const normalizedMovementType = scopedFilters.movementType
    ? normalizeIncomingMovementType(scopedFilters.movementType)
    : null;

  if (scopedFilters.itemId) {
    values.push(scopedFilters.itemId);
    conditions.push(`smi.item_id = $${values.length}`);
  }

  if (scopedFilters.categoryId) {
    values.push(scopedFilters.categoryId);
    conditions.push(`i.category_id = $${values.length}`);
  }

  if (scopedFilters.locationId) {
    values.push(scopedFilters.locationId);
    conditions.push(
      `(
        sm.location_id = $${values.length}
        OR sm.source_location_id = $${values.length}
        OR sm.destination_location_id = $${values.length}
      )`
    );
  }

  if (scopedFilters.recipientId) {
    values.push(scopedFilters.recipientId);
    conditions.push(`sm.recipient_id = $${values.length}`);
  }

  if (scopedFilters.movementType && !normalizedMovementType) {
    const error = new Error("Invalid movement type filter");
    error.statusCode = 400;
    throw error;
  }

  if (normalizedMovementType) {
    values.push(normalizedMovementType);
    conditions.push(`sm.movement_type = $${values.length}`);
  }

  if (scopedFilters.startDate) {
    values.push(scopedFilters.startDate);
    conditions.push(`sm.created_at >= $${values.length}::date`);
  }

  if (scopedFilters.endDate) {
    values.push(scopedFilters.endDate);
    conditions.push(`sm.created_at < ($${values.length}::date + INTERVAL '1 day')`);
  }

  const movementResult = await query(
    `
      SELECT
        sm.created_at AS date,
        sm.movement_type,
        sm.status,
        sm.source_location_id,
        sm.destination_location_id,
        smi.quantity,
        smi.cost AS unit_cost,
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
        i.reorder_level,
        i.description AS item_description,
        i.image_path AS item_image,
        c.name AS category
      FROM stock_movements sm
      JOIN stock_movement_items smi ON smi.movement_id = sm.id
      JOIN items i ON i.id = smi.item_id AND i.is_active = TRUE
      LEFT JOIN categories c ON c.id = i.category_id
      JOIN locations l ON l.id = sm.location_id
      LEFT JOIN store_sections ss ON ss.id = sm.section_id
      LEFT JOIN assets a ON a.id = sm.asset_id
      LEFT JOIN suppliers supplier ON supplier.id = sm.supplier_id
      LEFT JOIN recipients recipient ON recipient.id = sm.recipient_id
      JOIN users performer ON performer.id = sm.performed_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY sm.created_at DESC
    `,
    values
  );

  let currentStock = null;
  let scopedItem = null;

  if (scopedFilters.itemId) {
    const inventorySnapshot = await getInventoryValue(
      {
        itemId: scopedFilters.itemId,
        categoryId: scopedFilters.categoryId,
        locationId: scopedFilters.locationId
      },
      user
    );
    currentStock = Number(inventorySnapshot[0]?.current_quantity || 0);

    const itemResult = await query(
      `
        SELECT
          i.id,
          i.name,
          i.unit,
          i.reorder_level,
          i.description,
          i.image_path,
          c.name AS category
        FROM items i
        LEFT JOIN categories c ON c.id = i.category_id
        WHERE i.id = $1
          AND i.is_active = TRUE
        LIMIT 1
      `,
      [scopedFilters.itemId]
    );

    const itemRow = itemResult.rows[0];

    if (itemRow) {
      scopedItem = {
        itemId: itemRow.id,
        itemName: itemRow.name,
        unit: itemRow.unit,
        reorderLevel: Number(itemRow.reorder_level || 0),
        itemDescription: itemRow.description,
        category: itemRow.category,
        itemImage: itemRow.image_path,
        currentStock
      };
    }
  }

  const movements = movementResult.rows.map((row) => {
    const deltaQuantity = computeMovementDelta(row, scopedFilters.locationId);
    const unitCost = Number(row.unit_cost || 0);

    return {
      ...row,
      movement_type: toPublicMovementType(row.movement_type),
      delta_quantity: deltaQuantity,
      unit_cost: unitCost,
      total_cost: deltaQuantity * unitCost
    };
  });

  const summary = movements.reduce(
    (accumulator, movement) => ({
      movement_count: accumulator.movement_count + 1,
      total_quantity_delta: accumulator.total_quantity_delta + Number(movement.delta_quantity || 0),
      total_movement_value: accumulator.total_movement_value + Number(movement.total_cost || 0)
    }),
    {
      movement_count: 0,
      total_quantity_delta: 0,
      total_movement_value: 0
    }
  );

  return {
    header: {
      companyName: "Latex Foam Store",
      reportTitle: scopedFilters.itemId ? "Item Movement Report" : "Movement History Report",
      fromDate: scopedFilters.startDate || null,
      toDate: scopedFilters.endDate || null,
      generatedAt: new Date().toISOString()
    },
    item: scopedItem,
    summary,
    movements
  };
}

const REPORT_COLORS = {
  header: "#ffffff",
  headerDark: "#f8fafc",
  accent: "#2563eb",
  ink: "#111827",
  muted: "#6b7280",
  border: "#dbe3ef",
  softBlue: "#f5f9ff",
  softSlate: "#f8fafc",
  white: "#ffffff",
  rowAlt: "#fbfdff",
  successBg: "#dcfce7",
  successText: "#166534",
  dangerBg: "#fee2e2",
  dangerText: "#b91c1c",
  neutralBg: "#e2e8f0",
  neutralText: "#334155"
};

function normalizeDisplayText(value, fallback = "-") {
  if (value === undefined || value === null) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

function formatDisplayDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatDisplayDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatNumber(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return amount.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatMovementTypeLabel(value) {
  const text = normalizeDisplayText(value);
  return text
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function truncateText(doc, value, maxWidth, fallback = "-") {
  const text = normalizeDisplayText(value, fallback);

  if (doc.widthOfString(text) <= maxWidth) {
    return text;
  }

  let truncated = text;

  while (truncated.length > 1 && doc.widthOfString(`${truncated}...`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}...`;
}

function getInitials(value, fallback = "LF") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return fallback;
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function isOutgoingMovement(row) {
  if (Number(row.delta_quantity || 0) < 0) {
    return true;
  }

  const type = String(row.movement_type || "").trim().toUpperCase();
  return type === "STOCK_OUT" || type === "MAINTENANCE" || type === "ASSET_ISSUE";
}

function getActivityChipTheme(type) {
  switch (String(type || "").trim().toUpperCase()) {
    case "STOCK_IN":
      return { background: REPORT_COLORS.successBg, text: REPORT_COLORS.successText };
    case "STOCK_OUT":
    case "MAINTENANCE":
    case "ASSET_ISSUE":
      return { background: REPORT_COLORS.dangerBg, text: REPORT_COLORS.dangerText };
    default:
      return { background: REPORT_COLORS.neutralBg, text: REPORT_COLORS.neutralText };
  }
}

function deriveScopedItem(report) {
  return report.item || null;
}

function drawLogoBadge(doc, x, y, size) {
  doc.save();
  doc.roundedRect(x, y, size, size, 16).fillAndStroke("#ffffff", REPORT_COLORS.border);
  doc.roundedRect(x + 6, y + 6, size - 12, size - 12, 12).fill("#eff6ff");
  doc.font("Helvetica-Bold").fontSize(16).fillColor(REPORT_COLORS.ink).text("LF", x, y + 13, {
    width: size,
    align: "center"
  });
  doc.font("Helvetica").fontSize(5.5).fillColor(REPORT_COLORS.muted).text("STORE", x, y + 33, {
    width: size,
    align: "center"
  });
  doc.restore();
}

function drawMetricCard(
  doc,
  {
    x,
    y,
    width,
    height,
    label,
    value,
    background,
    labelFontSize = 7.2,
    valueFontSize = 13,
    accentHeight = 3
  }
) {
  doc.save();
  doc.roundedRect(x, y, width, height, 16).fillAndStroke(background, REPORT_COLORS.border);
  doc.rect(x, y, width, accentHeight).fill(REPORT_COLORS.accent);
  doc.font("Helvetica-Bold").fontSize(labelFontSize).fillColor(REPORT_COLORS.muted).text(label.toUpperCase(), x + 12, y + 11, {
    width: width - 32
  });
  doc.font("Helvetica-Bold").fontSize(valueFontSize).fillColor(REPORT_COLORS.ink).text(value, x + 12, y + 24, {
    width: width - 24
  });
  doc.restore();
}

function drawItemDetail(doc, { x, y, label, value, width }) {
  doc.font("Helvetica-Bold").fontSize(7).fillColor(REPORT_COLORS.muted).text(label.toUpperCase(), x, y, {
    width
  });
  doc.font("Helvetica").fontSize(8.8).fillColor(REPORT_COLORS.ink).text(value, x, y + 10, {
    width
  });
}

function drawItemSection(doc, { item, imagePath, x, y, width }) {
  const sectionHeight = 96;
  const innerPadding = 14;
  const rightBoxWidth = 112;
  const gap = 16;
  const leftWidth = width - rightBoxWidth - gap - innerPadding * 2;
  const leftX = x + innerPadding;
  const topY = y + innerPadding;
  const imageBoxX = x + width - innerPadding - rightBoxWidth;
  const imageBoxY = y + 12;
  const imageInnerX = imageBoxX + 10;
  const imageInnerY = imageBoxY + 10;
  const imageInnerSize = Math.min(rightBoxWidth - 20, 78);
  const itemName = normalizeDisplayText(item?.itemName, "All Items");
  const categoryUnitParts = [normalizeDisplayText(item?.category, null), normalizeDisplayText(item?.unit, null)].filter(Boolean);
  const stockLabel =
    item?.currentStock !== null && item?.currentStock !== undefined
      ? `${formatNumber(item.currentStock)} ${item.unit || ""}`.trim()
      : "-";
  const reorderLabel =
    item?.reorderLevel !== null && item?.reorderLevel !== undefined
      ? `${formatNumber(item.reorderLevel)} ${item.unit || ""}`.trim()
      : "-";

  doc.save();
  doc.roundedRect(x, y, width, sectionHeight, 18).fillAndStroke(REPORT_COLORS.white, REPORT_COLORS.border);
  doc.font("Helvetica-Bold").fontSize(6.6).fillColor(REPORT_COLORS.muted).text("ITEM OVERVIEW", leftX, topY, {
    width: leftWidth
  });
  doc.font("Helvetica-Bold").fontSize(12).fillColor(REPORT_COLORS.ink).text(
    itemName,
    leftX,
    topY + 12,
    { width: leftWidth }
  );
  doc.font("Helvetica").fontSize(7.4).fillColor(REPORT_COLORS.muted).text(
    categoryUnitParts.length > 0 ? categoryUnitParts.join(" | ") : "Current report scope",
    leftX,
    topY + 28,
    { width: leftWidth }
  );
  doc.font("Helvetica-Bold").fontSize(7.1).fillColor(REPORT_COLORS.muted).text("STOCK", leftX, topY + 48, {
    width: 60
  });
  doc.font("Helvetica").fontSize(8.2).fillColor(REPORT_COLORS.ink).text(stockLabel, leftX, topY + 58, {
    width: leftWidth / 2
  });
  doc.font("Helvetica-Bold").fontSize(7.1).fillColor(REPORT_COLORS.muted).text(
    "REORDER",
    leftX + leftWidth / 2,
    topY + 48,
    {
      width: 70
    }
  );
  doc.font("Helvetica").fontSize(8.2).fillColor(REPORT_COLORS.ink).text(reorderLabel, leftX + leftWidth / 2, topY + 58, {
    width: leftWidth / 2
  });

  doc.roundedRect(imageBoxX, imageBoxY, rightBoxWidth, sectionHeight - 24, 14).fillAndStroke("#f8fafc", REPORT_COLORS.border);

  if (imagePath) {
    try {
      doc.image(imagePath, imageInnerX, imageInnerY, {
        fit: [imageInnerSize, imageInnerSize],
        align: "center",
        valign: "center"
      });
    } catch (error) {
      doc.font("Helvetica-Bold").fontSize(20).fillColor(REPORT_COLORS.muted).text(
        getInitials(item?.itemName, "IT"),
        imageBoxX,
        imageBoxY + 26,
        {
          width: rightBoxWidth,
          align: "center"
        }
      );
    }
  } else {
    doc.font("Helvetica-Bold").fontSize(20).fillColor(REPORT_COLORS.muted).text(
      getInitials(item?.itemName, "IT"),
      imageBoxX,
      imageBoxY + 26,
      {
        width: rightBoxWidth,
        align: "center"
      }
    );
  }

  doc.font("Helvetica").fontSize(6.8).fillColor(REPORT_COLORS.muted).text("Image", imageBoxX, imageBoxY + 66, {
    width: rightBoxWidth,
    align: "center"
  });
  doc.restore();

  return sectionHeight;
}

function drawTableHeader(
  doc,
  {
    x,
    y,
    columns,
    width,
    background = REPORT_COLORS.softSlate,
    textColor = REPORT_COLORS.ink
  }
) {
  doc.save();
  doc.roundedRect(x, y, width, 30, 12).fillAndStroke(background, REPORT_COLORS.border);

  let cursorX = x;
  columns.forEach((column) => {
    doc.font("Helvetica-Bold").fontSize(7.2).fillColor(textColor).text(column.label, cursorX + 8, y + 10, {
      width: column.width - 16,
      align: column.align || "left"
    });
    cursorX += column.width;
  });

  doc.restore();
  return y + 36;
}

function drawActivityChip(doc, { label, type, x, y, width }) {
  const theme = getActivityChipTheme(type);

  doc.font("Helvetica-Bold").fontSize(7.5);
  const maxChipWidth = width - 14;
  const measuredWidth = Math.min(maxChipWidth, Math.max(44, doc.widthOfString(label) + 20));
  const chipX = x + (width - measuredWidth) / 2;

  doc.roundedRect(chipX, y + 18, measuredWidth, 18, 9).fill(theme.background);
  doc.fillColor(theme.text).text(label, chipX, y + 24, {
    width: measuredWidth,
    align: "center"
  });
}

function drawMovementRow(doc, { row, index, x, y, width, columns }) {
  const rowHeight = 68;
  const background = index % 2 === 0 ? REPORT_COLORS.white : REPORT_COLORS.rowAlt;
  const signedQuantity = `${isOutgoingMovement(row) ? "-" : "+"}${formatNumber(row.quantity)}`;
  const activityLabel = formatMovementTypeLabel(row.movement_type);

  doc.save();
  doc.roundedRect(x, y, width, rowHeight, 16).fillAndStroke(background, REPORT_COLORS.border);

  let cursorX = x;
  columns.forEach((column, columnIndex) => {
    if (columnIndex > 0) {
      doc.moveTo(cursorX, y + 10).lineTo(cursorX, y + rowHeight - 10).strokeColor("#edf2f7").lineWidth(1).stroke();
    }

    const cellX = cursorX + 8;
    const cellWidth = column.width - 16;

    if (column.key === "dateItem") {
      doc.font("Helvetica").fontSize(6.6).fillColor(REPORT_COLORS.muted).text(formatDisplayDateTime(row.date), cellX, y + 9, {
        width: cellWidth
      });
      doc.font("Helvetica-Bold").fontSize(7.8).fillColor(REPORT_COLORS.ink).text(
        truncateText(doc, row.item_name, cellWidth, "Item"),
        cellX,
        y + 22,
        { width: cellWidth }
      );
    }

    if (column.key === "activity") {
      drawActivityChip(doc, {
        label: activityLabel,
        type: row.movement_type,
        x: cursorX,
        y,
        width: column.width
      });
    }

    if (column.key === "quantity") {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(REPORT_COLORS.ink).text(signedQuantity, cellX, y + 12, {
        width: cellWidth,
        align: "right"
      });
      doc.font("Helvetica").fontSize(6.8).fillColor(REPORT_COLORS.muted).text(
        normalizeDisplayText(row.item_unit),
        cellX,
        y + 27,
        {
          width: cellWidth,
          align: "right"
        }
      );
    }

    if (column.key === "context") {
      const contextLines = [
        `Loc: ${normalizeDisplayText(row.location, "N/A")}`,
        `Asset: ${normalizeDisplayText(row.asset, "N/A")} | Sec: ${normalizeDisplayText(row.section, "N/A")}`,
        `Supp: ${normalizeDisplayText(row.supplier, "N/A")} | Rec: ${normalizeDisplayText(row.recipient, "N/A")}`,
        `Ref: ${normalizeDisplayText(row.reference, "N/A")}`
      ];

      doc.font("Helvetica").fontSize(6.35).fillColor(REPORT_COLORS.muted);
      contextLines.forEach((line, lineIndex) => {
        const renderedLine = truncateText(doc, line, cellWidth, line);
        doc.text(renderedLine, cellX, y + 9 + lineIndex * 11, { width: cellWidth });
      });
    }

    if (column.key === "responsible") {
      doc.font("Helvetica-Bold").fontSize(7.4).fillColor(REPORT_COLORS.ink).text(
        truncateText(doc, row.entered_by, cellWidth, "-"),
        cellX,
        y + 17,
        {
          width: cellWidth
        }
      );
    }

    cursorX += column.width;
  });

  doc.restore();

  return rowHeight;
}

function drawEmptyState(doc, { x, y, width }) {
  doc.save();
  doc.roundedRect(x, y, width, 74, 16).fillAndStroke(REPORT_COLORS.white, REPORT_COLORS.border);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(REPORT_COLORS.ink).text("No movement data found", x, y + 20, {
    width,
    align: "center"
  });
  doc.font("Helvetica").fontSize(7.8).fillColor(REPORT_COLORS.muted).text(
    "Adjust the selected filters to generate a populated report export.",
    x,
    y + 38,
    {
      width,
      align: "center"
    }
  );
  doc.restore();
}

function drawFooter(doc, { margin, generatedAt, pageIndex, pageCount }) {
  const footerY = doc.page.height - 28;
  const footerWidth = doc.page.width - margin * 2;

  doc.save();
  doc.moveTo(margin, footerY - 8).lineTo(doc.page.width - margin, footerY - 8).strokeColor(REPORT_COLORS.border).lineWidth(1).stroke();
  doc.font("Helvetica").fontSize(7.2).fillColor(REPORT_COLORS.muted).text(formatDisplayDateTime(generatedAt), margin, footerY, {
    width: 150
  });
  doc.text("Generated by Inventory System", margin, footerY, {
    width: footerWidth,
    align: "center"
  });
  doc.text(`Page ${pageIndex + 1} of ${pageCount}`, doc.page.width - margin - 110, footerY, {
    width: 110,
    align: "right"
  });
  doc.restore();
}

function renderMovementPdf(report, res) {
  const doc = new PDFDocument({ size: "A4", margin: 32, bufferPages: true });
  const margin = 32;
  const contentWidth = doc.page.width - margin * 2;
  const summaryGap = 12;
  const generatedAt = report.header?.generatedAt || new Date().toISOString();
  const reportItem = deriveScopedItem(report);
  const reportImagePath = resolveLocalReportImagePath(reportItem?.itemImage);
  const totalQuantity = report.movements.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const itemsInScope = new Set(report.movements.map((row) => row.item_id).filter(Boolean)).size;
  const currentStockLabel =
    reportItem?.currentStock !== null && reportItem?.currentStock !== undefined
      ? `${formatNumber(reportItem.currentStock)} ${reportItem.unit || ""}`.trim()
      : "-";
  const columns = [
    { key: "dateItem", label: "Date / Item", width: 126 },
    { key: "activity", label: "Activity", width: 70, align: "center" },
    { key: "quantity", label: "Quantity", width: 62, align: "right" },
    { key: "context", label: "Context", width: 193 },
    { key: "responsible", label: "Responsible", width: 80 }
  ];

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${reportItem ? "item-movement-report.pdf" : "movement-history-report.pdf"}`
  );

  doc.pipe(res);

  doc.save();
  doc.rect(0, 0, doc.page.width, 3).fill(REPORT_COLORS.accent);
  doc.rect(0, 3, doc.page.width, 103).fill(REPORT_COLORS.header);
  doc.moveTo(0, 106).lineTo(doc.page.width, 106).strokeColor(REPORT_COLORS.border).lineWidth(1).stroke();
  doc.restore();

  drawLogoBadge(doc, margin, 28, 46);

  const headerTextX = margin + 62;
  const headerTextWidth = contentWidth - 70;
  doc.font("Helvetica-Bold").fontSize(18).fillColor(REPORT_COLORS.ink).text("Latex Foam Store", headerTextX, 30, {
    width: headerTextWidth
  });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(REPORT_COLORS.ink).text(
    report.header?.reportTitle || "Movement History Report",
    headerTextX,
    52,
    {
      width: headerTextWidth
    }
  );
  doc.font("Helvetica").fontSize(7.8).fillColor(REPORT_COLORS.muted).text(
    `Generated: ${formatDisplayDateTime(generatedAt)}`,
    headerTextX,
    70,
    { width: headerTextWidth }
  );
  doc.text(
    `Reporting Window: ${formatDisplayDate(report.header?.fromDate)} to ${formatDisplayDate(report.header?.toDate)}`,
    headerTextX,
    84,
    { width: headerTextWidth }
  );

  const summaryY = 122;
  const metricWidth = (contentWidth - summaryGap * 2) / 3;
  drawMetricCard(doc, {
    x: margin,
    y: summaryY,
    width: metricWidth,
    height: 46,
    label: "Total Quantity",
    value: formatNumber(totalQuantity),
    background: REPORT_COLORS.softBlue,
    valueFontSize: 10.8
  });
  drawMetricCard(doc, {
    x: margin + metricWidth + summaryGap,
    y: summaryY,
    width: metricWidth,
    height: 46,
    label: reportItem ? "Current Stock" : "Items in Scope",
    value: reportItem ? currentStockLabel : formatNumber(itemsInScope),
    background: REPORT_COLORS.softSlate,
    valueFontSize: 10.8
  });
  drawMetricCard(doc, {
    x: margin + (metricWidth + summaryGap) * 2,
    y: summaryY,
    width: metricWidth,
    height: 46,
    label: "Entries",
    value: formatNumber(report.movements.length),
    background: REPORT_COLORS.softSlate,
    valueFontSize: 10.8
  });

  let cursorY = summaryY + 58;
  cursorY += drawItemSection(doc, {
    item: reportItem,
    imagePath: reportImagePath,
    x: margin,
    y: cursorY,
    width: contentWidth
  });

  cursorY += 18;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(REPORT_COLORS.ink).text("Movement History", margin, cursorY, {
    width: contentWidth / 2
  });
  doc.font("Helvetica").fontSize(7.8).fillColor(REPORT_COLORS.muted).text(
    "Detailed transaction log with quantity and movement context",
    margin,
    cursorY + 15,
    { width: contentWidth * 0.62 }
  );
  doc.font("Helvetica-Bold").fontSize(8).fillColor(REPORT_COLORS.accent).text(
    `${report.movements.length} rows`,
    margin + contentWidth - 80,
    cursorY + 3,
    {
      width: 80,
      align: "right"
    }
  );

  cursorY += 34;
  cursorY = drawTableHeader(doc, {
    x: margin,
    y: cursorY,
    columns,
    width: contentWidth
  });

  if (report.movements.length === 0) {
    drawEmptyState(doc, { x: margin, y: cursorY, width: contentWidth });
  } else {
    report.movements.forEach((row, index) => {
      const rowHeight = 68;

      if (cursorY + rowHeight + 44 > doc.page.height) {
        doc.addPage();
        cursorY = 36;
        doc.font("Helvetica-Bold").fontSize(10).fillColor(REPORT_COLORS.ink).text("Movement History", margin, cursorY, {
          width: contentWidth
        });
        doc.font("Helvetica").fontSize(7.6).fillColor(REPORT_COLORS.muted).text(
          "Continued from previous page",
          margin,
          cursorY + 13,
          { width: contentWidth }
        );
        cursorY += 28;
        cursorY = drawTableHeader(doc, {
          x: margin,
          y: cursorY,
          columns,
          width: contentWidth
        });
      }

      cursorY += drawMovementRow(doc, {
        row,
        index,
        x: margin,
        y: cursorY,
        width: contentWidth,
        columns
      });
      cursorY += 8;
    });
  }

  const pageCount = doc.bufferedPageRange().count;

  for (let index = 0; index < pageCount; index += 1) {
    doc.switchToPage(index);
    drawFooter(doc, {
      margin,
      generatedAt,
      pageIndex: index,
      pageCount
    });
  }

  doc.end();
}

function buildInventoryValueReport(rows, filters = {}) {
  const totalQuantity = rows.reduce((sum, row) => sum + Number(row.current_quantity || 0), 0);
  const totalValue = rows.reduce((sum, row) => sum + Number(row.total_value || 0), 0);
  const scopeLabel =
    filters.itemId && rows[0]?.item
      ? rows[0].item
      : "All Items";

  return {
    header: {
      companyName: "Latex Foam Store",
      reportTitle: "Inventory Valuation",
      generatedAt: new Date().toISOString(),
      scopeLabel
    },
    summary: {
      itemCount: rows.length,
      totalQuantity,
      totalValue
    },
    rows
  };
}

function drawInventoryValueRow(doc, { row, index, x, y, width, columns }) {
  const rowHeight = 42;
  const background = index % 2 === 0 ? REPORT_COLORS.white : REPORT_COLORS.rowAlt;

  doc.save();
  doc.roundedRect(x, y, width, rowHeight, 12).fillAndStroke(background, REPORT_COLORS.border);

  let cursorX = x;
  columns.forEach((column) => {
    const cellX = cursorX + 8;
    const cellWidth = column.width - 16;
    let value = "-";

    if (column.key === "item") {
      value = truncateText(doc, row.item, cellWidth, "Item");
    } else if (column.key === "unit") {
      value = normalizeDisplayText(row.unit);
    } else if (column.key === "quantity") {
      value = formatNumber(row.current_quantity);
    } else if (column.key === "average_cost") {
      value = formatCurrency(row.average_cost);
    } else if (column.key === "total_value") {
      value = formatCurrency(row.total_value);
    }

    doc.font(column.key === "item" || column.key === "total_value" ? "Helvetica-Bold" : "Helvetica")
      .fontSize(7.6)
      .fillColor(REPORT_COLORS.ink)
      .text(value, cellX, y + 15, {
        width: cellWidth,
        align: column.align || "left"
      });

    cursorX += column.width;
  });

  doc.restore();
  return rowHeight;
}

function renderInventoryValuePdf(report, res) {
  const doc = new PDFDocument({ size: "A4", margin: 32, bufferPages: true });
  const margin = 32;
  const contentWidth = doc.page.width - margin * 2;
  const generatedAt = report.header?.generatedAt || new Date().toISOString();
  const summaryGap = 12;
  const metricWidth = (contentWidth - summaryGap * 2) / 3;
  const columns = [
    { key: "item", label: "Item", width: 223 },
    { key: "unit", label: "Unit", width: 64 },
    { key: "quantity", label: "Quantity", width: 74, align: "right" },
    { key: "average_cost", label: "Avg Cost", width: 84, align: "right" },
    { key: "total_value", label: "Total Value", width: 86, align: "right" }
  ];

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=inventory-valuation-report.pdf");

  doc.pipe(res);

  doc.save();
  doc.rect(0, 0, doc.page.width, 3).fill(REPORT_COLORS.accent);
  doc.rect(0, 3, doc.page.width, 96).fill(REPORT_COLORS.white);
  doc.moveTo(0, 99).lineTo(doc.page.width, 99).strokeColor(REPORT_COLORS.border).lineWidth(1).stroke();
  doc.restore();

  drawLogoBadge(doc, margin, 24, 42);

  const headerTextX = margin + 56;
  doc.font("Helvetica-Bold").fontSize(17).fillColor(REPORT_COLORS.ink).text("Latex Foam Store", headerTextX, 26, {
    width: contentWidth - 56
  });
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(REPORT_COLORS.ink).text("Inventory Valuation", headerTextX, 47, {
    width: contentWidth - 56
  });
  doc.font("Helvetica").fontSize(7.8).fillColor(REPORT_COLORS.muted).text(
    `Scope: ${report.header?.scopeLabel || "All Items"}`,
    headerTextX,
    64,
    { width: contentWidth - 56 }
  );
  doc.text(`Generated: ${formatDisplayDateTime(generatedAt)}`, headerTextX, 78, {
    width: contentWidth - 56
  });

  const summaryY = 114;
  drawMetricCard(doc, {
    x: margin,
    y: summaryY,
    width: metricWidth,
    height: 50,
    label: "Items",
    value: formatNumber(report.summary.itemCount),
    background: REPORT_COLORS.softSlate,
    valueFontSize: 11.5
  });
  drawMetricCard(doc, {
    x: margin + metricWidth + summaryGap,
    y: summaryY,
    width: metricWidth,
    height: 50,
    label: "Total Quantity",
    value: formatNumber(report.summary.totalQuantity),
    background: REPORT_COLORS.softBlue,
    valueFontSize: 11.5
  });
  drawMetricCard(doc, {
    x: margin + (metricWidth + summaryGap) * 2,
    y: summaryY,
    width: metricWidth,
    height: 50,
    label: "Total Value",
    value: formatCurrency(report.summary.totalValue),
    background: REPORT_COLORS.softSlate,
    valueFontSize: 10.8
  });

  let cursorY = summaryY + 70;
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(REPORT_COLORS.ink).text("Valuation Detail", margin, cursorY, {
    width: contentWidth / 2
  });
  doc.font("Helvetica").fontSize(7.6).fillColor(REPORT_COLORS.muted).text(
    "Current quantity, average cost, and total value by item",
    margin,
    cursorY + 14,
    { width: contentWidth }
  );

  cursorY += 30;
  cursorY = drawTableHeader(doc, {
    x: margin,
    y: cursorY,
    columns,
    width: contentWidth
  });

  if (report.rows.length === 0) {
    drawEmptyState(doc, { x: margin, y: cursorY, width: contentWidth });
  } else {
    report.rows.forEach((row, index) => {
      const rowHeight = 42;

      if (cursorY + rowHeight + 44 > doc.page.height) {
        doc.addPage();
        cursorY = 36;
        cursorY = drawTableHeader(doc, {
          x: margin,
          y: cursorY,
          columns,
          width: contentWidth
        });
      }

      cursorY += drawInventoryValueRow(doc, {
        row,
        index,
        x: margin,
        y: cursorY,
        width: contentWidth,
        columns
      });
      cursorY += 6;
    });
  }

  const pageCount = doc.bufferedPageRange().count;

  for (let index = 0; index < pageCount; index += 1) {
    doc.switchToPage(index);
    drawFooter(doc, {
      margin,
      generatedAt,
      pageIndex: index,
      pageCount
    });
  }

  doc.end();
}

async function exportMovementReportCsv(filters, user) {
  const report = await getMovementReport(filters, user);
  const parser = new Parser({
    fields: [
      { label: "Date", value: "date" },
      { label: "Item", value: "item_name" },
      { label: "Movement Type", value: "movement_type" },
      { label: "Quantity", value: "quantity" },
      { label: "Unit", value: "item_unit" },
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

async function exportInventoryValueCsv(filters, user) {
  const rows = await getInventoryValue(filters, user);
  const parser = new Parser({
    fields: [
      { label: "Item", value: "item" },
      { label: "Unit", value: "unit" },
      { label: "Current Quantity", value: "current_quantity" },
      { label: "Average Cost", value: "average_cost" },
      { label: "Total Value", value: "total_value" }
    ]
  });

  return parser.parse(rows);
}

async function exportInventoryValueExcel(filters, user) {
  const rows = await getInventoryValue(filters, user);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventory Valuation");

  sheet.columns = [
    { header: "Item", key: "item", width: 34 },
    { header: "Unit", key: "unit", width: 12 },
    { header: "Current Quantity", key: "current_quantity", width: 18 },
    { header: "Average Cost", key: "average_cost", width: 16 },
    { header: "Total Value", key: "total_value", width: 18 }
  ];

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  return workbook.xlsx.writeBuffer();
}

async function exportInventoryValuePdf(filters, user, res) {
  const rows = await getInventoryValue(filters, user);
  const report = buildInventoryValueReport(rows, filters);
  return renderInventoryValuePdf(report, res);
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
      WITH movement_contributions AS (
        SELECT
          smi.item_id,
          sm.location_id,
          CASE
            WHEN sm.movement_type = 'IN' THEN ABS(smi.quantity)
            WHEN sm.movement_type IN ('OUT', 'MAINTENANCE', 'ASSET_ISSUE') THEN ABS(smi.quantity) * -1
            WHEN sm.movement_type = 'ADJUSTMENT' THEN smi.quantity
            ELSE 0
          END AS quantity_delta,
          CASE
            WHEN sm.movement_type = 'IN' THEN ABS(smi.quantity) * COALESCE(smi.cost, 0)
            WHEN sm.movement_type = 'ADJUSTMENT' AND smi.quantity > 0 THEN ABS(smi.quantity) * COALESCE(smi.cost, 0)
            ELSE 0
          END AS inbound_value,
          CASE
            WHEN sm.movement_type = 'IN' THEN ABS(smi.quantity)
            WHEN sm.movement_type = 'ADJUSTMENT' AND smi.quantity > 0 THEN ABS(smi.quantity)
            ELSE 0
          END AS inbound_quantity
        FROM stock_movements sm
        JOIN stock_movement_items smi ON smi.movement_id = sm.id
        WHERE sm.movement_type <> 'TRANSFER'

        UNION ALL

        SELECT
          smi.item_id,
          sm.source_location_id AS location_id,
          CASE
            WHEN sm.status = 'REJECTED' THEN 0
            ELSE ABS(smi.quantity) * -1
          END AS quantity_delta,
          0 AS inbound_value,
          0 AS inbound_quantity
        FROM stock_movements sm
        JOIN stock_movement_items smi ON smi.movement_id = sm.id
        WHERE sm.movement_type = 'TRANSFER'

        UNION ALL

        SELECT
          smi.item_id,
          sm.destination_location_id AS location_id,
          CASE
            WHEN sm.status = 'COMPLETED' THEN ABS(smi.quantity)
            ELSE 0
          END AS quantity_delta,
          CASE
            WHEN sm.status = 'COMPLETED' THEN ABS(smi.quantity) * COALESCE(smi.cost, 0)
            ELSE 0
          END AS inbound_value,
          CASE
            WHEN sm.status = 'COMPLETED' THEN ABS(smi.quantity)
            ELSE 0
          END AS inbound_quantity
        FROM stock_movements sm
        JOIN stock_movement_items smi ON smi.movement_id = sm.id
        WHERE sm.movement_type = 'TRANSFER'
      )
      SELECT
        i.id,
        i.name,
        i.unit,
        i.image_path AS item_image,
        COALESCE(SUM(mc.quantity_delta), 0) AS current_quantity,
        COALESCE(SUM(mc.inbound_value), 0) AS total_purchase_value,
        COALESCE(SUM(mc.inbound_quantity), 0) AS total_quantity_purchased
      FROM items i
      LEFT JOIN movement_contributions mc
        ON mc.item_id = i.id
        ${locationParamIndex ? `AND mc.location_id = $${locationParamIndex}` : ""}
      WHERE ${conditions.join(" AND ")}
      GROUP BY i.id, i.name, i.unit, i.image_path
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
  exportInventoryValueCsv,
  exportInventoryValueExcel,
  exportInventoryValuePdf,
  getInventoryValue
};
