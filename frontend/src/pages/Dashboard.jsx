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
  getDismissedRequestNotificationKeys
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

  const dismissedKeys = getDismissedRequestNotificationKeys(currentUser.id);

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
        setAlerts(alertData || []);
        setAvailability((availabilityData || []).slice(0, 12));
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
        label: "Total Items in Store",
        value: stats.totalItems,
        helper: "Managed Items in Stores",
        icon: "IT",
        path: "/inventory"
      },
      {
        label: "Low Stock Items",
        value: stats.lowStock,
        helper: "Requires Action",
        icon: "LS",
        path: "/inventory"
      }
    ];

    if (!isStaff) {
      items.push({
        label: "Total Asset Value",
        value: `$${Number(stats.totalValue || 0).toLocaleString()}`,
        helper: "Current Book Value",
        icon: "AV",
        path: "/reports"
      });
    }

    return items;
  }, [isStaff, stats]);

  const requestNotifications = useMemo(
    () => buildRequestNotifications(requests, currentUser.id, dismissedKeys).slice(0, 6),
    [currentUser.id, dismissedKeys, requests]
  );

  const availableAlerts = alerts.slice(0, 5);

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
                <span style={{ fontSize: "1.5rem" }}>{card.icon}</span>
              </div>
              <h3>{card.value}</h3>
              <span className="dashboard-card__badge">{card.helper}</span>
            </article>
          ))}
        </header>

        {error ? <div className="dashboard-error-card">{error}</div> : null}

        <section className="dashboard-grid">
          <div className="dashboard-card">
            <header className="dashboard-card__header">
              <div>
                <p className="dashboard-card__eyebrow">Items Requests</p>
                <h3>All Requests</h3>
              </div>
              <span className="dashboard-card__badge">
                {requestNotifications.length} Pending
              </span>
            </header>

            {requestError ? <p className="dashboard-card__alert">{requestError}</p> : null}

            <div className="dashboard-notifications">
              {requestNotifications.length === 0 ? (
                <div className="dashboard-card__empty" style={{ textAlign: "center", padding: "2rem 0" }}>
                  <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>OK</span>
                  <p>All workflows are up to date</p>
                </div>
              ) : (
                requestNotifications.map((notification) => (
                  <article key={notification.key} className="dashboard-notification">
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                    </div>
                    <span>{notification.meta}</span>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card__header">
              <div>
                <p className="dashboard-card__eyebrow">System Alerts</p>
                <h3>All Alerts</h3>
              </div>
              <button
                type="button"
                className="dashboard-card__ghost"
                onClick={() => availableAlerts.forEach((alert) => markAlertAsRead(alert.id))}
              >
                Mark all resolved
              </button>
            </div>
            <div className="dashboard-alert-stream">
              {availableAlerts.length === 0 ? (
                <div className="dashboard-card__empty" style={{ textAlign: "center", padding: "2rem 0" }}>
                  <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>AL</span>
                  <p>No active system alerts</p>
                </div>
              ) : (
                availableAlerts.map((alert) => (
                  <article key={alert.id} className="dashboard-alert">
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.message}</p>
                    </div>
                    <button
                      type="button"
                      className="dashboard-alert__resolve"
                      onClick={() => markAlertAsRead(alert.id)}
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
              <p className="dashboard-card__eyebrow">All Stores Summary</p>
              <h3>Items Location Summary</h3>
            </div>
            <button
              type="button"
              className="dashboard-hero-card__cta"
              onClick={() => navigate("/inventory")}
            >
              View My Store
            </button>
          </header>
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Primary Location</th>
                  <th className="text-right">Qty Available</th>
                </tr>
              </thead>
              <tbody>
                {availability.map((row) => (
                  <tr key={`${row.item_id}-${row.location_id}`}>
                    <td>
                      <ItemIdentity name={row.item_name} imagePath={row.item_image} compact />
                    </td>
                    <td>{row.location}</td>
                    <td className="text-right" style={{ fontWeight: "bold" }}>
                      {row.available_quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;
