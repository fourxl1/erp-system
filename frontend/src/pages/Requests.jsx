import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import ItemIdentity from "../components/ItemIdentity";
import {
  approveRequest,
  createRequest,
  fetchItems,
  fetchRequestLocations,
  fetchRequests,
  rejectRequest
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

function normalizeRequestViewFilter(roleName) {
  return roleName === "admin" || roleName === "superadmin" ? "actionable" : "mine";
}

function announceRequestUpdate() {
  window.dispatchEvent(new Event("inventory-requests-changed"));
}

function Requests() {
  const currentUser = readStoredUser();
  const currentRole = normalizeRoleName(currentUser.role_name);
  const fixedDestinationLocationId =
    currentRole === "superadmin" ? "" : String(currentUser.location_id || "");

  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [locations, setLocations] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [viewFilter, setViewFilter] = useState(normalizeRequestViewFilter(currentRole));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    item_id: "",
    quantity: "",
    location_id: fixedDestinationLocationId,
    source_location_id: "",
    notes: ""
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
      console.error("Failed to load requests data", loadError);
      setError(loadError.message || "Failed to load requests");
    }
  }, []);

  useEffect(() => {
    void loadData(statusFilter);
  }, [loadData, statusFilter]);

  useEffect(() => {
    if (fixedDestinationLocationId) {
      setFormData((current) => ({
        ...current,
        location_id: fixedDestinationLocationId
      }));
    }
  }, [fixedDestinationLocationId]);

  useEffect(() => {
    setViewFilter(normalizeRequestViewFilter(currentRole));
  }, [currentRole]);

  const sourceLocationOptions = useMemo(
    () => locations.filter((location) => String(location.id) !== String(formData.location_id)),
    [formData.location_id, locations]
  );

  const visibleRequests = useMemo(() => {
    switch (viewFilter) {
      case "actionable":
        return requests.filter((request) => request.status === "PENDING" && request.can_approve);
      case "waiting":
        return requests.filter((request) => request.status === "PENDING" && !request.can_approve);
      case "mine":
        return requests.filter((request) => Number(request.requester_id) === Number(currentUser.id));
      default:
        return requests;
    }
  }, [currentUser.id, requests, viewFilter]);

  const requestSummary = useMemo(
    () => ({
      actionable: requests.filter((request) => request.status === "PENDING" && request.can_approve).length,
      waiting: requests.filter((request) => request.status === "PENDING" && !request.can_approve).length,
      mine: requests.filter((request) => Number(request.requester_id) === Number(currentUser.id)).length,
      all: requests.length
    }),
    [currentUser.id, requests]
  );

  const viewOptions =
    currentRole === "admin" || currentRole === "superadmin"
      ? [
          { value: "actionable", label: "Needs My Approval" },
          { value: "waiting", label: "Awaiting Other Admin" },
          { value: "mine", label: "Created By Me" },
          { value: "all", label: "All Visible Requests" }
        ]
      : [
          { value: "mine", label: "My Requests" },
          { value: "all", label: "All Visible Requests" }
        ];

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
      ...(name === "location_id" && value === current.source_location_id
        ? { source_location_id: "" }
        : {})
    }));
  }

  function resetForm() {
    setFormData({
      item_id: "",
      quantity: "",
      location_id: fixedDestinationLocationId,
      source_location_id: "",
      notes: ""
    });
  }

  async function handleCreate() {
    if (!formData.item_id || !formData.quantity) {
      setError("Item and quantity are required");
      return;
    }

    if (!formData.location_id) {
      setError("Requesting For location is required");
      return;
    }

    if (!formData.source_location_id) {
      setError("Requesting From location is required");
      return;
    }

    if (String(formData.location_id) === String(formData.source_location_id)) {
      setError("Requesting From cannot be the same as Requesting For");
      return;
    }

    try {
      setLoading(true);
      await createRequest({
        location_id: Number(formData.location_id),
        source_location_id: Number(formData.source_location_id),
        notes: formData.notes,
        items: [
          {
            item_id: Number(formData.item_id),
            quantity: Number(formData.quantity)
          }
        ]
      });

      resetForm();
      await loadData(statusFilter);
      announceRequestUpdate();
    } catch (actionError) {
      console.error(actionError);
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
      announceRequestUpdate();
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to approve request");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(id) {
    try {
      setLoading(true);
      await rejectRequest(id, { reason: "Rejected from requests dashboard" });
      await loadData(statusFilter);
      announceRequestUpdate();
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to reject request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="module-placeholder">
        <span className="module-placeholder__eyebrow">Request Workflow</span>
        <h2>Stock Requests</h2>
        <p>Create requests from a source store to the requesting store, then let the source admin approve or reject.</p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="module-placeholder" style={{ marginTop: "1rem" }}>
        <h3>Create Request</h3>
        <div className="admin-grid admin-grid--requests">
          <select
            name="location_id"
            value={formData.location_id}
            onChange={handleChange}
            disabled={Boolean(fixedDestinationLocationId)}
          >
            <option value="">Requesting For</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <select
            name="source_location_id"
            value={formData.source_location_id}
            onChange={handleChange}
          >
            <option value="">Requesting From</option>
            {sourceLocationOptions.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <select name="item_id" value={formData.item_id} onChange={handleChange}>
            <option value="">Select Item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            name="quantity"
            placeholder="Quantity"
            value={formData.quantity}
            onChange={handleChange}
          />

          <input name="notes" placeholder="Notes" value={formData.notes} onChange={handleChange} />

          <button type="button" className="primary-button" onClick={handleCreate} disabled={loading}>
            {loading ? "Saving..." : "Create"}
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginTop: "1rem" }}>
        <article className="stat-card stat-card--blue">
          <span className="stat-card__label">Needs My Approval</span>
          <strong className="stat-card__value">{requestSummary.actionable}</strong>
          <p className="stat-card__note">Pending requests your role can action now.</p>
        </article>
        <article className="stat-card stat-card--green">
          <span className="stat-card__label">Created By Me</span>
          <strong className="stat-card__value">{requestSummary.mine}</strong>
          <p className="stat-card__note">Requests you entered into the workflow.</p>
        </article>
        <article className="stat-card stat-card--red">
          <span className="stat-card__label">Awaiting Other Admin</span>
          <strong className="stat-card__value">{requestSummary.waiting}</strong>
          <p className="stat-card__note">Pending requests owned by another source store.</p>
        </article>
      </div>

      <div className="module-placeholder" style={{ marginTop: "1rem" }}>
        <div className="table-toolbar">
          <h3>Requests</h3>
          <div className="action-row">
            <select value={viewFilter} onChange={(event) => setViewFilter(event.target.value)}>
              {viewOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
                <th>Request</th>
                <th>Requester</th>
                <th>Route</th>
                <th>Status</th>
                <th>Items</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="data-table__empty">No requests found for this view.</td>
                </tr>
              ) : (
                visibleRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.request_number}</td>
                    <td>{request.requester_name}</td>
                    <td>
                      {request.source_location_name
                        ? `${request.source_location_name} -> ${request.destination_location_name}`
                        : request.destination_location_name}
                    </td>
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
                            onClick={() => handleApprove(request.id)}
                            disabled={loading}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => handleReject(request.id)}
                            disabled={loading}
                          >
                            Reject
                          </button>
                        </div>
                      ) : request.status === "PENDING" ? (
                        request.source_location_name
                          ? `Awaiting ${request.source_location_name} admin`
                          : "Awaiting source admin"
                      ) : (
                        "Closed"
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

export default Requests;
