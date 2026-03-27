import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import ItemIdentity from "../components/ItemIdentity";
import {
  createMaintenanceLog,
  fetchAssets,
  fetchItems,
  fetchLocations,
  fetchMaintenanceHistory,
  fetchMaintenanceItems
} from "../services/api";

function Maintenance() {
  const [history, setHistory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [items, setItems] = useState([]);
  const [detailItems, setDetailItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    location_id: "",
    asset_id: "",
    item_id: "",
    quantity: "",
    description: "",
    reference: ""
  });

  async function loadData() {
    try {
      const [historyData, locationData, assetData, itemData] = await Promise.all([
        fetchMaintenanceHistory(),
        fetchLocations(),
        fetchAssets(),
        fetchItems()
      ]);

      setHistory(Array.isArray(historyData) ? historyData : []);
      setLocations(Array.isArray(locationData) ? locationData : []);
      setAssets(Array.isArray(assetData) ? assetData : []);
      setItems(itemData.items || []);
      setError("");
    } catch (loadError) {
      console.error("Failed to load maintenance history", loadError);
      setError(loadError.message || "Failed to load maintenance data");
      setHistory([]);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData({ ...formData, [name]: value });
  }

  async function handleViewItems(id) {
    if (detailItems[id]) {
      setDetailItems((currentItems) => {
        const nextItems = { ...currentItems };
        delete nextItems[id];
        return nextItems;
      });
      return;
    }

    try {
      const itemsUsed = await fetchMaintenanceItems(id);
      setDetailItems((currentItems) => ({
        ...currentItems,
        [id]: Array.isArray(itemsUsed) ? itemsUsed : []
      }));
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to fetch maintenance items");
    }
  }

  async function handleSubmit() {
    if (
      !formData.location_id ||
      !formData.asset_id ||
      !formData.item_id ||
      !formData.quantity ||
      !formData.description.trim()
    ) {
      setError("Location, asset, item, quantity, and description are required");
      return;
    }

    try {
      setLoading(true);
      await createMaintenanceLog({
        asset_id: Number(formData.asset_id),
        location_id: Number(formData.location_id),
        description: formData.description,
        reference: formData.reference,
        items_used: [
          {
            item_id: Number(formData.item_id),
            quantity: Number(formData.quantity)
          }
        ]
      });

      setFormData({
        location_id: "",
        asset_id: "",
        item_id: "",
        quantity: "",
        description: "",
        reference: ""
      });

      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to log maintenance");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="module-placeholder">
        <span className="module-placeholder__eyebrow">Maintenance</span>
        <h2>Maintenance History</h2>
        <p>Track maintenance events and material usage linked to assets.</p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="module-placeholder" style={{ marginTop: "1rem" }}>
        <h3>Log Maintenance</h3>
        <div className="admin-grid admin-grid--maintenance">
          <select name="location_id" value={formData.location_id} onChange={handleChange}>
            <option value="">Location</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
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

          <select name="item_id" value={formData.item_id} onChange={handleChange}>
            <option value="">Item Used</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            name="quantity"
            placeholder="Quantity Used"
            value={formData.quantity}
            onChange={handleChange}
          />

          <input
            name="reference"
            placeholder="Reference"
            value={formData.reference}
            onChange={handleChange}
          />

          <input
            name="description"
            placeholder="Work performed"
            value={formData.description}
            onChange={handleChange}
          />

          <button type="button" className="primary-button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Log Maintenance"}
          </button>
        </div>
      </div>

      <div className="module-placeholder" style={{ marginTop: "1rem" }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Description</th>
                <th>Performed By</th>
                <th>Date</th>
                <th>Items Used</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan="5" className="data-table__empty">No maintenance history found.</td>
                </tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.maintenance_id}>
                    <td>{entry.asset_name}</td>
                    <td>{entry.description}</td>
                    <td>{entry.performed_by}</td>
                    <td>{new Date(entry.created_at).toLocaleString()}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleViewItems(entry.maintenance_id)}
                      >
                        {detailItems[entry.maintenance_id] ? "Hide" : "View"}
                      </button>

                      {detailItems[entry.maintenance_id] ? (
                        <div className="inline-list">
                          {detailItems[entry.maintenance_id].map((item) => (
                            <ItemIdentity
                              key={item.id}
                              name={item.item_name}
                              imagePath={item.item_image}
                              meta={`Used ${item.quantity}`}
                              compact
                            />
                          ))}
                        </div>
                      ) : null}
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

export default Maintenance;
