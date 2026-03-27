import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  downloadMovementReportCsv,
  downloadMovementReportExcel,
  downloadMovementReportPdf,
  fetchCategories,
  fetchInventoryValueReport,
  fetchItems,
  fetchLocations,
  fetchMovementReport,
  fetchRecipients,
  resolveApiUrl
} from "../services/api";
import { formatMovementType } from "../utils/movementTypes";

function getImageSrc(path) {
  return path ? resolveApiUrl(path) : "";
}

function isOutgoingMovement(movement) {
  if (Number(movement.delta_quantity || 0) < 0) {
    return true;
  }

  const normalizedType = String(movement.movement_type || "").trim().toUpperCase();
  return normalizedType === "STOCK_OUT" || normalizedType === "MAINTENANCE" || normalizedType === "ASSET_ISSUE";
}

function Reports() {
  const [inventoryValue, setInventoryValue] = useState([]);
  const [report, setReport] = useState({ header: null, item: null, movements: [] });
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [filters, setFilters] = useState({
    item_id: "",
    category_id: "",
    recipient_id: "",
    location_id: "",
    movement_type: "",
    start_date: "",
    end_date: ""
  });

  const loadData = useCallback(async (activeFilters) => {
    try {
      setLoading(true);
      const [valueData, movementData, itemData, categoryData, locationData, recipientData] = await Promise.all([
        fetchInventoryValueReport(activeFilters),
        fetchMovementReport(activeFilters),
        fetchItems(),
        fetchCategories(),
        fetchLocations(),
        fetchRecipients()
      ]);

      setInventoryValue(Array.isArray(valueData) ? valueData : []);
      setReport(movementData || { header: null, item: null, movements: [] });
      setItems(itemData.items || []);
      setCategories(Array.isArray(categoryData) ? categoryData : []);
      setLocations(Array.isArray(locationData) ? locationData : []);
      setRecipients(Array.isArray(recipientData) ? recipientData : []);
      setError("");
    } catch (loadError) {
      console.error("Failed to load reports", loadError);
      setInventoryValue([]);
      setReport({ header: null, item: null, movements: [] });
      setError(loadError.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(filters);
  }, [filters, loadData]);

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  async function handleExport(action) {
    try {
      await action(filters);
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to export report");
    }
  }

  const totalValuation = inventoryValue.reduce((sum, row) => sum + Number(row.total_value || 0), 0);
  const totalMovementValue = report.movements.reduce((sum, row) => sum + Number(row.total_cost || 0), 0);

  const movementTypeOptions = useMemo(
    () => [
      { value: "", label: "All Types" },
      { value: "STOCK_IN", label: "STOCK_IN" },
      { value: "STOCK_OUT", label: "STOCK_OUT" },
      { value: "TRANSFER", label: "TRANSFER" },
      { value: "ADJUSTMENT", label: "ADJUSTMENT" },
      { value: "MAINTENANCE", label: "MAINTENANCE" },
      { value: "ASSET_ISSUE", label: "ASSET_ISSUE" }
    ],
    []
  );

  return (
    <DashboardLayout>
      <div className="inventory-shell space-y-6">
        <section className="inventory-hero">
          <div className="inventory-hero__content">
            <p className="inventory-hero__eyebrow">Analytics Center</p>
            <h2 className="inventory-hero__title">Inventory and Movement Intelligence</h2>
            <p className="inventory-hero__copy">
              Monitor valuation, track stock flow, inspect report images, and export professional reports.
            </p>
          </div>
          <div className="inventory-hero__stats">
            <article>
              <p>Total Valuation</p>
              <strong>
                ${totalValuation.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </strong>
            </article>
            <article>
              <p>Movement Value</p>
              <strong>${totalMovementValue.toFixed(2)}</strong>
            </article>
            <article>
              <p>Rows in Scope</p>
              <strong>{report.movements.length}</strong>
            </article>
          </div>
        </section>

        {error ? (
          <div className="dashboard-card__alert dashboard-card__alert--error">
            <span>{error}</span>
            <button onClick={() => setError("")} className="alert-close">
              x
            </button>
          </div>
        ) : null}

        <section className="inventory-card">
          <div className="inventory-card__header">
            <div>
              <p className="dashboard-card__eyebrow">Parameter Selection</p>
              <h3>Report Configuration</h3>
            </div>
          </div>

          <div className="inventory-card__body">
            <div className="admin-grid admin-grid--reports" style={{ gap: "1.5rem" }}>
              <label className="field">
                <span>Target Item</span>
                <select name="item_id" value={filters.item_id} onChange={handleFilterChange} className="inventory-input">
                  <option value="">All Items</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Category</span>
                <select name="category_id" value={filters.category_id} onChange={handleFilterChange} className="inventory-input">
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Location</span>
                <select name="location_id" value={filters.location_id} onChange={handleFilterChange} className="inventory-input">
                  <option value="">All Locations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Recipient</span>
                <select name="recipient_id" value={filters.recipient_id} onChange={handleFilterChange} className="inventory-input">
                  <option value="">All Recipients</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.full_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Activity Type</span>
                <select
                  name="movement_type"
                  value={filters.movement_type}
                  onChange={handleFilterChange}
                  className="inventory-input"
                >
                  {movementTypeOptions.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Start Date</span>
                <input type="date" name="start_date" value={filters.start_date} onChange={handleFilterChange} className="inventory-input" />
              </label>

              <label className="field">
                <span>End Date</span>
                <input type="date" name="end_date" value={filters.end_date} onChange={handleFilterChange} className="inventory-input" />
              </label>

              <div style={{ alignSelf: "end" }}>
                <button type="button" className="primary-button" style={{ width: "100%" }} onClick={() => loadData(filters)} disabled={loading}>
                  {loading ? "Processing..." : "Generate Analysis"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="inventory-panel">
          <div className="inventory-panel__header">
            <div>
              <p className="dashboard-card__eyebrow">Financial Snapshot</p>
              <h3>Inventory Valuation</h3>
            </div>
          </div>
          <div className="inventory-table-wrapper">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Item</th>
                  <th>Unit</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Avg Cost</th>
                  <th className="text-right">Total Value</th>
                </tr>
              </thead>
              <tbody>
                {inventoryValue.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      No valuation data found.
                    </td>
                  </tr>
                ) : (
                  inventoryValue.map((row) => {
                    const imageSrc = getImageSrc(row.item_image);

                    return (
                      <tr key={row.item}>
                        <td>
                          {imageSrc ? (
                            <button
                              type="button"
                              className="report-thumb"
                              onClick={() => setPreviewImage({ src: imageSrc, alt: row.item })}
                            >
                              <img src={imageSrc} alt={row.item} />
                            </button>
                          ) : (
                            <div className="report-thumb report-thumb--empty">{row.item.charAt(0).toUpperCase()}</div>
                          )}
                        </td>
                        <td>{row.item}</td>
                        <td>{row.unit || "-"}</td>
                        <td className="text-right">
                          <strong>{row.current_quantity}</strong>
                        </td>
                        <td className="text-right">${Number(row.average_cost || 0).toFixed(2)}</td>
                        <td className="text-right">
                          <strong>${Number(row.total_value || 0).toFixed(2)}</strong>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="inventory-panel">
          <div className="inventory-panel__header">
            <div>
              <p className="dashboard-card__eyebrow">Activity Logs</p>
              <h3>Movement History</h3>
            </div>
            <div className="inventory-card__actions">
              <button type="button" className="secondary-button secondary-button--small" onClick={() => handleExport(downloadMovementReportPdf)}>
                Export PDF
              </button>
              <button type="button" className="secondary-button secondary-button--small" onClick={() => handleExport(downloadMovementReportCsv)}>
                Export CSV
              </button>
              <button type="button" className="secondary-button secondary-button--small" onClick={() => handleExport(downloadMovementReportExcel)}>
                Export Excel
              </button>
            </div>
          </div>

          {report.header ? (
            <div className="report-context-bar">
              <div className="report-context-bar__main">
                <div>
                  <small className="report-context-bar__eyebrow">{report.header.reportTitle}</small>
                  <strong className="report-context-bar__company">{report.header.companyName}</strong>
                </div>

                {report.item ? (
                  <div className="report-context-bar__item">
                    <div className="report-context-bar__thumb">
                      {report.item.itemImage ? (
                        <img src={getImageSrc(report.item.itemImage)} alt={report.item.itemName} />
                      ) : (
                        <span>{report.item.itemName?.charAt(0).toUpperCase() || "?"}</span>
                      )}
                    </div>
                    <div className="report-context-bar__item-meta">
                      <strong>{report.item.itemName}</strong>
                      <span>
                        {report.item.category || "Uncategorized"}{report.item.unit ? ` • ${report.item.unit}` : ""}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="report-context-bar__range">
                <small>Date Range</small>
                <span>
                  {report.header.fromDate || "Start"} to {report.header.toDate || "End"}
                </span>
              </div>
            </div>
          ) : null}

          <div className="inventory-table-wrapper">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Date and Item</th>
                  <th className="text-center">Activity</th>
                  <th className="text-right">Quantity</th>
                  <th>Unit</th>
                  <th className="text-right">Cost</th>
                  <th>Metadata</th>
                  <th>Responsible</th>
                </tr>
              </thead>
              <tbody>
                {report.movements?.length ? (
                  report.movements.map((movement, index) => {
                    const movementType = formatMovementType(movement.movement_type);
                    const imageSrc = getImageSrc(movement.item_image);
                    const outgoing = isOutgoingMovement(movement);

                    return (
                      <tr key={`${movement.date}-${movement.item_id || index}`}>
                        <td>
                          {imageSrc ? (
                            <button
                              type="button"
                              className="report-thumb"
                              onClick={() =>
                                setPreviewImage({
                                  src: imageSrc,
                                  alt: movement.item_name
                                })
                              }
                            >
                              <img src={imageSrc} alt={movement.item_name} />
                            </button>
                          ) : (
                            <div className="report-thumb report-thumb--empty">
                              {movement.item_name?.charAt(0).toUpperCase() || "?"}
                            </div>
                          )}
                        </td>
                        <td style={{ minWidth: "220px" }}>
                          <div style={{ fontSize: "0.75rem", color: "var(--brand-muted)", marginBottom: "0.25rem" }}>
                            {new Date(movement.date).toLocaleString()}
                          </div>
                          <strong>{movement.item_name}</strong>
                        </td>
                        <td className="text-center">
                          <span
                            className={`status-chip status-chip--${
                              movementType === "STOCK_IN"
                                ? "fulfilled"
                                : movementType === "STOCK_OUT"
                                  ? "rejected"
                                  : "pending"
                            }`}
                          >
                            {movementType}
                          </span>
                        </td>
                        <td className="text-right">
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "1.1rem",
                              color: outgoing ? "#b91c1c" : "#15803d"
                            }}
                          >
                            {outgoing ? "-" : "+"}
                            {movement.quantity}
                          </span>
                        </td>
                        <td>{movement.item_unit || "-"}</td>
                        <td className="text-right">
                          <div>${Number(movement.unit_cost || 0).toFixed(2)}</div>
                          <strong>${Number(movement.total_cost || 0).toFixed(2)}</strong>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{movement.asset || "No Asset"}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--brand-muted)" }}>
                            Ref: {movement.reference || "N/A"}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--brand-muted)" }}>
                            Sec: {movement.section || "N/A"}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--brand-muted)" }}>
                            Recipient: {movement.recipient || "N/A"}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: "0.85rem" }}>{movement.entered_by}</div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      No movement data found matching selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {previewImage ? (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="report-lightbox" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="report-lightbox__close" onClick={() => setPreviewImage(null)}>
              x
            </button>
            <img src={previewImage.src} alt={previewImage.alt} />
            <p>{previewImage.alt}</p>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

export default Reports;
