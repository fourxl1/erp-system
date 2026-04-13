import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ItemIdentity from "../components/ItemIdentity";
import SortHeader from "../components/SortHeader";
import TablePagination from "../components/TablePagination";
import DashboardLayout from "../layouts/DashboardLayout";
import { useActiveLocationId } from "../hooks/useActiveLocation";
import useSortedPagination from "../hooks/useSortedPagination";
import {
  fetchAvailableInventory,
  fetchInventoryStats,
  fetchNotifications,
  markNotificationAsRead
} from "../services/api";

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

function targetPathForType(type) {
  const normalized = String(type || "").toUpperCase();

  if (normalized === "REQUEST") {
    return "/requests";
  }

  if (normalized === "MESSAGE") {
    return "/messages";
  }

  if (normalized === "TRANSFER") {
    return "/movements";
  }

  return "/dashboard";
}

function Dashboard() {
  const navigate = useNavigate();
  const activeLocationId = useActiveLocationId();
  const currentUser = readStoredUser();
  const currentRole = normalizeRoleName(currentUser.role_name);
  const isStaff = currentRole === "staff";

  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, totalValue: null });
  const [availability, setAvailability] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      const [statsData, availabilityData, notificationData] = await Promise.all([
        fetchInventoryStats(),
        fetchAvailableInventory(),
        fetchNotifications({ limit: 20 })
      ]);

      setStats({
        totalItems: Number(statsData.totalItems || 0),
        lowStock: Number(statsData.lowStock || 0),
        totalValue: statsData.totalValue
      });
      setAvailability(availabilityData || []);
      setNotifications(Array.isArray(notificationData) ? notificationData : []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Failed to load dashboard data");
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    function handleLiveUpdate() {
      void loadDashboard();
    }

    window.addEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
    return () => {
      window.clearTimeout(loadTimer);
      window.removeEventListener(LIVE_UPDATE_EVENT, handleLiveUpdate);
    };
  }, [activeLocationId, loadDashboard]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.is_read),
    [notifications]
  );

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
        label: "Unread Notifications",
        value: unreadNotifications.length,
        helper: "Requests, messages, transfers",
        icon: "NT",
        path: "/dashboard"
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
  }, [isStaff, stats, unreadNotifications.length]);

  async function handleResolveNotification(id) {
    try {
      await markNotificationAsRead(id);
      setNotifications((current) =>
        current.map((entry) => (String(entry.id) === String(id) ? { ...entry, is_read: true } : entry))
      );
    } catch (actionError) {
      setError(actionError.message || "Failed to update notification");
    }
  }

  const availabilityTable = useSortedPagination(availability, {
    initialSortKey: "available_quantity",
    initialSortDirection: "desc",
    initialPageSize: 10,
    getSortValue: (row, key) => {
      switch (key) {
        case "item_name":
          return row.item_name;
        case "location":
          return row.location;
        case "available_quantity":
          return Number(row.available_quantity || 0);
        default:
          return row?.[key];
      }
    }
  });

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
                <p className="dashboard-card__eyebrow">Notifications</p>
                <h3>Recent Updates</h3>
              </div>
              <span className="dashboard-card__badge">{unreadNotifications.length} Unread</span>
            </header>

            <div className="dashboard-notifications dashboard-notifications--compact">
              {notifications.length === 0 ? (
                <div className="dashboard-card__empty dashboard-card__empty--compact">
                  <span>NT</span>
                  <p>No notifications yet.</p>
                </div>
              ) : (
                notifications.slice(0, 5).map((notification) => (
                  <article key={`${notification.id}-${notification.created_at}`} className="dashboard-notification dashboard-notification--compact">
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                    </div>
                    <div className="action-row">
                      <span className="request-notice-card__meta">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        className="secondary-button secondary-button--small"
                        onClick={() => navigate(targetPathForType(notification.type))}
                      >
                        Open
                      </button>
                      {!notification.is_read ? (
                        <button
                          type="button"
                          className="secondary-button secondary-button--small"
                          onClick={() => void handleResolveNotification(notification.id)}
                        >
                          Read
                        </button>
                      ) : null}
                    </div>
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
                  <th>
                    <SortHeader
                      label="Item"
                      columnKey="item_name"
                      sortKey={availabilityTable.sortKey}
                      sortDirection={availabilityTable.sortDirection}
                      onSort={availabilityTable.toggleSort}
                    />
                  </th>
                  <th>
                    <SortHeader
                      label="Location"
                      columnKey="location"
                      sortKey={availabilityTable.sortKey}
                      sortDirection={availabilityTable.sortDirection}
                      onSort={availabilityTable.toggleSort}
                    />
                  </th>
                  <th className="text-right">
                    <SortHeader
                      label="Available Qty"
                      columnKey="available_quantity"
                      sortKey={availabilityTable.sortKey}
                      sortDirection={availabilityTable.sortDirection}
                      onSort={availabilityTable.toggleSort}
                      align="right"
                    />
                  </th>
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
                  availabilityTable.pagedRows.map((row) => (
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

          <TablePagination
            page={availabilityTable.page}
            pageSize={availabilityTable.pageSize}
            totalItems={availabilityTable.totalItems}
            totalPages={availabilityTable.totalPages}
            onPageChange={availabilityTable.setPage}
            onPageSizeChange={availabilityTable.setPageSize}
          />
        </section>
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;
