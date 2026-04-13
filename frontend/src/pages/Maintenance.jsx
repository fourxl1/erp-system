import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useActiveLocationId } from "../hooks/useActiveLocation";
import ItemIdentity from "../components/ItemIdentity";
import SortHeader from "../components/SortHeader";
import TablePagination from "../components/TablePagination";
import useSortedPagination from "../hooks/useSortedPagination";
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
import { normalizeRoleName, readStoredUser } from "../utils/auth";

function createEmptyForm() {
  return {
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
  const canManageMaintenance = currentRole === "admin" || currentRole === "superadmin";
  const activeLocationId = useActiveLocationId();

  const [history, setHistory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [items, setItems] = useState([]);
  const [detailItems, setDetailItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingMaintenanceId, setEditingMaintenanceId] = useState(null);
  const [formData, setFormData] = useState(createEmptyForm);

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
      setError(loadError.message || "Failed to load maintenance data");
      setHistory([]);
    }
  }

  useEffect(() => {
    void loadData();
  }, [activeLocationId]);

  function resetForm() {
    setEditingMaintenanceId(null);
    setFormData(createEmptyForm());
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
      asset_id: String(entry.asset_id || ""),
      item_id: String(usedItem.item_id || ""),
      quantity: String(usedItem.quantity || ""),
      description: entry.description || "",
      reference: ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this maintenance record and reverse stock usage?")) {
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
    } catch (actionError) {
      setError(actionError.message || "Failed to delete maintenance");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!activeLocationId) {
      setError("Active location context is required");
      return;
    }

    if (!formData.asset_id || !formData.item_id || !formData.quantity || !formData.description.trim()) {
      setError("Asset, item, quantity, and description are required");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        asset_id: Number(formData.asset_id),
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
      setError(actionError.message || "Failed to save maintenance");
    } finally {
      setLoading(false);
    }
  }

  const selectedLocationName =
    locations.find((location) => String(location.id) === String(activeLocationId))?.name ||
    "Active Location";
  const historyTable = useSortedPagination(history, {
    initialSortKey: "created_at",
    initialSortDirection: "desc",
    initialPageSize: 10,
    getSortValue: (entry, key) => {
      switch (key) {
        case "asset_name":
          return entry.asset_name;
        case "description":
          return entry.description;
        case "performed_by":
          return entry.performed_by;
        case "created_at":
          return entry.created_at;
        default:
          return entry?.[key];
      }
    }
  });
  const pagedHistory = historyTable.pagedRows;

  return (
    <DashboardLayout>
      <div className="module-placeholder">
        <span className="module-placeholder__eyebrow">Maintenance</span>
        <h2>Maintenance History</h2>
        <p>Maintenance records are automatically tagged to your active location.</p>
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
          <div className="inventory-inline-chip">Location: {selectedLocationName}</div>

          <select
            name="asset_id"
            value={formData.asset_id}
            onChange={(event) =>
              setFormData((current) => ({ ...current, asset_id: event.target.value }))
            }
          >
            <option value="">Asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>

          <select
            name="item_id"
            value={formData.item_id}
            onChange={(event) =>
              setFormData((current) => ({ ...current, item_id: event.target.value }))
            }
          >
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
            onChange={(event) =>
              setFormData((current) => ({ ...current, quantity: event.target.value }))
            }
          />

          <input
            name="reference"
            placeholder="Reference"
            value={formData.reference}
            onChange={(event) =>
              setFormData((current) => ({ ...current, reference: event.target.value }))
            }
          />

          <input
            name="description"
            placeholder="Work performed"
            value={formData.description}
            onChange={(event) =>
              setFormData((current) => ({ ...current, description: event.target.value }))
            }
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
                <th>
                  <SortHeader
                    label="Asset"
                    columnKey="asset_name"
                    sortKey={historyTable.sortKey}
                    sortDirection={historyTable.sortDirection}
                    onSort={historyTable.toggleSort}
                  />
                </th>
                <th>
                  <SortHeader
                    label="Description"
                    columnKey="description"
                    sortKey={historyTable.sortKey}
                    sortDirection={historyTable.sortDirection}
                    onSort={historyTable.toggleSort}
                  />
                </th>
                <th>
                  <SortHeader
                    label="Performed By"
                    columnKey="performed_by"
                    sortKey={historyTable.sortKey}
                    sortDirection={historyTable.sortDirection}
                    onSort={historyTable.toggleSort}
                  />
                </th>
                <th>
                  <SortHeader
                    label="Date"
                    columnKey="created_at"
                    sortKey={historyTable.sortKey}
                    sortDirection={historyTable.sortDirection}
                    onSort={historyTable.toggleSort}
                  />
                </th>
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
                pagedHistory.map((entry) => (
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

        <TablePagination
          page={historyTable.page}
          pageSize={historyTable.pageSize}
          totalItems={historyTable.totalItems}
          totalPages={historyTable.totalPages}
          onPageChange={historyTable.setPage}
          onPageSizeChange={historyTable.setPageSize}
        />
      </div>
    </DashboardLayout>
  );
}

export default Maintenance;
