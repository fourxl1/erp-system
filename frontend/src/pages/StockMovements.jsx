import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useActiveLocationId } from "../hooks/useActiveLocation";
import ItemIdentity from "../components/ItemIdentity";
import SortHeader from "../components/SortHeader";
import TablePagination from "../components/TablePagination";
import useSortedPagination from "../hooks/useSortedPagination";
import {
  confirmTransfer,
  createStockMovement,
  fetchDailyMovements,
  fetchItems,
  fetchLocations,
  fetchRecipients,
  fetchSuppliers,
  rejectTransfer
} from "../services/api";
import { formatMovementType, MOVEMENT_TYPE_OPTIONS } from "../utils/movementTypes";

const LIVE_UPDATE_EVENT = "inventory-live-update";

function getTodayDateValue() {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function createEmptyMovementItem() {
  return {
    item_id: "",
    quantity: "",
    cost: ""
  };
}

function createEmptyForm() {
  return {
    movement_type: "IN",
    destination_location_id: "",
    supplier_id: "",
    recipient_id: "",
    reference: "",
    items: [createEmptyMovementItem()]
  };
}

function getStatusLabel(movement) {
  const type = String(movement.movement_type || "").toUpperCase();
  const status = String(movement.status || "").toUpperCase();

  if (type !== "TRANSFER") {
    return status || "COMPLETED";
  }

  if (status === "PENDING") {
    return "Not Received";
  }

  if (status === "COMPLETED") {
    return "Received";
  }

  if (status === "REJECTED") {
    return "Rejected";
  }

  return status;
}

function getMovementRouteLabel(movement) {
  if (movement.source_location_name && movement.destination_location_name) {
    return `${movement.source_location_name} -> ${movement.destination_location_name}`;
  }

  return movement.location_name || "-";
}

function StockMovements() {
  const activeLocationId = useActiveLocationId();
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(createEmptyForm);
  const [filters, setFilters] = useState({
    start_date: getTodayDateValue(),
    end_date: getTodayDateValue(),
    movement_type: "",
    status: ""
  });

  const loadReferences = useCallback(async () => {
    try {
      const [itemData, locationData, recipientData, supplierData] = await Promise.all([
        fetchItems(),
        fetchLocations(),
        fetchRecipients(),
        fetchSuppliers()
      ]);

      setItems(itemData.items || []);
      setLocations(Array.isArray(locationData) ? locationData : []);
      setRecipients(Array.isArray(recipientData) ? recipientData : []);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load movement references");
    }
  }, []);

  const loadMovements = useCallback(async (activeFilters = filters) => {
    try {
      const data = await fetchDailyMovements(activeFilters);
      setMovements(Array.isArray(data) ? data : []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Failed to load movements");
      setMovements([]);
    }
  }, [filters]);

  useEffect(() => {
    void loadReferences();
  }, [activeLocationId, loadReferences]);

  useEffect(() => {
    void loadMovements(filters);
  }, [activeLocationId, filters, loadMovements]);

  useEffect(() => {
    function handleLiveUpdate() {
      void loadMovements(filters);
    }

    window.addEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
    return () => window.removeEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
  }, [filters, loadMovements]);

  const isTransfer = formData.movement_type === "TRANSFER";
  const isIn = formData.movement_type === "IN";
  const isOut = formData.movement_type === "OUT";
  const isAdjustment = formData.movement_type === "ADJUSTMENT";
  const movementTable = useSortedPagination(movements, {
    initialSortKey: "created_at",
    initialSortDirection: "desc",
    initialPageSize: 10,
    getSortValue: (movement, key) => {
      switch (key) {
        case "movement_type":
          return formatMovementType(movement.movement_type);
        case "status":
          return getStatusLabel(movement);
        case "route":
          return getMovementRouteLabel(movement);
        case "items_count":
          return Array.isArray(movement.items) ? movement.items.length : 0;
        case "reference":
          return movement.reference;
        case "created_by_name":
          return movement.created_by_name;
        case "created_at":
          return movement.created_at;
        default:
          return movement?.[key];
      }
    }
  });
  const pagedMovements = movementTable.pagedRows;

  const destinationOptions = useMemo(
    () =>
      locations.filter(
        (entry) => String(entry.id) !== String(activeLocationId)
      ),
    [activeLocationId, locations]
  );

  function handleFormFieldChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value
    }));
  }

  function handleItemChange(index, field, value) {
    setFormData((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  }

  function addMovementItem() {
    setFormData((current) => ({
      ...current,
      items: [...current.items, createEmptyMovementItem()]
    }));
  }

  function removeMovementItem(index) {
    setFormData((current) => {
      const nextItems = current.items.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        items: nextItems.length > 0 ? nextItems : [createEmptyMovementItem()]
      };
    });
  }

  function resetForm() {
    setFormData(createEmptyForm());
  }

  async function handleSubmit() {
    const validItems = formData.items.filter((entry) => entry.item_id && entry.quantity !== "");

    if (validItems.length === 0) {
      setError("Add at least one item with quantity");
      return;
    }

    if (isTransfer && !formData.destination_location_id) {
      setError("Destination location is required for transfers");
      return;
    }

    if (isIn && !formData.supplier_id) {
      setError("Supplier is required for stock in");
      return;
    }

    if (isOut && !formData.recipient_id) {
      setError("Recipient is required for stock out");
      return;
    }

    try {
      setLoading(true);
      await createStockMovement({
        movement_type: formData.movement_type,
        
       ...(isTransfer && {
  destination_location_id: Number(formData.destination_location_id)
}),
        supplier_id: isIn ? Number(formData.supplier_id) : undefined,
        recipient_id: isOut ? Number(formData.recipient_id) : undefined,
        reference: formData.reference || undefined,
        items: validItems.map((entry) => ({
          item_id: Number(entry.item_id),
          quantity: Number(entry.quantity),
          cost: entry.cost === "" ? undefined : Number(entry.cost)
        }))
      });

      resetForm();
      await loadMovements(filters);
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
    } catch (actionError) {
      setError(actionError.message || "Failed to record movement");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmTransfer(id) {
    try {
      setLoading(true);
      await confirmTransfer(id);
      await loadMovements(filters);
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
    } catch (actionError) {
      setError(actionError.message || "Failed to confirm transfer");
    } finally {
      setLoading(false);
    }
  }

  async function handleRejectTransfer(id) {
    try {
      setLoading(true);
      await rejectTransfer(id, { reason: "Rejected by destination admin" });
      await loadMovements(filters);
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
    } catch (actionError) {
      setError(actionError.message || "Failed to reject transfer");
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
            <h2 className="inventory-hero__title">Stock Movement Engine</h2>
            <p className="inventory-hero__copy">
              Record multi-item stock in, out, transfer, and adjustments. Location is assigned automatically.
            </p>
          </div>
          <div className="inventory-hero__stats">
            <article>
              <p>Items</p>
              <strong>{items.length}</strong>
            </article>
            <article>
              <p>Movements</p>
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
              <p className="dashboard-card__eyebrow">Create Movement</p>
              <h3>Multi-item Entry</h3>
            </div>
          </div>

          <div className="admin-grid admin-grid--movements">
            <select name="movement_type" value={formData.movement_type} onChange={handleFormFieldChange}>
              {MOVEMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {isTransfer ? (
              <select
                name="destination_location_id"
                value={formData.destination_location_id}
                onChange={handleFormFieldChange}
              >
                <option value="">Destination Location</option>
                {destinationOptions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            ) : null}

            {isIn ? (
              <select name="supplier_id" value={formData.supplier_id} onChange={handleFormFieldChange}>
                <option value="">Supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            ) : null}

            {isOut ? (
              <select name="recipient_id" value={formData.recipient_id} onChange={handleFormFieldChange}>
                <option value="">Recipient</option>
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.full_name || recipient.name}
                  </option>
                ))}
              </select>
            ) : null}

            <input
              name="reference"
              placeholder="Reference / Notes"
              value={formData.reference}
              onChange={handleFormFieldChange}
            />
          </div>

          <div className="stack-list" style={{ marginTop: "1rem" }}>
            {formData.items.map((entry, index) => (
              <div key={`movement-item-${index}`} className="admin-grid admin-grid--reports">
                <select
                  value={entry.item_id}
                  onChange={(event) => handleItemChange(index, "item_id", event.target.value)}
                >
                  <option value="">Select Item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={entry.quantity}
                  onChange={(event) => handleItemChange(index, "quantity", event.target.value)}
                  placeholder={isAdjustment ? "Quantity (+/-)" : "Quantity"}
                />
                <input
                  type="number"
                  value={entry.cost}
                  onChange={(event) => handleItemChange(index, "cost", event.target.value)}
                  placeholder="Cost (optional)"
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => removeMovementItem(index)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="inventory-card__actions">
            <button type="button" className="secondary-button" onClick={addMovementItem}>
              Add Item
            </button>
            <button type="button" className="primary-button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Record Movement"}
            </button>
          </div>
        </section>

        <section className="inventory-panel">
          <div className="inventory-panel__header">
            <div>
              <p className="dashboard-card__eyebrow">Movement History</p>
              <h3>Recorded Transactions</h3>
            </div>
            <div className="reports-page__exports stock-movements__filters">
              <input
                type="date"
                name="start_date"
                value={filters.start_date}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, start_date: event.target.value }))
                }
              />
              <input
                type="date"
                name="end_date"
                value={filters.end_date}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, end_date: event.target.value }))
                }
              />
              <select
                value={filters.movement_type}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, movement_type: event.target.value }))
                }
              >
                <option value="">All Types</option>
                {MOVEMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value }))
                }
              >
                <option value="">All Status</option>
                <option value="PENDING">Not Received</option>
                <option value="COMPLETED">Received</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <SortHeader
                      label="Type"
                      columnKey="movement_type"
                      sortKey={movementTable.sortKey}
                      sortDirection={movementTable.sortDirection}
                      onSort={movementTable.toggleSort}
                    />
                  </th>
                  <th>
                    <SortHeader
                      label="Status"
                      columnKey="status"
                      sortKey={movementTable.sortKey}
                      sortDirection={movementTable.sortDirection}
                      onSort={movementTable.toggleSort}
                    />
                  </th>
                  <th>
                    <SortHeader
                      label="Route"
                      columnKey="route"
                      sortKey={movementTable.sortKey}
                      sortDirection={movementTable.sortDirection}
                      onSort={movementTable.toggleSort}
                    />
                  </th>
                  <th>Items</th>
                  <th>
                    <SortHeader
                      label="Reference"
                      columnKey="reference"
                      sortKey={movementTable.sortKey}
                      sortDirection={movementTable.sortDirection}
                      onSort={movementTable.toggleSort}
                    />
                  </th>
                  <th>
                    <SortHeader
                      label="Created By"
                      columnKey="created_by_name"
                      sortKey={movementTable.sortKey}
                      sortDirection={movementTable.sortDirection}
                      onSort={movementTable.toggleSort}
                    />
                  </th>
                  <th>
                    <SortHeader
                      label="Time"
                      columnKey="created_at"
                      sortKey={movementTable.sortKey}
                      sortDirection={movementTable.sortDirection}
                      onSort={movementTable.toggleSort}
                    />
                  </th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="data-table__empty">
                      No movements found.
                    </td>
                  </tr>
                ) : (
                  pagedMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatMovementType(movement.movement_type)}</td>
                      <td>
                        <span className={`status-chip status-chip--${String(movement.status || "").toLowerCase() || "pending"}`}>
                          {getStatusLabel(movement)}
                        </span>
                      </td>
                      <td>
                        {getMovementRouteLabel(movement)}
                      </td>
                      <td>
                        <div className="request-item-list">
                          {(movement.items || []).map((item) => (
                            <ItemIdentity
                              key={`${movement.id}-${item.id}`}
                              name={item.item_name}
                              imagePath={item.item_image}
                              meta={`${item.quantity} ${item.item_unit || ""}`.trim()}
                              compact
                            />
                          ))}
                        </div>
                      </td>
                      <td>{movement.reference || "-"}</td>
                      <td>{movement.created_by_name || "-"}</td>
                      <td>{new Date(movement.created_at).toLocaleString()}</td>
                      <td className="text-right">
                        {movement.can_confirm || movement.can_reject ? (
                          <div className="action-row" style={{ justifyContent: "flex-end" }}>
                            {movement.can_confirm ? (
                              <button
                                type="button"
                                className="action-btn action-btn--edit"
                                onClick={() => void handleConfirmTransfer(movement.id)}
                                disabled={loading}
                              >
                                Confirm
                              </button>
                            ) : null}
                            {movement.can_reject ? (
                              <button
                                type="button"
                                className="action-btn action-btn--delete"
                                onClick={() => void handleRejectTransfer(movement.id)}
                                disabled={loading}
                              >
                                Reject
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="request-notice-card__meta">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={movementTable.page}
            pageSize={movementTable.pageSize}
            totalItems={movementTable.totalItems}
            totalPages={movementTable.totalPages}
            onPageChange={movementTable.setPage}
            onPageSizeChange={movementTable.setPageSize}
          />
        </section>
      </div>
    </DashboardLayout>
  );
}

export default StockMovements;
