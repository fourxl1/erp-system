import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import { createIssue, fetchAlerts, fetchRequests, markAlertAsRead } from "../services/api";
import { disconnectSocket, getSocket } from "../services/socket";
import {
  buildRequestNotifications,
  dismissRequestNotificationKeys,
  getDismissedRequestNotificationKeys,
  REQUEST_NOTIFICATION_STATE_EVENT,
  REQUEST_REFRESH_EVENT
} from "../utils/requestNotifications";
import { hasAllowedRole, readStoredUser } from "../utils/auth";

const LIVE_UPDATE_EVENT = "inventory-live-update";

const navItems = [
  { path: "/dashboard", label: "Dashboard", description: "Overview and analytics", icon: "DB" },
  { path: "/inventory", label: "Inventory", description: "Stores, counts, and categories", icon: "IV" },
  { path: "/movements", label: "Movements", description: "Stock in, out, transfers, and adjustments", icon: "MV" },
  { path: "/requests", label: "Requests", description: "Requests and approvals", icon: "RQ" },
  { path: "/messages", label: "Messages", description: "Inbox and internal communication", icon: "MS" },
  { path: "/maintenance", label: "Maintenance", description: "Repairs and maintenance", icon: "MT" },
  {
    path: "/master-data",
    label: "Master Data",
    description: "Locations, suppliers, units, and users",
    icon: "MD",
    allowedRoles: ["admin", "superadmin"]
  },
  {
    path: "/reports",
    label: "Reports",
    description: "Operational and financial reporting",
    icon: "RP",
    allowedRoles: ["staff", "admin", "superadmin"]
  }
];

function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = readStoredUser();
  const userName = localStorage.getItem("inventory-user") || "Store User";

  const [issueTitle, setIssueTitle] = useState("");
  const [issueMessage, setIssueMessage] = useState("");
  const [issueRelatedReport, setIssueRelatedReport] = useState("");
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueFeedback, setIssueFeedback] = useState({ type: "", message: "" });
  const [requests, setRequests] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dismissedKeys, setDismissedKeys] = useState(() =>
    getDismissedRequestNotificationKeys(currentUser.id)
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);

  async function handleSendIssue() {
    if (!issueTitle.trim()) {
      setIssueFeedback({ type: "error", message: "Issue title is required." });
      return;
    }

    if (!issueMessage.trim()) {
      setIssueFeedback({ type: "error", message: "Issue description is required." });
      return;
    }

    try {
      setIssueSubmitting(true);
      await createIssue({
        title: issueTitle,
        description: issueMessage,
        related_report: issueRelatedReport || location.pathname
      });

      setIssueFeedback({ type: "success", message: "Issue sent successfully." });
      setIssueTitle("");
      setIssueMessage("");
      setIssueRelatedReport("");
      setShowContactModal(false);
    } catch (error) {
      console.error(error);
      setIssueFeedback({ type: "error", message: error.message || "Failed to send issue." });
    } finally {
      setIssueSubmitting(false);
    }
  }

  function handleLogout() {
    disconnectSocket();
    localStorage.removeItem("token");
    localStorage.removeItem("inventory-user");
    localStorage.removeItem("inventory-user-data");
    navigate("/login");
  }

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        const [requestData, alertData] = await Promise.all([fetchRequests(), fetchAlerts()]);

        if (!active) {
          return;
        }

        setRequests(requestData.requests || []);
        setAlerts(Array.isArray(alertData) ? alertData : []);
      } catch (error) {
        console.error("Failed to load notification center", error);
      }
    }

    function handleRequestRefresh() {
      void loadNotifications();
    }

    function handleNotificationStateRefresh() {
      setDismissedKeys(getDismissedRequestNotificationKeys(currentUser.id));
    }

    void loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);

    window.addEventListener(REQUEST_REFRESH_EVENT, handleRequestRefresh);
    window.addEventListener(REQUEST_NOTIFICATION_STATE_EVENT, handleNotificationStateRefresh);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener(REQUEST_REFRESH_EVENT, handleRequestRefresh);
      window.removeEventListener(REQUEST_NOTIFICATION_STATE_EVENT, handleNotificationStateRefresh);
    };
  }, [currentUser.id]);

  useEffect(() => {
    const socket = getSocket();

    function handleLiveUpdate() {
      window.dispatchEvent(new Event(REQUEST_REFRESH_EVENT));
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
    }

    socket.on("new_message", handleLiveUpdate);
    socket.on("stock_request_created", handleLiveUpdate);
    socket.on("stock_request_approved", handleLiveUpdate);
    socket.on("stock_request_rejected", handleLiveUpdate);
    socket.on("low_stock_alert", handleLiveUpdate);

    return () => {
      socket.off("new_message", handleLiveUpdate);
      socket.off("stock_request_created", handleLiveUpdate);
      socket.off("stock_request_approved", handleLiveUpdate);
      socket.off("stock_request_rejected", handleLiveUpdate);
      socket.off("low_stock_alert", handleLiveUpdate);
    };
  }, []);

  useEffect(() => {
    setShowNotificationCenter(false);
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const requestNotifications = useMemo(
    () => buildRequestNotifications(requests, currentUser.id, dismissedKeys),
    [currentUser.id, dismissedKeys, requests]
  );

  const unreadAlerts = useMemo(
    () => alerts.filter((alert) => !alert.is_read),
    [alerts]
  );

  useEffect(() => {
    if (location.pathname !== "/requests" || requestNotifications.length === 0) {
      return;
    }

    const nextDismissed = dismissRequestNotificationKeys(
      currentUser.id,
      requestNotifications.map((notification) => notification.key)
    );
    setDismissedKeys(nextDismissed);
    window.dispatchEvent(new Event(REQUEST_NOTIFICATION_STATE_EVENT));
  }, [currentUser.id, location.pathname, requestNotifications]);

  const notificationCount = requestNotifications.length + unreadAlerts.length;

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => hasAllowedRole(currentUser, item.allowedRoles)),
    [currentUser]
  );

  const currentNavItem = useMemo(
    () => visibleNavItems.find((item) => item.path === location.pathname) || visibleNavItems[0] || navItems[0],
    [location.pathname, visibleNavItems]
  );

  async function handleResolveAlert(alertId) {
    try {
      await markAlertAsRead(alertId);
      setAlerts((current) =>
        current.map((alert) =>
          alert.id === alertId ? { ...alert, is_read: true } : alert
        )
      );
    } catch (error) {
      console.error(error);
    }
  }

  async function handleClearAlerts() {
    const unreadAlertIds = unreadAlerts.map((alert) => alert.id);

    try {
      await Promise.all(unreadAlertIds.map((alertId) => markAlertAsRead(alertId)));
      setAlerts((current) =>
        current.map((alert) =>
          unreadAlertIds.includes(alert.id) ? { ...alert, is_read: true } : alert
        )
      );
    } catch (error) {
      console.error(error);
    }
  }

  function handleClearRequests() {
    const nextDismissed = dismissRequestNotificationKeys(
      currentUser.id,
      requestNotifications.map((notification) => notification.key)
    );
    setDismissedKeys(nextDismissed);
    window.dispatchEvent(new Event(REQUEST_NOTIFICATION_STATE_EVENT));
  }

  return (
    <div className={`app-shell ${isSidebarOpen ? "app-shell--sidebar-open" : ""}`}>
      {isSidebarOpen ? (
        <div className="app-shell__overlay" onClick={() => setIsSidebarOpen(false)} />
      ) : null}

      <aside className="app-shell__sidebar">
        <div className="app-shell__sidebar-header">
          <BrandMark compact />
          <button
            className="app-shell__sidebar-close hide-tablet"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close menu"
          >
            x
          </button>
          <div className="app-shell__sidebar-status">
            <p className="app-shell__sidebar-copy app-shell__sidebar-copy--menu">Main Menu</p>
          </div>
        </div>

        <nav className="app-shell__nav">
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`app-shell__nav-link ${isActive ? "app-shell__nav-link--active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="app-shell__nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="app-shell__nav-link-content">
                  <span className="app-shell__nav-label">{item.label}</span>
                  <small className="app-shell__nav-desc">{item.description}</small>
                </span>
                {item.path === "/requests" && requestNotifications.length > 0 ? (
                  <span className="app-shell__nav-badge">{requestNotifications.length}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <button className="app-shell__sidebar-signout" onClick={() => setShowContactModal(true)}>
          Report Issue
        </button>

        <div className="app-shell__sidebar-footer">
          <div className="app-shell__sidebar-user-card">
            <div className="app-shell__sidebar-avatar">{userName.charAt(0).toUpperCase()}</div>
            <div className="app-shell__sidebar-user-meta">
              <span>Signed in</span>
              <strong>{userName}</strong>
            </div>
          </div>
        </div>
      </aside>

      <main className="app-shell__main">
        <header className="app-shell__topbar">
          <button className="app-shell__menu-toggle" onClick={() => setIsSidebarOpen((open) => !open)}>
            <span />
            <span />
            <span />
          </button>

          <div className="app-shell__header-copy">
            <p className="app-shell__eyebrow">LATEX FOAM STORE</p>
            <h1 className="app-shell__title">{currentNavItem.label}</h1>
            <p className="app-shell__subtitle hide-mobile">{currentNavItem.description}</p>
          </div>

          <div className="app-shell__topbar-actions">
            <div className="app-shell__user hide-tablet">
              <p className="app-shell__user-label">Signed in</p>
              <strong>{userName}</strong>
            </div>

            <div className="notification-center">
              <button
                type="button"
                className={`notification-center__trigger ${showNotificationCenter ? "notification-center__trigger--active" : ""}`}
                onClick={() => setShowNotificationCenter((open) => !open)}
              >
                <span className="notification-center__icon">NT</span>
                <span className="notification-center__label">Notifications</span>
                <span className="notification-center__count">{notificationCount}</span>
              </button>

              {showNotificationCenter ? (
                <div className="notification-center__panel">
                  <div className="notification-center__section">
                    <div className="notification-center__section-header">
                      <div>
                        <strong>Requests</strong>
                        <p>Approval and workflow updates</p>
                      </div>
                      <button
                        type="button"
                        className="secondary-button secondary-button--small"
                        onClick={handleClearRequests}
                        disabled={requestNotifications.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="notification-center__feed">
                      {requestNotifications.length === 0 ? (
                        <div className="empty-state">No pending request notifications.</div>
                      ) : (
                        requestNotifications.slice(0, 5).map((notification) => (
                          <button
                            key={notification.key}
                            type="button"
                            className="request-notice-card request-notice-card--compact"
                            onClick={() => {
                              navigate("/requests");
                              setShowNotificationCenter(false);
                            }}
                          >
                            <div className="request-notice-card__header">
                              <div className="request-notice-card__header-main">
                                <span className={`status-chip status-chip--${notification.status.toLowerCase()}`}>
                                  {notification.status}
                                </span>
                                <strong>{notification.title}</strong>
                              </div>
                              <span className="request-notice-card__meta">{notification.meta}</span>
                            </div>
                            <p>{notification.message}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="notification-center__section">
                    <div className="notification-center__section-header">
                      <div>
                        <strong>Alerts</strong>
                        <p>Unread system alerts</p>
                      </div>
                      <button
                        type="button"
                        className="secondary-button secondary-button--small"
                        onClick={() => void handleClearAlerts()}
                        disabled={unreadAlerts.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="notification-center__feed">
                      {unreadAlerts.length === 0 ? (
                        <div className="empty-state">No unread system alerts.</div>
                      ) : (
                        unreadAlerts.slice(0, 5).map((alert) => (
                          <article key={alert.id} className="request-notice-card request-notice-card--compact">
                            <div className="request-notice-card__header">
                              <div className="request-notice-card__header-main">
                                <span className="status-chip status-chip--rejected">Alert</span>
                                <strong>{alert.title}</strong>
                              </div>
                              <span className="request-notice-card__meta">
                                {new Date(alert.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p>{alert.message}</p>
                            <div className="action-row">
                              <button
                                type="button"
                                className="secondary-button secondary-button--small"
                                onClick={() => void handleResolveAlert(alert.id)}
                              >
                                Resolve
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <button onClick={handleLogout} className="app-shell__logout-link">
              Sign Out
            </button>
          </div>
        </header>

        <section className="app-shell__content">
          {issueFeedback.message ? (
            <div className={`dashboard-card__alert dashboard-card__alert--${issueFeedback.type || "info"}`}>
              <span>{issueFeedback.message}</span>
              <button
                type="button"
                className="alert-close"
                onClick={() => setIssueFeedback({ type: "", message: "" })}
              >
                x
              </button>
            </div>
          ) : null}
          {children}
        </section>
      </main>

      {showContactModal ? (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <h2>Report an Issue</h2>
            <p>Tell us what is wrong or what you need help with.</p>
            <input
              placeholder="Issue title"
              className="modal-input"
              value={issueTitle}
              onChange={(event) => setIssueTitle(event.target.value)}
            />
            <input
              placeholder="Related report or page"
              className="modal-input"
              value={issueRelatedReport}
              onChange={(event) => setIssueRelatedReport(event.target.value)}
            />
            <textarea
              placeholder="Describe your issue..."
              className="modal-textarea"
              value={issueMessage}
              onChange={(event) => setIssueMessage(event.target.value)}
            />
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setShowContactModal(false);
                  setIssueFeedback({ type: "", message: "" });
                }}
              >
                Cancel
              </button>
              <button className="primary-button" onClick={handleSendIssue} disabled={issueSubmitting}>
                {issueSubmitting ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DashboardLayout;
