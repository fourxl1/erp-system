const ExcelJS = require("exceljs");

const exportInventoryToExcel = async (items) => {

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventory Report");

    worksheet.columns = [
        { header: "ID", key: "id", width: 10 },
        { header: "Item Name", key: "name", width: 30 },
        { header: "Category", key: "category", width: 20 },
        { header: "Supplier", key: "supplier", width: 24 },
        { header: "Unit", key: "unit", width: 10 },
        { header: "Quantity", key: "quantity", width: 15 },
        { header: "Minimum Qty", key: "minimum_quantity", width: 15 }
    ];

  items.forEach(item => {
  worksheet.addRow({
    id: item.id,
    name: item.name,
    category: item.category,
    supplier: item.supplier,
    unit: item.unit,
    quantity: item.quantity || item.current_quantity,
    minimum_quantity: item.minimum_quantity
  });
});

    return workbook;
};
const { Parser } = require("json2csv");

const exportToCSV = (data) => {
  const json2csv = new Parser();
  return json2csv.parse(data);
};
const PDFDocument = require("pdfkit");

const exportToPDF = (data, res) => {

  const doc = new PDFDocument({ margin: 30, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=report.pdf"
  );

  doc.pipe(res);

  doc.fontSize(18).text("Inventory Report", { align: "center" });
  doc.moveDown();

  data.forEach(item => {

    doc.fontSize(10).text(
      `${item.name} | Supplier: ${item.supplier || "-"} | Qty: ${item.quantity || item.current_quantity}`
    );

  });

  doc.end();

};
module.exports = {
    exportInventoryToExcel,
    exportToCSV,
    exportToPDF
};
