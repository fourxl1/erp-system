import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ItemIdentity from "../components/ItemIdentity";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  fetchAlerts,
  fetchAvailableInventory,
  fetchInventoryStats,
  fetchRequests,
  markAlertAsRead
} from "../services/api";
import {
  buildRequestNotifications,
  dismissRequestNotificationKeys,
  getDismissedRequestNotificationKeys,
  REQUEST_NOTIFICATION_STATE_EVENT
} from "../utils/requestNotifications";

const LIVE_UPDATE_EVENT = "inventory-live-update";

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

function Dashboard() {
  const navigate = useNavigate();
  const currentUser = readStoredUser();
  const currentRole = normalizeRoleName(currentUser.role_name);
  const isStaff = currentRole === "staff";

  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, totalValue: null });
  const [alerts, setAlerts] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [dismissedKeys, setDismissedKeys] = useState(() =>
    getDismissedRequestNotificationKeys(currentUser.id)
  );

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [statsData, alertData, availabilityData] = await Promise.all([
          fetchInventoryStats(),
          fetchAlerts(),
          fetchAvailableInventory()
        ]);

        if (!active) {
          return;
        }

        setStats({
          totalItems: Number(statsData.totalItems || 0),
          lowStock: Number(statsData.lowStock || 0),
          totalValue: statsData.totalValue
        });
        setAlerts(Array.isArray(alertData) ? alertData : []);
        setAvailability((availabilityData || []).slice(0, 10));
        setError("");
      } catch (loadError) {
        setError(loadError.message || "Failed to load dashboard data");
      }
    }

    void loadDashboard();

    function handleLiveUpdate() {
      void loadDashboard();
    }

    window.addEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);

    return () => {
      active = false;
      window.removeEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
    };
  }, []);

  useEffect(() => {
    function handleNotificationStateRefresh() {
      setDismissedKeys(getDismissedRequestNotificationKeys(currentUser.id));
    }

    window.addEventListener(REQUEST_NOTIFICATION_STATE_EVENT, handleNotificationStateRefresh);

    return () => {
      window.removeEventListener(REQUEST_NOTIFICATION_STATE_EVENT, handleNotificationStateRefresh);
    };
  }, [currentUser.id]);

  useEffect(() => {
    let active = true;

    async function loadRequestsData() {
      try {
        const response = await fetchRequests();

        if (!active) {
          return;
        }

        setRequests(response.requests || []);
        setRequestError("");
      } catch (loadError) {
        setRequestError(loadError.message || "Failed to load requests");
      }
    }

    void loadRequestsData();
    const interval = window.setInterval(loadRequestsData, 30000);

    function handleLiveUpdate() {
      void loadRequestsData();
    }

    window.addEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
    };
  }, []);

  const cards = useMemo(() => {
    const items = [
      {
        label: "Total Items",
        value: stats.totalItems,
        helper: "Visible in current scope",
        icon: "IT",
        path: "/inventory"
      },
      {
        label: "Low Stock",
        value: stats.lowStock,
        helper: "Needs replenishment",
        icon: "LS",
        path: "/inventory"
      },
      {
        label: "Pending Requests",
        value: requests.filter((request) => request.status === "PENDING").length,
        helper: "Open workflows",
        icon: "RQ",
        path: "/requests"
      }
    ];

    if (!isStaff) {
      items.push({
        label: "Inventory Value",
        value: `$${Number(stats.totalValue || 0).toLocaleString()}`,
        helper: "Current book value",
        icon: "AV",
        path: "/reports"
      });
    }

    return items;
  }, [isStaff, requests, stats]);

  const requestNotifications = useMemo(
    () => buildRequestNotifications(requests, currentUser.id, dismissedKeys).slice(0, 4),
    [currentUser.id, dismissedKeys, requests]
  );

  const unreadAlerts = useMemo(
    () => alerts.filter((alert) => !alert.is_read).slice(0, 3),
    [alerts]
  );

  async function handleResolveAlert(alertId) {
    try {
      await markAlertAsRead(alertId);
      setAlerts((current) =>
        current.map((alert) =>
          alert.id === alertId ? { ...alert, is_read: true } : alert
        )
      );
    } catch (actionError) {
      setError(actionError.message || "Failed to update alert");
    }
  }

  function handleClearRequests() {
    dismissRequestNotificationKeys(
      currentUser.id,
      requestNotifications.map((notification) => notification.key)
    );
    window.dispatchEvent(new Event(REQUEST_NOTIFICATION_STATE_EVENT));
  }

  return (
    <DashboardLayout>
      <div className="dashboard-shell">
        <header className="dashboard-metrics-grid">
          {cards.map((card) => (
            <article
              key={card.label}
              className="dashboard-metric-card"
              onClick={() => navigate(card.path)}
            >
              <div className="dashboard-card__header">
                <p>{card.label}</p>
                <span className="dashboard-metric-card__icon">{card.icon}</span>
              </div>
              <h3>{card.value}</h3>
              <span className="dashboard-card__badge">{card.helper}</span>
            </article>
          ))}
        </header>

        {error ? <div className="dashboard-error-card">{error}</div> : null}

        <section className="dashboard-grid">
          <div className="dashboard-card dashboard-card--compact">
            <header className="dashboard-card__header">
              <div>
                <p className="dashboard-card__eyebrow">Requests</p>
                <h3>Workflow Notifications</h3>
              </div>
              <div className="action-row">
                <span className="dashboard-card__badge">{requestNotifications.length} Active</span>
                <button
                  type="button"
                  className="secondary-button secondary-button--small"
                  onClick={handleClearRequests}
                  disabled={requestNotifications.length === 0}
                >
                  Clear
                </button>
              </div>
            </header>

            {requestError ? <p className="dashboard-card__alert">{requestError}</p> : null}

            <div className="dashboard-notifications dashboard-notifications--compact">
              {requestNotifications.length === 0 ? (
                <div className="dashboard-card__empty dashboard-card__empty--compact">
                  <span>OK</span>
                  <p>All request workflows are up to date.</p>
                </div>
              ) : (
                requestNotifications.map((notification) => (
                  <article key={notification.key} className="dashboard-notification dashboard-notification--compact">
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                    </div>
                    <div className="action-row">
                      <span className="request-notice-card__meta">{notification.meta}</span>
                      <button
                        type="button"
                        className="secondary-button secondary-button--small"
                        onClick={() => navigate("/requests")}
                      >
                        Open
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-card dashboard-card--compact">
            <header className="dashboard-card__header">
              <div>
                <p className="dashboard-card__eyebrow">Alerts</p>
                <h3>Unread System Alerts</h3>
              </div>
              <span className="dashboard-card__badge">{unreadAlerts.length} Unread</span>
            </header>

            <div className="dashboard-alert-stream dashboard-alert-stream--compact">
              {unreadAlerts.length === 0 ? (
                <div className="dashboard-card__empty dashboard-card__empty--compact">
                  <span>AL</span>
                  <p>No active unread alerts.</p>
                </div>
              ) : (
                unreadAlerts.map((alert) => (
                  <article key={alert.id} className="dashboard-alert dashboard-alert--compact">
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.message}</p>
                    </div>
                    <button
                      type="button"
                      className="secondary-button secondary-button--small"
                      onClick={() => void handleResolveAlert(alert.id)}
                    >
                      Resolve
                    </button>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="dashboard-card dashboard-card--tall">
          <header className="dashboard-card__header">
            <div>
              <p className="dashboard-card__eyebrow">Stock Visibility</p>
              <h3>Items by Available Location</h3>
            </div>
            <button
              type="button"
              className="dashboard-hero-card__cta"
              onClick={() => navigate("/inventory")}
            >
              View Inventory
            </button>
          </header>
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Location</th>
                  <th className="text-right">Available Qty</th>
                </tr>
              </thead>
              <tbody>
                {availability.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="inventory-table__empty">
                      No stock snapshot available.
                    </td>
                  </tr>
                ) : (
                  availability.map((row) => (
                    <tr key={`${row.item_id}-${row.location_id}`}>
                      <td>
                        <ItemIdentity
                          name={row.item_name}
                          imagePath={row.item_image}
                          compact
                        />
                      </td>
                      <td>{row.location}</td>
                      <td className="text-right font-bold">{row.available_quantity}</td>
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

export default Dashboard;
