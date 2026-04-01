import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import ItemIdentity from "../components/ItemIdentity";
import {
  createInventoryCount,
  deleteStockMovement,
  createStockMovement,
  fetchAssets,
  fetchDailyMovements,
  fetchItems,
  fetchLocations,
  fetchRecipients,
  fetchSections,
  fetchSuppliers,
  postInventoryCount,
  updateStockMovement
} from "../services/api";
import { formatMovementType, MOVEMENT_TYPE_OPTIONS } from "../utils/movementTypes";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("inventory-user-data") || "{}");
  } catch {
    return {};
  }
}

function normalizeRoleName(roleName) {
  return String(roleName || "").trim().toLowerCase();
}

function toDateTimeInputValue(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const localTime = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
}

function getTodayDateValue() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function createEmptyMovementForm(fixedLocationId = "") {
  return {
    item_id: "",
    movement_type: "STOCK_IN",
    location_id: fixedLocationId,
    source_location_id: fixedLocationId,
    destination_location_id: "",
    section_id: "",
    asset_id: "",
    recipient_id: "",
    supplier_id: "",
    adjustment_direction: "INCREASE",
    quantity: "",
    unit_cost: "",
    reference: "",
    created_at: ""
  };
}

function StockMovements() {
  const currentUser = readStoredUser();
  const currentRole = normalizeRoleName(currentUser.role_name);
  const fixedLocationId =
    currentRole === "superadmin" ? "" : String(currentUser.location_id || "");
  const isLocationBound = Boolean(fixedLocationId);
  const canEditMovements = currentRole === "admin" || currentRole === "superadmin";
  const canPostCounts = currentRole === "admin" || currentRole === "superadmin";

  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sections, setSections] = useState([]);
  const [assets, setAssets] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [dailyFilters, setDailyFilters] = useState(() => ({
    start_date: getTodayDateValue(),
    end_date: getTodayDateValue(),
    location_id: fixedLocationId,
    movement_type: ""
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingMovementId, setEditingMovementId] = useState(null);
  const [formData, setFormData] = useState(() => createEmptyMovementForm(fixedLocationId));
  const [countData, setCountData] = useState({
    location_id: fixedLocationId,
    item_id: "",
    counted_quantity: ""
  });

  const itemScopeLocationId = useMemo(() => {
    if (formData.movement_type === "TRANSFER") {
      return formData.source_location_id || fixedLocationId;
    }

    return formData.location_id || fixedLocationId;
  }, [fixedLocationId, formData.location_id, formData.movement_type, formData.source_location_id]);

  const selectedLocationName = useMemo(
    () => locations.find((location) => String(location.id) === String(fixedLocationId))?.name || "Assigned Store",
    [fixedLocationId, locations]
  );

  const loadReferences = useCallback(async (activeLocationId = "") => {
    try {
      const itemParams = activeLocationId ? { location_id: activeLocationId } : {};
      const assetLocationId = activeLocationId || fixedLocationId;
      const [itemData, locationData, assetData, recipientData, supplierData] = await Promise.all([
        fetchItems(itemParams),
        fetchLocations(),
        fetchAssets(assetLocationId ? Number(assetLocationId) : undefined),
        fetchRecipients(),
        fetchSuppliers()
      ]);

      setItems(itemData.items || []);
      setLocations(Array.isArray(locationData) ? locationData : []);
      setAssets(Array.isArray(assetData) ? assetData : []);
      setRecipients(Array.isArray(recipientData) ? recipientData : []);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setError("");
    } catch (loadError) {
      console.error("Failed to load movement references", loadError);
      setError(loadError.message || "Failed to load movement references");
    }
  }, [fixedLocationId]);

  const loadDailyMovements = useCallback(async (selectedFilters = {}) => {
    try {
      const data = await fetchDailyMovements(selectedFilters);
      setMovements(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error("Failed to load daily movements", loadError);
      setMovements([]);
      setError(loadError.message || "Failed to load daily movements");
    }
  }, []);

  useEffect(() => {
    void loadReferences(itemScopeLocationId);
  }, [itemScopeLocationId, loadReferences]);

  useEffect(() => {
    void loadDailyMovements(dailyFilters);
  }, [dailyFilters, loadDailyMovements]);

  useEffect(() => {
    if (!editingMovementId) {
      setFormData((current) => ({
        ...current,
        location_id: fixedLocationId || current.location_id,
        source_location_id: fixedLocationId || current.source_location_id
      }));
      setCountData((current) => ({
        ...current,
        location_id: fixedLocationId || current.location_id
      }));
    }
  }, [editingMovementId, fixedLocationId]);

  useEffect(() => {
    const sectionLocationId =
      formData.movement_type === "TRANSFER"
        ? formData.source_location_id || fixedLocationId
        : formData.location_id || fixedLocationId;

    if (!sectionLocationId) {
      setSections([]);
      return;
    }

    fetchSections(Number(sectionLocationId))
      .then((data) => setSections(Array.isArray(data) ? data : []))
      .catch((loadError) => {
        console.error(loadError);
        setSections([]);
      });
  }, [fixedLocationId, formData.location_id, formData.movement_type, formData.source_location_id]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => {
      const next = { ...current, [name]: value };

      if (name === "movement_type") {
        if (value === "TRANSFER") {
          next.source_location_id = fixedLocationId || current.location_id || "";
          next.location_id = fixedLocationId || current.location_id || "";
          next.section_id = "";
          next.asset_id = "";
          next.recipient_id = "";
          next.supplier_id = "";
        } else {
          next.location_id = fixedLocationId || current.location_id || "";
          next.source_location_id = fixedLocationId || current.source_location_id || "";
          next.destination_location_id = "";
        }
      }

      if (name === "location_id") {
        next.section_id = "";
        next.asset_id = "";
      }

      if (name === "source_location_id") {
        next.section_id = "";
        next.asset_id = "";
        if (value === current.destination_location_id) {
          next.destination_location_id = "";
        }
      }

      return next;
    });
  }

  function resetMovementForm() {
    setEditingMovementId(null);
    setFormData(createEmptyMovementForm(fixedLocationId));
  }

  function handleDailyFilterChange(event) {
    const { name, value } = event.target;
    setDailyFilters((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSubmit() {
    if (!formData.item_id || !formData.quantity) {
      setError("Item and quantity are required");
      return;
    }

    if (!itemScopeLocationId) {
      setError("Location is required for this movement");
      return;
    }

    if (
      formData.movement_type === "TRANSFER" &&
      (!formData.source_location_id || !formData.destination_location_id)
    ) {
      setError("Source and destination locations are required for transfers");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        ...formData,
        location_id:
          formData.movement_type === "TRANSFER"
            ? undefined
            : (isLocationBound ? Number(fixedLocationId) : Number(formData.location_id)),
        source_location_id:
          formData.movement_type === "TRANSFER"
            ? Number(formData.source_location_id || fixedLocationId)
            : undefined,
        destination_location_id:
          formData.movement_type === "TRANSFER" && formData.destination_location_id
            ? Number(formData.destination_location_id)
            : undefined,
        section_id: formData.section_id ? Number(formData.section_id) : undefined,
        asset_id: formData.asset_id ? Number(formData.asset_id) : undefined,
        recipient_id: formData.recipient_id ? Number(formData.recipient_id) : undefined,
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : undefined,
        quantity: Number(formData.quantity),
        unit_cost: formData.unit_cost ? Number(formData.unit_cost) : undefined
      };

      if (editingMovementId) {
        await updateStockMovement(editingMovementId, payload);
      } else {
        await createStockMovement(payload);
      }

      resetMovementForm();
      setError("");
      await loadDailyMovements(dailyFilters);
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to record stock movement");
    } finally {
      setLoading(false);
    }
  }

  function handleEditMovement(movement) {
    if (!canEditMovements || !movement.can_modify) {
      return;
    }

    setEditingMovementId(movement.id);
    setFormData({
      item_id: String(movement.item_id || ""),
      movement_type: movement.movement_type || "STOCK_IN",
      location_id: isLocationBound ? fixedLocationId : String(movement.location_id || ""),
      source_location_id: isLocationBound ? fixedLocationId : String(movement.source_location_id || ""),
      destination_location_id: String(movement.destination_location_id || ""),
      section_id: String(movement.section_id || ""),
      asset_id: String(movement.asset_id || ""),
      recipient_id: String(movement.recipient_id || ""),
      supplier_id: String(movement.supplier_id || ""),
      adjustment_direction: movement.adjustment_direction || "INCREASE",
      quantity: String(movement.quantity || ""),
      unit_cost:
        movement.unit_cost === null || movement.unit_cost === undefined ? "" : String(movement.unit_cost),
      reference: movement.reference || "",
      created_at: toDateTimeInputValue(movement.timestamp || movement.created_at)
    });
    document.querySelector(".app-shell__content")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteMovement(id) {
    if (!window.confirm("Delete this movement and reverse its stock effect?")) {
      return;
    }

    try {
      setLoading(true);
      await deleteStockMovement(id);
      setError("");
      await loadDailyMovements(dailyFilters);
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to delete movement");
    } finally {
      setLoading(false);
    }
  }

  async function handleCountSubmit() {
    if (!countData.location_id || !countData.item_id || countData.counted_quantity === "") {
      setError("Location, item, and counted quantity are required");
      return;
    }

    try {
      setLoading(true);
      const count = await createInventoryCount({
        location_id: Number(countData.location_id),
        items: [
          {
            item_id: Number(countData.item_id),
            counted_quantity: Number(countData.counted_quantity)
          }
        ]
      });

      await postInventoryCount(count.count.id);
      setCountData({
        location_id: fixedLocationId,
        item_id: "",
        counted_quantity: ""
      });
      setError("");
      await loadDailyMovements(dailyFilters);
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to post inventory count");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="inventory-shell space-y-6">
        <section className="inventory-hero inventory-hero--compact">
          <div className="inventory-hero__content">
            <p className="inventory-hero__eyebrow">Movements</p>
            <h2 className="inventory-hero__title">
              {editingMovementId ? "Edit Stock Movement" : "Record Stock Movement"}
            </h2>
            <p className="inventory-hero__copy">
              Create stock movements with location-aware item selection and live ledger updates.
            </p>
          </div>
          <div className="inventory-hero__stats">
            <article>
              <p>Visible Items</p>
              <strong>{items.length}</strong>
            </article>
            <article>
              <p>Visible Records</p>
              <strong>{movements.length}</strong>
            </article>
          </div>
        </section>

        {error ? (
          <div className="dashboard-card__alert dashboard-card__alert--error">
            <span>{error}</span>
            <button type="button" className="alert-close" onClick={() => setError("")}>
              x
            </button>
          </div>
        ) : null}

        <section className="inventory-card">
          <div className="inventory-card__header">
            <div>
              <p className="dashboard-card__eyebrow">Movement Entry</p>
              <h3>{editingMovementId ? "Update Movement" : "Create Movement"}</h3>
            </div>
            {isLocationBound ? (
              <span className="badge-chip">Location Locked: {selectedLocationName}</span>
            ) : null}
          </div>

          <div className="admin-grid admin-grid--movements">
            <select name="item_id" value={formData.item_id} onChange={handleChange}>
              <option value="">Select Item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <select name="movement_type" value={formData.movement_type} onChange={handleChange}>
              {MOVEMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {formData.movement_type === "ADJUSTMENT" ? (
              <select name="adjustment_direction" value={formData.adjustment_direction} onChange={handleChange}>
                <option value="INCREASE">Increase Stock (+)</option>
                <option value="DECREASE">Decrease Stock (-)</option>
              </select>
            ) : null}

            {!isLocationBound && formData.movement_type !== "TRANSFER" ? (
              <select name="location_id" value={formData.location_id} onChange={handleChange}>
                <option value="">Primary Location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            ) : null}

            {formData.movement_type === "TRANSFER" ? (
              <>
                {!isLocationBound ? (
                  <select
                    name="source_location_id"
                    value={formData.source_location_id}
                    onChange={handleChange}
                  >
                    <option value="">Source Location</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="inventory-inline-chip">Source: {selectedLocationName}</div>
                )}

                <select
                  name="destination_location_id"
                  value={formData.destination_location_id}
                  onChange={handleChange}
                >
                  <option value="">Destination Location</option>
                  {locations
                    .filter((location) => String(location.id) !== String(formData.source_location_id || fixedLocationId))
                    .map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                </select>
              </>
            ) : null}

            <select name="section_id" value={formData.section_id} onChange={handleChange}>
              <option value="">Section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>

            <select name="asset_id" value={formData.asset_id} onChange={handleChange}>
              <option value="">Asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>

            {formData.movement_type === "STOCK_IN" ? (
              <select name="supplier_id" value={formData.supplier_id} onChange={handleChange}>
                <option value="">Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            ) : null}

            {formData.movement_type === "STOCK_OUT" || formData.movement_type === "ASSET_ISSUE" ? (
              <select name="recipient_id" value={formData.recipient_id} onChange={handleChange}>
                <option value="">Recipient</option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.full_name}
                  </option>
                ))}
              </select>
            ) : null}

            <input
              type="number"
              name="quantity"
              placeholder="Quantity"
              value={formData.quantity}
              onChange={handleChange}
            />
            <input
              type="number"
              name="unit_cost"
              placeholder="Unit Cost"
              value={formData.unit_cost}
              onChange={handleChange}
            />
            <input
              type="datetime-local"
              name="created_at"
              value={formData.created_at}
              onChange={handleChange}
            />
            <input
              type="text"
              name="reference"
              placeholder="Reference / Notes"
              value={formData.reference}
              onChange={handleChange}
            />
          </div>

          <div className="inventory-card__actions">
            <button type="button" className="primary-button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : editingMovementId ? "Update Movement" : "Record Movement"}
            </button>

            {editingMovementId ? (
              <button type="button" className="secondary-button" onClick={resetMovementForm} disabled={loading}>
                Cancel Edit
              </button>
            ) : null}
          </div>
        </section>

        {canPostCounts ? (
          <section className="inventory-card">
            <div className="inventory-card__header">
              <div>
                <p className="dashboard-card__eyebrow">Inventory Count</p>
                <h3>Quick Physical Count</h3>
              </div>
            </div>
            <div className="admin-grid admin-grid--counts">
              {!isLocationBound ? (
                <select
                  value={countData.location_id}
                  onChange={(event) =>
                    setCountData((current) => ({ ...current, location_id: event.target.value }))
                  }
                >
                  <option value="">Location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="inventory-inline-chip">Counting: {selectedLocationName}</div>
              )}

              <select
                value={countData.item_id}
                onChange={(event) =>
                  setCountData((current) => ({ ...current, item_id: event.target.value }))
                }
              >
                <option value="">Item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Counted Quantity"
                value={countData.counted_quantity}
                onChange={(event) =>
                  setCountData((current) => ({ ...current, counted_quantity: event.target.value }))
                }
              />

              <button type="button" className="secondary-button" onClick={handleCountSubmit} disabled={loading}>
                Post Count
              </button>
            </div>
          </section>
        ) : null}

        <section className="inventory-panel">
          <div className="inventory-panel__header">
            <div>
              <p className="dashboard-card__eyebrow">Daily Ledger</p>
              <h3>Daily Movements</h3>
            </div>
            <div className="reports-page__exports stock-movements__filters">
              <input
                type="date"
                name="start_date"
                value={dailyFilters.start_date}
                onChange={handleDailyFilterChange}
              />
              <input
                type="date"
                name="end_date"
                value={dailyFilters.end_date}
                onChange={handleDailyFilterChange}
              />
              {!isLocationBound ? (
                <select
                  name="location_id"
                  value={dailyFilters.location_id}
                  onChange={handleDailyFilterChange}
                >
                  <option value="">All Locations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="inventory-inline-chip">Location: {selectedLocationName}</span>
              )}
              <button
                type="button"
                className="secondary-button secondary-button--small"
                onClick={() =>
                  setDailyFilters((current) => ({
                    ...current,
                    start_date: getTodayDateValue(),
                    end_date: getTodayDateValue()
                  }))
                }
              >
                Today
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Location</th>
                  <th>Section</th>
                  <th>Supplier / Recipient</th>
                  <th>Reference</th>
                  <th>Entered By</th>
                  <th>Time</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="data-table__empty">No movements found for the selected day.</td>
                  </tr>
                ) : (
                  movements.map((movement, index) => (
                    <tr key={`${movement.id}-${movement.reference || movement.item_name}-${index}`}>
                      <td>
                        <ItemIdentity
                          name={movement.item_name}
                          imagePath={movement.item_image}
                          compact
                        />
                      </td>
                      <td>{formatMovementType(movement.movement_type)}</td>
                      <td>{movement.quantity}</td>
                      <td>{movement.location}</td>
                      <td>{movement.section || "-"}</td>
                      <td>{movement.supplier || movement.recipient || "-"}</td>
                      <td>{movement.reference || "-"}</td>
                      <td>{movement.entered_by}</td>
                      <td>{new Date(movement.timestamp).toLocaleString()}</td>
                      <td className="text-right">
                        {canEditMovements && movement.can_modify ? (
                          <div className="action-row" style={{ justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="action-btn action-btn--edit"
                              onClick={() => handleEditMovement(movement)}
                              disabled={loading}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="action-btn action-btn--delete"
                              onClick={() => handleDeleteMovement(movement.id)}
                              disabled={loading}
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="status-chip status-chip--pending">Locked</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default StockMovements;
