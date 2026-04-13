import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useActiveLocationId } from "../hooks/useActiveLocation";
import ItemIdentity from "../components/ItemIdentity";
import SortHeader from "../components/SortHeader";
import TablePagination from "../components/TablePagination";
import useSortedPagination from "../hooks/useSortedPagination";
import {
  approveRequest,
  createRequest,
  fetchItems,
  fetchRequestLocations,
  fetchRequests,
  rejectRequest
} from "../services/api";
import { normalizeRoleName, readStoredUser } from "../utils/auth";

const LIVE_UPDATE_EVENT = "inventory-live-update";

function getRequestRouteLabel(request) {
  if (request.source_location_name) {
    return `${request.source_location_name} -> ${request.destination_location_name}`;
  }

  return request.destination_location_name || "";
}

function Requests() {
  const currentUser = readStoredUser();
  const currentRole = normalizeRoleName(currentUser.role_name);
  const activeLocationId = useActiveLocationId();

  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [locations, setLocations] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    source_location_id: "",
    notes: "",
    items: [{ item_id: "", quantity: "" }]
  });

  const loadData = useCallback(async (activeStatus = "") => {
    try {
      const [itemsData, requestData, locationData] = await Promise.all([
        fetchItems(),
        fetchRequests(activeStatus ? { status: activeStatus } : {}),
        fetchRequestLocations()
      ]);

      setItems(itemsData.items || []);
      setRequests(requestData.requests || []);
      setLocations(Array.isArray(locationData) ? locationData : []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Failed to load requests");
    }
  }, []);

  useEffect(() => {
    void loadData(statusFilter);
  }, [activeLocationId, loadData, statusFilter]);

  useEffect(() => {
    function handleLiveUpdate() {
      void loadData(statusFilter);
    }

    window.addEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
    return () => window.removeEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
  }, [loadData, statusFilter]);

  const destinationLocationName = useMemo(
    () => locations.find((location) => String(location.id) === String(activeLocationId))?.name || "Active Location",
    [activeLocationId, locations]
  );

  const sourceLocationOptions = useMemo(
    () => locations.filter((location) => String(location.id) !== String(activeLocationId)),
    [activeLocationId, locations]
  );

  function updateRequestItem(index, field, value) {
    setFormData((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    }));
  }

  function addRequestItem() {
    setFormData((current) => ({
      ...current,
      items: [...current.items, { item_id: "", quantity: "" }]
    }));
  }

  function removeRequestItem(index) {
    setFormData((current) => {
      const next = current.items.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        items: next.length > 0 ? next : [{ item_id: "", quantity: "" }]
      };
    });
  }

  function resetForm() {
    setFormData({
      source_location_id: "",
      notes: "",
      items: [{ item_id: "", quantity: "" }]
    });
  }

  async function handleCreate() {
    const validItems = formData.items.filter((entry) => entry.item_id && entry.quantity);

    if (!activeLocationId) {
      setError("Active location context is required to create requests");
      return;
    }

    if (!formData.source_location_id) {
      setError("Requesting from location is required");
      return;
    }

    if (validItems.length === 0) {
      setError("Add at least one request item");
      return;
    }

    try {
      setLoading(true);
      await createRequest({
        source_location_id: Number(formData.source_location_id),
        notes: formData.notes,
        items: validItems.map((entry) => ({
          item_id: Number(entry.item_id),
          quantity: Number(entry.quantity)
        }))
      });

      resetForm();
      await loadData(statusFilter);
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
    } catch (actionError) {
      setError(actionError.message || "Failed to create request");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id) {
    try {
      setLoading(true);
      await approveRequest(id, { reference: `REQ-${id}` });
      await loadData(statusFilter);
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
    } catch (actionError) {
      setError(actionError.message || "Failed to approve request");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(id) {
    try {
      setLoading(true);
      await rejectRequest(id, { reason: "Rejected by approver" });
      await loadData(statusFilter);
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
    } catch (actionError) {
      setError(actionError.message || "Failed to reject request");
    } finally {
      setLoading(false);
    }
  }

  const pendingApprovals = requests.filter((request) => request.status === "PENDING" && request.can_approve);
  const requestTable = useSortedPagination(requests, {
    initialSortKey: "created_at",
    initialSortDirection: "desc",
    initialPageSize: 10,
    getSortValue: (request, key) => {
      switch (key) {
        case "request_number":
          return request.request_number;
        case "requester_name":
          return request.requester_name;
        case "route":
          return getRequestRouteLabel(request);
        case "status":
          return request.status;
        case "items_count":
          return Array.isArray(request.items) ? request.items.length : 0;
        case "created_at":
          return request.created_at;
        default:
          return request?.[key];
      }
    }
  });
  const pagedRequests = requestTable.pagedRows;

  return (
    <DashboardLayout>
      <div className="module-placeholder">
        <span className="module-placeholder__eyebrow">Request Workflow</span>
        <h2>Stock Requests</h2>
        <p>Requests are created for your active location automatically.</p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="module-placeholder" style={{ marginTop: "1rem" }}>
        <h3>Create Request</h3>
        <div className="admin-grid admin-grid--requests">
          <div className="inventory-inline-chip">Requesting For: {destinationLocationName}</div>

          <select
            name="source_location_id"
            value={formData.source_location_id}
            onChange={(event) =>
              setFormData((current) => ({ ...current, source_location_id: event.target.value }))
            }
          >
            <option value="">Requesting From</option>
            {sourceLocationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <input
            name="notes"
            placeholder="Notes"
            value={formData.notes}
            onChange={(event) =>
              setFormData((current) => ({ ...current, notes: event.target.value }))
            }
          />
        </div>

        <div className="stack-list" style={{ marginTop: "1rem" }}>
          {formData.items.map((entry, index) => (
            <div key={`request-item-${index}`} className="admin-grid admin-grid--reports">
              <select
                value={entry.item_id}
                onChange={(event) => updateRequestItem(index, "item_id", event.target.value)}
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
                placeholder="Quantity"
                value={entry.quantity}
                onChange={(event) => updateRequestItem(index, "quantity", event.target.value)}
              />
              <button type="button" className="secondary-button" onClick={() => removeRequestItem(index)}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="inventory-card__actions">
          <button type="button" className="secondary-button" onClick={addRequestItem}>
            Add Item
          </button>
          <button type="button" className="primary-button" onClick={handleCreate} disabled={loading}>
            {loading ? "Saving..." : "Create Request"}
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginTop: "1rem" }}>
        <article className="stat-card stat-card--blue">
          <span className="stat-card__label">Pending Approvals</span>
          <strong className="stat-card__value">{pendingApprovals.length}</strong>
          <p className="stat-card__note">Pending requests your role can action now.</p>
        </article>
        <article className="stat-card stat-card--green">
          <span className="stat-card__label">All Visible Requests</span>
          <strong className="stat-card__value">{requests.length}</strong>
          <p className="stat-card__note">Current request workload.</p>
        </article>
      </div>

      <div className="module-placeholder" style={{ marginTop: "1rem" }}>
        <div className="table-toolbar">
          <h3>Requests</h3>
          <div className="action-row">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="FULFILLED">Fulfilled</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  <SortHeader
                    label="Request"
                    columnKey="request_number"
                    sortKey={requestTable.sortKey}
                    sortDirection={requestTable.sortDirection}
                    onSort={requestTable.toggleSort}
                  />
                </th>
                <th>
                  <SortHeader
                    label="Requester"
                    columnKey="requester_name"
                    sortKey={requestTable.sortKey}
                    sortDirection={requestTable.sortDirection}
                    onSort={requestTable.toggleSort}
                  />
                </th>
                <th>
                  <SortHeader
                    label="Route"
                    columnKey="route"
                    sortKey={requestTable.sortKey}
                    sortDirection={requestTable.sortDirection}
                    onSort={requestTable.toggleSort}
                  />
                </th>
                <th>
                  <SortHeader
                    label="Status"
                    columnKey="status"
                    sortKey={requestTable.sortKey}
                    sortDirection={requestTable.sortDirection}
                    onSort={requestTable.toggleSort}
                  />
                </th>
                <th>Items</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="data-table__empty">No requests found.</td>
                </tr>
              ) : (
                pagedRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.request_number}</td>
                    <td>{request.requester_name}</td>
                    <td>{getRequestRouteLabel(request)}</td>
                    <td>
                      <span className={`status-chip status-chip--${request.status.toLowerCase()}`}>
                        {request.status}
                      </span>
                    </td>
                    <td>
                      <div className="request-item-list">
                        {request.items?.map((item) => (
                          <ItemIdentity
                            key={`${request.id}-${item.id}`}
                            name={item.item_name}
                            imagePath={item.item_image}
                            meta={`${item.quantity} ${item.unit || ""}`.trim()}
                            compact
                          />
                        ))}
                      </div>
                    </td>
                    <td>
                      {request.status === "PENDING" && request.can_approve ? (
                        <div className="action-row">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => void handleApprove(request.id)}
                            disabled={loading}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => void handleReject(request.id)}
                            disabled={loading}
                          >
                            Reject
                          </button>
                        </div>
                      ) : currentRole === "admin" || currentRole === "superadmin" ? (
                        "No action"
                      ) : (
                        "View only"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={requestTable.page}
          pageSize={requestTable.pageSize}
          totalItems={requestTable.totalItems}
          totalPages={requestTable.totalPages}
          onPageChange={requestTable.setPage}
          onPageSizeChange={requestTable.setPageSize}
        />
      </div>
    </DashboardLayout>
  );
}

export default Requests;
