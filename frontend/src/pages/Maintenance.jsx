import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import ItemIdentity from "../components/ItemIdentity";
import {
  createMaintenanceLog,
  deleteMaintenanceLog,
  fetchAssets,
  fetchItems,
  fetchLocations,
  fetchMaintenanceHistory,
  fetchMaintenanceItems,
  updateMaintenanceLog
} from "../services/api";

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

function createEmptyForm(locationId = "") {
  return {
    location_id: locationId,
    asset_id: "",
    item_id: "",
    quantity: "",
    description: "",
    reference: ""
  };
}

function Maintenance() {
  const currentUser = readStoredUser();
  const currentRole = normalizeRoleName(currentUser.role_name);
  const fixedLocationId =
    currentRole === "superadmin" ? "" : String(currentUser.location_id || "");
  const isLocationBound = Boolean(fixedLocationId);
  const canManageMaintenance = currentRole === "admin" || currentRole === "superadmin";

  const [history, setHistory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [items, setItems] = useState([]);
  const [detailItems, setDetailItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingMaintenanceId, setEditingMaintenanceId] = useState(null);
  const [formData, setFormData] = useState(() => createEmptyForm(fixedLocationId));

  async function loadData() {
    try {
      const maintenanceParams = fixedLocationId ? { location_id: fixedLocationId } : {};
      const [historyData, locationData, assetData, itemData] = await Promise.all([
        fetchMaintenanceHistory(maintenanceParams),
        fetchLocations(),
        fetchAssets(fixedLocationId ? Number(fixedLocationId) : undefined),
        fetchItems(fixedLocationId ? { location_id: fixedLocationId } : {})
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

  useEffect(() => {
    if (!editingMaintenanceId && fixedLocationId) {
      setFormData((current) => ({
        ...current,
        location_id: fixedLocationId
      }));
    }
  }, [editingMaintenanceId, fixedLocationId]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setEditingMaintenanceId(null);
    setFormData(createEmptyForm(fixedLocationId));
  }

  async function handleViewItems(id) {
    if (detailItems[id]) {
      setDetailItems((currentItems) => {
        const nextItems = { ...currentItems };
        delete nextItems[id];
        return nextItems;
      });
      return [];
    }

    try {
      const itemsUsed = await fetchMaintenanceItems(id);
      const resolvedItems = Array.isArray(itemsUsed) ? itemsUsed : [];
      setDetailItems((currentItems) => ({
        ...currentItems,
        [id]: resolvedItems
      }));
      return resolvedItems;
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to fetch maintenance items");
      return [];
    }
  }

  async function handleEdit(entry) {
    if (!entry.can_manage) {
      return;
    }

    const itemsUsed =
      detailItems[entry.maintenance_id] || (await fetchMaintenanceItems(entry.maintenance_id));
    const resolvedItems = Array.isArray(itemsUsed) ? itemsUsed : [];

    if (resolvedItems.length !== 1) {
      setError("Editing is currently available only for maintenance records with one item.");
      return;
    }

    const [usedItem] = resolvedItems;
    setDetailItems((current) => ({
      ...current,
      [entry.maintenance_id]: resolvedItems
    }));
    setEditingMaintenanceId(entry.maintenance_id);
    setFormData({
      location_id: fixedLocationId || String(entry.location_id || ""),
      asset_id: String(entry.asset_id || ""),
      item_id: String(usedItem.item_id || ""),
      quantity: String(usedItem.quantity || ""),
      description: entry.description || "",
      reference: ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this maintenance record and reverse the stock usage?")) {
      return;
    }

    try {
      setLoading(true);
      await deleteMaintenanceLog(id);
      setDetailItems((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });

      if (editingMaintenanceId === id) {
        resetForm();
      }

      await loadData();
      setError("");
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to delete maintenance");
    } finally {
      setLoading(false);
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
      const payload = {
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
      };

      if (editingMaintenanceId) {
        await updateMaintenanceLog(editingMaintenanceId, payload);
      } else {
        await createMaintenanceLog(payload);
      }

      resetForm();
      await loadData();
      setError("");
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to save maintenance");
    } finally {
      setLoading(false);
    }
  }

  const selectedLocationName =
    locations.find((location) => String(location.id) === String(fixedLocationId))?.name ||
    "Assigned Location";

  return (
    <DashboardLayout>
      <div className="module-placeholder">
        <span className="module-placeholder__eyebrow">Maintenance</span>
        <h2>Maintenance History</h2>
        <p>Track maintenance events and material usage linked to assets.</p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="module-placeholder" style={{ marginTop: "1rem" }}>
        <div className="inventory-panel__header">
          <div>
            <h3>{editingMaintenanceId ? "Edit Maintenance" : "Log Maintenance"}</h3>
            <p className="reports-page__scope-copy">
              {editingMaintenanceId
                ? "Update the record and keep stock usage in sync."
                : "Record maintenance work and material usage."}
            </p>
          </div>
          {editingMaintenanceId ? (
            <button type="button" className="secondary-button" onClick={resetForm} disabled={loading}>
              Cancel Edit
            </button>
          ) : null}
        </div>

        <div className="admin-grid admin-grid--maintenance">
          {isLocationBound ? (
            <div className="inventory-inline-chip">Location: {selectedLocationName}</div>
          ) : (
            <select name="location_id" value={formData.location_id} onChange={handleChange}>
              <option value="">Location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          )}

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
            {loading ? "Saving..." : editingMaintenanceId ? "Update Maintenance" : "Log Maintenance"}
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
                {canManageMaintenance ? <th className="text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageMaintenance ? "6" : "5"}
                    className="data-table__empty"
                  >
                    No maintenance history found.
                  </td>
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
                        onClick={() => void handleViewItems(entry.maintenance_id)}
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
                    {canManageMaintenance ? (
                      <td className="text-right">
                        {entry.can_manage ? (
                          <div className="action-row" style={{ justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="action-btn action-btn--edit"
                              onClick={() => void handleEdit(entry)}
                              disabled={loading}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="action-btn action-btn--delete"
                              onClick={() => void handleDelete(entry.maintenance_id)}
                              disabled={loading}
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="status-chip status-chip--pending">Locked</span>
                        )}
                      </td>
                    ) : null}
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
