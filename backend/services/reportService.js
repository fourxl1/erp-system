const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { Parser } = require("json2csv");
const { query } = require("../config/db");
const { calculateAverageCost } = require("../utils/averageCost");
const { toPublicMovementType } = require("../utils/movementTypes");
const { resolveItemImageFilePath } = require("../utils/itemImage");

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
  return resolveItemImageFilePath(imagePath);
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
      JOIN items i ON i.id = sm.item_id AND i.is_active = TRUE
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

const REPORT_COLORS = {
  header: "#123c84",
  headerDark: "#0f2d63",
  accent: "#2563eb",
  ink: "#0f172a",
  muted: "#64748b",
  border: "#dbe3ef",
  softBlue: "#eff6ff",
  softSlate: "#f8fafc",
  white: "#ffffff",
  rowAlt: "#f7fbff",
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
  if (report.item) {
    return report.item;
  }

  if (!Array.isArray(report.movements) || report.movements.length === 0) {
    return null;
  }

  const uniqueKeys = [
    ...new Set(
      report.movements
        .map((row) => row.item_id || row.item_name)
        .filter(Boolean)
    )
  ];

  if (uniqueKeys.length !== 1) {
    return null;
  }

  const row = report.movements[0];
  return {
    itemId: row.item_id,
    itemName: row.item_name,
    unit: row.item_unit,
    itemDescription: row.item_description,
    category: row.category,
    itemImage: row.item_image,
    currentStock: null
  };
}

function drawLogoBadge(doc, x, y, size) {
  doc.save();
  doc.roundedRect(x, y, size, size, 18).fill("#ffffff");
  doc.roundedRect(x + 6, y + 6, size - 12, size - 12, 14).fill("#dbeafe");
  doc.font("Helvetica-Bold").fontSize(18).fillColor(REPORT_COLORS.header).text("LF", x, y + 15, {
    width: size,
    align: "center"
  });
  doc.font("Helvetica-Bold").fontSize(6).fillColor(REPORT_COLORS.accent).text("STORE", x, y + 36, {
    width: size,
    align: "center"
  });
  doc.restore();
}

function drawMetricCard(doc, { x, y, width, height, label, value, background }) {
  doc.save();
  doc.roundedRect(x, y, width, height, 18).fillAndStroke(background, REPORT_COLORS.border);
  doc.rect(x, y + height - 5, width, 5).fill(REPORT_COLORS.accent);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(REPORT_COLORS.muted).text(label.toUpperCase(), x + 16, y + 14, {
    width: width - 32
  });
  doc.font("Helvetica-Bold").fontSize(20).fillColor(REPORT_COLORS.ink).text(value, x + 16, y + 30, {
    width: width - 32
  });
  doc.restore();
}

function drawItemDetail(doc, { x, y, label, value, width }) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(REPORT_COLORS.accent).text(label.toUpperCase(), x, y, {
    width
  });
  doc.font("Helvetica").fontSize(10).fillColor(REPORT_COLORS.ink).text(value, x, y + 11, {
    width
  });
}

function drawItemSection(doc, { item, imagePath, x, y, width }) {
  const sectionHeight = 156;
  const innerPadding = 18;
  const rightBoxWidth = 156;
  const gap = 20;
  const leftWidth = width - rightBoxWidth - gap - innerPadding * 2;
  const leftX = x + innerPadding;
  const topY = y + innerPadding;
  const imageBoxX = x + width - innerPadding - rightBoxWidth;
  const imageBoxY = y + 16;
  const imageInnerX = imageBoxX + 14;
  const imageInnerY = imageBoxY + 14;
  const imageInnerSize = rightBoxWidth - 28;
  const description = normalizeDisplayText(item?.itemDescription, "No description provided.");
  const descriptionPreview =
    description.length > 110 ? `${description.slice(0, 107).trimEnd()}...` : description;

  doc.save();
  doc.roundedRect(x, y, width, sectionHeight, 22).fillAndStroke(REPORT_COLORS.white, REPORT_COLORS.border);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(REPORT_COLORS.accent).text("ITEM OVERVIEW", leftX, topY, {
    width: leftWidth
  });
  doc.font("Helvetica-Bold").fontSize(18).fillColor(REPORT_COLORS.ink).text(
    normalizeDisplayText(item?.itemName, "Multiple items in scope"),
    leftX,
    topY + 16,
    { width: leftWidth }
  );
  doc.font("Helvetica").fontSize(9).fillColor(REPORT_COLORS.muted).text(descriptionPreview, leftX, topY + 44, {
    width: leftWidth
  });

  const detailY = topY + 82;
  drawItemDetail(doc, {
    x: leftX,
    y: detailY,
    label: "Category",
    value: normalizeDisplayText(item?.category, "Uncategorized"),
    width: leftWidth / 2 - 10
  });
  drawItemDetail(doc, {
    x: leftX + leftWidth / 2 + 10,
    y: detailY,
    label: "Unit",
    value: normalizeDisplayText(item?.unit),
    width: leftWidth / 2 - 10
  });
  drawItemDetail(doc, {
    x: leftX,
    y: detailY + 38,
    label: "Current Stock",
    value:
      item?.currentStock !== null && item?.currentStock !== undefined
        ? `${formatNumber(item.currentStock)} ${item.unit || ""}`.trim()
        : "-",
    width: leftWidth
  });

  doc.roundedRect(imageBoxX, imageBoxY, rightBoxWidth, sectionHeight - 32, 18).fillAndStroke("#f8fafc", REPORT_COLORS.border);

  if (imagePath) {
    try {
      doc.image(imagePath, imageInnerX, imageInnerY, {
        fit: [imageInnerSize, imageInnerSize],
        align: "center",
        valign: "center"
      });
    } catch (error) {
      doc.font("Helvetica-Bold").fontSize(24).fillColor(REPORT_COLORS.muted).text(
        getInitials(item?.itemName, "IT"),
        imageBoxX,
        imageBoxY + 44,
        {
          width: rightBoxWidth,
          align: "center"
        }
      );
    }
  } else {
    doc.font("Helvetica-Bold").fontSize(24).fillColor(REPORT_COLORS.muted).text(
      getInitials(item?.itemName, "IT"),
      imageBoxX,
      imageBoxY + 44,
      {
        width: rightBoxWidth,
        align: "center"
      }
    );
  }

  doc.font("Helvetica").fontSize(8).fillColor(REPORT_COLORS.muted).text("Item image", imageBoxX, imageBoxY + 112, {
    width: rightBoxWidth,
    align: "center"
  });
  doc.restore();

  return sectionHeight;
}

function drawTableHeader(doc, { x, y, columns, width }) {
  doc.save();
  doc.roundedRect(x, y, width, 34, 14).fill(REPORT_COLORS.headerDark);

  let cursorX = x;
  columns.forEach((column) => {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(REPORT_COLORS.white).text(column.label, cursorX + 8, y + 12, {
      width: column.width - 16,
      align: column.align || "left"
    });
    cursorX += column.width;
  });

  doc.restore();
  return y + 42;
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
  const rowHeight = 76;
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
      doc.font("Helvetica").fontSize(7.2).fillColor(REPORT_COLORS.muted).text(formatDisplayDateTime(row.date), cellX, y + 10, {
        width: cellWidth
      });
      doc.font("Helvetica-Bold").fontSize(8.4).fillColor(REPORT_COLORS.ink).text(
        truncateText(doc, row.item_name, cellWidth, "Item"),
        cellX,
        y + 25,
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
      doc.font("Helvetica-Bold").fontSize(9).fillColor(REPORT_COLORS.ink).text(signedQuantity, cellX, y + 14, {
        width: cellWidth,
        align: "right"
      });
      doc.font("Helvetica").fontSize(7.4).fillColor(REPORT_COLORS.muted).text(
        normalizeDisplayText(row.item_unit),
        cellX,
        y + 31,
        {
          width: cellWidth,
          align: "right"
        }
      );
    }

    if (column.key === "cost") {
      doc.font("Helvetica-Bold").fontSize(8.6).fillColor(REPORT_COLORS.ink).text(formatCurrency(row.total_cost), cellX, y + 12, {
        width: cellWidth,
        align: "right"
      });
      doc.font("Helvetica").fontSize(7.2).fillColor(REPORT_COLORS.muted).text(
        `${formatCurrency(row.unit_cost)} / unit`,
        cellX,
        y + 29,
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

      doc.font("Helvetica").fontSize(7).fillColor(REPORT_COLORS.muted);
      contextLines.forEach((line, lineIndex) => {
        const renderedLine = truncateText(doc, line, cellWidth, line);
        doc.text(renderedLine, cellX, y + 10 + lineIndex * 13, { width: cellWidth });
      });
    }

    if (column.key === "responsible") {
      doc.font("Helvetica-Bold").fontSize(8.2).fillColor(REPORT_COLORS.ink).text(
        truncateText(doc, row.entered_by, cellWidth, "-"),
        cellX,
        y + 18,
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
  doc.font("Helvetica-Bold").fontSize(11).fillColor(REPORT_COLORS.ink).text("No movement data found", x, y + 20, {
    width,
    align: "center"
  });
  doc.font("Helvetica").fontSize(8.5).fillColor(REPORT_COLORS.muted).text(
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
  doc.font("Helvetica").fontSize(8).fillColor(REPORT_COLORS.muted).text(formatDisplayDateTime(generatedAt), margin, footerY, {
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
  const summaryGap = 18;
  const generatedAt = report.header?.generatedAt || new Date().toISOString();
  const reportItem = deriveScopedItem(report);
  const reportImagePath = resolveLocalReportImagePath(reportItem?.itemImage);
  const totalQuantity = report.movements.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const totalValue = report.movements.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);
  const currentStockLabel =
    reportItem?.currentStock !== null && reportItem?.currentStock !== undefined
      ? `${formatNumber(reportItem.currentStock)} ${reportItem.unit || ""}`.trim()
      : "-";
  const columns = [
    { key: "dateItem", label: "Date / Item", width: 112 },
    { key: "activity", label: "Activity", width: 76, align: "center" },
    { key: "quantity", label: "Quantity", width: 56, align: "right" },
    { key: "cost", label: "Cost", width: 86, align: "right" },
    { key: "context", label: "Context", width: 143 },
    { key: "responsible", label: "Responsible", width: 58 }
  ];

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=item-movement-report.pdf");

  doc.pipe(res);

  doc.save();
  doc.rect(0, 0, doc.page.width, 132).fill(REPORT_COLORS.header);
  doc.rect(0, 104, doc.page.width, 28).fill(REPORT_COLORS.headerDark);
  doc.restore();

  drawLogoBadge(doc, margin, 28, 54);

  const headerTextX = margin + 70;
  const headerTextWidth = contentWidth - 70;
  doc.font("Helvetica-Bold").fontSize(24).fillColor(REPORT_COLORS.white).text("Latex Foam Store", headerTextX, 30, {
    width: headerTextWidth
  });
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#dbeafe").text("Item Report", headerTextX, 60, {
    width: headerTextWidth
  });
  doc.font("Helvetica").fontSize(9).fillColor("#e2e8f0").text(
    `Generated: ${formatDisplayDateTime(generatedAt)}`,
    headerTextX,
    83,
    { width: headerTextWidth }
  );
  doc.text(
    `Reporting Window: ${formatDisplayDate(report.header?.fromDate)} to ${formatDisplayDate(report.header?.toDate)}`,
    headerTextX,
    99,
    { width: headerTextWidth }
  );

  const summaryY = 152;
  const metricWidth = (contentWidth - summaryGap) / 2;
  drawMetricCard(doc, {
    x: margin,
    y: summaryY,
    width: metricWidth,
    height: 72,
    label: "Total Quantity",
    value: formatNumber(totalQuantity),
    background: REPORT_COLORS.softBlue
  });
  drawMetricCard(doc, {
    x: margin + metricWidth + summaryGap,
    y: summaryY,
    width: metricWidth,
    height: 72,
    label: "Current Stock",
    value: currentStockLabel,
    background: REPORT_COLORS.softSlate
  });

  doc.font("Helvetica").fontSize(8.5).fillColor(REPORT_COLORS.muted).text(
    `Total movement value: ${formatCurrency(totalValue)}`,
    margin,
    summaryY + 82,
    {
      width: contentWidth,
      align: "right"
    }
  );

  let cursorY = summaryY + 102;
  cursorY += drawItemSection(doc, {
    item: reportItem,
    imagePath: reportImagePath,
    x: margin,
    y: cursorY,
    width: contentWidth
  });

  cursorY += 24;
  doc.font("Helvetica-Bold").fontSize(14).fillColor(REPORT_COLORS.ink).text("Movement History", margin, cursorY, {
    width: contentWidth / 2
  });
  doc.font("Helvetica").fontSize(9).fillColor(REPORT_COLORS.muted).text(
    "Detailed transaction log with quantity, cost, and movement context",
    margin,
    cursorY + 18,
    { width: contentWidth * 0.62 }
  );
  doc.font("Helvetica-Bold").fontSize(9).fillColor(REPORT_COLORS.accent).text(
    `${report.movements.length} rows`,
    margin + contentWidth - 80,
    cursorY + 5,
    {
      width: 80,
      align: "right"
    }
  );

  cursorY += 44;
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
      const rowHeight = 76;

      if (cursorY + rowHeight + 44 > doc.page.height) {
        doc.addPage();
        cursorY = 36;
        doc.font("Helvetica-Bold").fontSize(11).fillColor(REPORT_COLORS.ink).text("Movement History", margin, cursorY, {
          width: contentWidth
        });
        doc.font("Helvetica").fontSize(8.5).fillColor(REPORT_COLORS.muted).text(
          "Continued from previous page",
          margin,
          cursorY + 14,
          { width: contentWidth }
        );
        cursorY += 34;
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
