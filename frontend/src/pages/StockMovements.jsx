import { useCallback, useEffect, useState } from "react";
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

const emptyMovementForm = {
  item_id: "",
  movement_type: "STOCK_IN",
  location_id: "",
  source_location_id: "",
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

function StockMovements() {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sections, setSections] = useState([]);
  const [assets, setAssets] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [dailyDate, setDailyDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingMovementId, setEditingMovementId] = useState(null);
  const [formData, setFormData] = useState(emptyMovementForm);
  const [countData, setCountData] = useState({
    location_id: "",
    item_id: "",
    counted_quantity: ""
  });

  async function loadReferences() {
    try {
      const [itemData, locationData, assetData, recipientData, supplierData] = await Promise.all([
        fetchItems(),
        fetchLocations(),
        fetchAssets(),
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
  }

  const loadDailyMovements = useCallback(async (selectedDate = "") => {
    try {
      const data = await fetchDailyMovements({ date: selectedDate });
      setMovements(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error("Failed to load daily movements", loadError);
      setMovements([]);
      setError(loadError.message || "Failed to load daily movements");
    }
  }, []);

  useEffect(() => {
    void loadReferences();
    void loadDailyMovements();
  }, [loadDailyMovements]);

  useEffect(() => {
    void loadDailyMovements(dailyDate);
  }, [dailyDate, loadDailyMovements]);

  useEffect(() => {
    if (!formData.location_id) {
      setSections([]);
      return;
    }

    fetchSections(formData.location_id)
      .then((data) => setSections(Array.isArray(data) ? data : []))
      .catch((loadError) => {
        console.error(loadError);
        setSections([]);
      });
  }, [formData.location_id]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  }

  function resetMovementForm() {
    setEditingMovementId(null);
    setFormData(emptyMovementForm);
  }

  async function handleSubmit() {
    if (!formData.item_id || !formData.quantity) {
      setError("Item and quantity are required");
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
        location_id: formData.location_id ? Number(formData.location_id) : undefined,
        source_location_id: formData.source_location_id ? Number(formData.source_location_id) : undefined,
        destination_location_id: formData.destination_location_id ? Number(formData.destination_location_id) : undefined,
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
      await loadReferences();
      await loadDailyMovements();
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to record stock movement");
    } finally {
      setLoading(false);
    }
  }

  function handleEditMovement(movement) {
    setEditingMovementId(movement.id);
    setFormData({
      item_id: String(movement.item_id || ""),
      movement_type: movement.movement_type || "STOCK_IN",
      location_id: String(movement.location_id || ""),
      source_location_id: String(movement.source_location_id || ""),
      destination_location_id: String(movement.destination_location_id || ""),
      section_id: String(movement.section_id || ""),
      asset_id: String(movement.asset_id || ""),
      recipient_id: String(movement.recipient_id || ""),
      supplier_id: String(movement.supplier_id || ""),
      adjustment_direction: movement.adjustment_direction || "INCREASE",
      quantity: String(movement.quantity || ""),
      unit_cost: movement.unit_cost === null || movement.unit_cost === undefined ? "" : String(movement.unit_cost),
      reference: movement.reference || "",
      created_at: toDateTimeInputValue(movement.timestamp || movement.created_at)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteMovement(id) {
    if (!window.confirm("Delete this movement and reverse its stock effect?")) {
      return;
    }

    try {
      setLoading(true);
      await deleteStockMovement(id);
      setError("");
      await loadReferences();
      await loadDailyMovements(dailyDate);
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
        location_id: "",
        item_id: "",
        counted_quantity: ""
      });
      setError("");
      await loadReferences();
      await loadDailyMovements();
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to post inventory count");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="module-placeholder">
        <span className="module-placeholder__eyebrow">Movements</span>
        <h2>{editingMovementId ? "Edit Stock Movement" : "Record Stock Movement"}</h2>
        <p>Post receipts, issues, transfers, and adjustments into the live inventory ledger.</p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="module-placeholder" style={{ marginTop: "1rem" }}>
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

          <select name="location_id" value={formData.location_id} onChange={handleChange}>
            <option value="">Primary Location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          {formData.movement_type === "TRANSFER" ? (
            <>
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

              <select
                name="destination_location_id"
                value={formData.destination_location_id}
                onChange={handleChange}
              >
                <option value="">Destination Location</option>
                {locations.map((location) => (
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

          <input type="number" name="quantity" placeholder="Quantity" value={formData.quantity} onChange={handleChange} />
          <input type="number" name="unit_cost" placeholder="Unit Cost" value={formData.unit_cost} onChange={handleChange} />
          <input type="datetime-local" name="created_at" value={formData.created_at} onChange={handleChange} />
          <input type="text" name="reference" placeholder="Reference / Notes" value={formData.reference} onChange={handleChange} />

          <button type="button" className="primary-button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : editingMovementId ? "Update Movement" : "Record Movement"}
          </button>

          {editingMovementId ? (
            <button type="button" className="secondary-button" onClick={resetMovementForm} disabled={loading}>
              Cancel Edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="module-placeholder" style={{ marginTop: "1rem" }}>
        <h3>Quick Physical Count</h3>
        <div className="admin-grid admin-grid--counts">
          <select value={countData.location_id} onChange={(event) => setCountData({ ...countData, location_id: event.target.value })}>
            <option value="">Location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <select value={countData.item_id} onChange={(event) => setCountData({ ...countData, item_id: event.target.value })}>
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
            onChange={(event) => setCountData({ ...countData, counted_quantity: event.target.value })}
          />

          <button type="button" className="secondary-button" onClick={handleCountSubmit} disabled={loading}>
            Post Count
          </button>
        </div>
      </div>

      <div className="module-placeholder" style={{ marginTop: "1rem" }}>
        <div className="table-toolbar">
          <h3>Daily Movements</h3>
          <input type="date" value={dailyDate} onChange={(event) => setDailyDate(event.target.value)} />
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
                  <tr key={`${movement.reference || movement.item_name}-${index}`}>
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
                      {movement.can_modify ? (
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
      </div>
    </DashboardLayout>
  );
}

export default StockMovements;
