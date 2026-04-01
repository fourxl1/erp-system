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
import { hasAllowedRole, normalizeRoleName, readStoredUser } from "../utils/auth";

const LIVE_UPDATE_EVENT = "inventory-live-update";

const MASTER_DATA_SETTINGS_TABS = [
  "units",
  "locations",
  "sections",
  "assets",
  "suppliers",
  "users",
  "recipients"
];

const navSections = [
  {
    key: "main",
    label: "Main",
    items: [
      {
        path: "/dashboard",
        label: "Dashboard",
        description: "Overview and analytics",
        icon: "dashboard"
      }
    ]
  },
  {
    key: "inventory",
    label: "Inventory",
    items: [
      {
        path: "/inventory",
        label: "Items",
        description: "Browse and manage inventory items",
        icon: "items"
      },
      {
        path: "/master-data",
        tab: "categories",
        matchTabs: ["categories"],
        label: "Categories",
        description: "Manage item categories",
        icon: "categories",
        allowedRoles: ["admin", "superadmin"]
      },
      {
        path: "/movements",
        label: "Stock Movements",
        description: "Track stock in, out, and adjustments",
        icon: "movements"
      }
    ]
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      {
        path: "/requests",
        label: "Requests",
        description: "Requests and approvals",
        icon: "requests"
      },
      {
        path: "/maintenance",
        label: "Maintenance",
        description: "Repairs and maintenance",
        icon: "maintenance"
      },
      {
        path: "/messages",
        label: "Messages",
        description: "Inbox and internal communication",
        icon: "messages"
      }
    ]
  },
  {
    key: "analytics",
    label: "Analytics",
    items: [
      {
        path: "/reports",
        label: "Reports",
        description: "Operational and financial reporting",
        icon: "reports",
        allowedRoles: ["staff", "admin", "superadmin"]
      }
    ]
  },
  {
    key: "system",
    label: "System",
    items: [
      {
        path: "/master-data",
        tab: "users",
        matchTabs: MASTER_DATA_SETTINGS_TABS,
        label: "Settings",
        description: "Users, units, suppliers, and system data",
        icon: "settings",
        allowedRoles: ["admin", "superadmin"]
      }
    ]
  }
];

function formatRoleLabel(roleName) {
  const normalizedRole = normalizeRoleName(roleName);

  if (!normalizedRole) {
    return "User";
  }

  if (normalizedRole === "superadmin") {
    return "Super Admin";
  }

  return normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
}

function getActiveMasterDataTab(search) {
  const params = new URLSearchParams(search);
  return params.get("tab") || "categories";
}

function isNavItemActive(item, pathname, activeMasterTab) {
  if (item.path !== pathname) {
    return false;
  }

  if (item.path !== "/master-data") {
    return true;
  }

  if (!Array.isArray(item.matchTabs) || item.matchTabs.length === 0) {
    return true;
  }

  return item.matchTabs.includes(activeMasterTab);
}

function buildNavTarget(item) {
  if (!item.tab) {
    return item.path;
  }

  return {
    pathname: item.path,
    search: `?tab=${item.tab}`
  };
}

function SidebarIcon({ name }) {
  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      );
    case "items":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 8.5 12 4l8 4.5" />
          <path d="M4 8.5V16l8 4 8-4V8.5" />
          <path d="M12 12 20 8.5" />
          <path d="M12 12 4 8.5" />
          <path d="M12 12v8" />
        </svg>
      );
    case "categories":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6.5 7h11" />
          <path d="M6.5 12h11" />
          <path d="M6.5 17h11" />
          <circle cx="4.5" cy="7" r="1.25" />
          <circle cx="4.5" cy="12" r="1.25" />
          <circle cx="4.5" cy="17" r="1.25" />
        </svg>
      );
    case "movements":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 7h10" />
          <path d="m12 4 3 3-3 3" />
          <path d="M19 17H9" />
          <path d="m12 14-3 3 3 3" />
        </svg>
      );
    case "requests":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 4h8l4 4v11a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="M15 4v4h4" />
          <path d="M8.5 12h7" />
          <path d="M8.5 16h7" />
        </svg>
      );
    case "maintenance":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m14 7 3-3 3 3-3 3" />
          <path d="M5 19 14 10" />
          <path d="m4 14 6 6" />
          <path d="m7 11 6 6" />
        </svg>
      );
    case "messages":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-5 4V6.5Z" />
          <path d="m6.5 8 5.2 4 5.8-4" />
        </svg>
      );
    case "reports":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 20V9" />
          <path d="M12 20V4" />
          <path d="M18 20v-7" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.75 1.75 0 0 1-2.48 2.48l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.92V19.5A1.75 1.75 0 0 1 13.75 21h-3.5A1.75 1.75 0 0 1 8.5 19.25v-.15a1 1 0 0 0-.6-.92 1 1 0 0 0-1.1.2l-.1.1a1.75 1.75 0 1 1-2.48-2.48l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.92-.6H3.5A1.75 1.75 0 0 1 2 12.75v-1.5A1.75 1.75 0 0 1 3.75 9.5h.15a1 1 0 0 0 .92-.6 1 1 0 0 0-.2-1.1l-.1-.1A1.75 1.75 0 1 1 7 5.22l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.92V4.5A1.75 1.75 0 0 1 10.55 3h2.9A1.75 1.75 0 0 1 15.2 4.75v.15a1 1 0 0 0 .6.92 1 1 0 0 0 1.1-.2l.1-.1a1.75 1.75 0 0 1 2.48 2.48l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .92.6h.15A1.75 1.75 0 0 1 22 11.25v1.5A1.75 1.75 0 0 1 20.25 14h-.15a1 1 0 0 0-.7 1Z" />
        </svg>
      );
    default:
      return null;
  }
}

function DashboardLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = readStoredUser();
  const userName = localStorage.getItem("inventory-user") || "Store User";
  const currentRole = formatRoleLabel(currentUser.role_name);
  const activeMasterTab = getActiveMasterDataTab(location.search);

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
  const [showBackToTop, setShowBackToTop] = useState(false);
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

  useEffect(() => {
    function handleWindowScroll() {
      setShowBackToTop(window.scrollY > 280);
    }

    handleWindowScroll();
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleWindowScroll);
    };
  }, []);

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

  const visibleNavSections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => hasAllowedRole(currentUser, item.allowedRoles))
        }))
        .filter((section) => section.items.length > 0),
    [currentUser]
  );

  const currentNavItem = useMemo(
    () =>
      visibleNavSections
        .flatMap((section) => section.items)
        .find((item) => isNavItemActive(item, location.pathname, activeMasterTab)) ||
      visibleNavSections[0]?.items[0] ||
      navSections[0].items[0],
    [activeMasterTab, location.pathname, visibleNavSections]
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
          <div className="app-shell__sidebar-brand">
            <BrandMark minimal />
            <div className="app-shell__sidebar-status">
              <p className="app-shell__sidebar-copy app-shell__sidebar-copy--menu">Inventory System</p>
              <p className="app-shell__sidebar-copy">Latex Foam Store</p>
            </div>
          </div>
          <button
            className="app-shell__sidebar-close hide-tablet"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close menu"
          >
            x
          </button>
        </div>

        <div className="app-shell__sidebar-body">
          {visibleNavSections.map((section) => (
            <nav key={section.key} className="app-shell__nav-section" aria-label={section.label}>
              <p className="app-shell__nav-section-label">{section.label}</p>
              <div className="app-shell__nav">
                {section.items.map((item) => {
                  const isActive = isNavItemActive(item, location.pathname, activeMasterTab);

                  return (
                    <Link
                      key={`${item.path}-${item.tab || "default"}`}
                      to={buildNavTarget(item)}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`app-shell__nav-link ${isActive ? "app-shell__nav-link--active" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="app-shell__nav-icon" aria-hidden="true">
                        <SidebarIcon name={item.icon} />
                      </span>
                      <span className="app-shell__nav-link-content">
                        <span className="app-shell__nav-label">{item.label}</span>
                      </span>
                      {item.path === "/requests" && requestNotifications.length > 0 ? (
                        <span className="app-shell__nav-badge">{requestNotifications.length}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </nav>
          ))}
        </div>

        <div className="app-shell__sidebar-footer">
          <button className="app-shell__sidebar-utility" onClick={() => setShowContactModal(true)}>
            Report Issue
          </button>
          <div className="app-shell__sidebar-user-card">
            <div className="app-shell__sidebar-avatar">{userName.charAt(0).toUpperCase()}</div>
            <div className="app-shell__sidebar-user-meta">
              <span>{currentRole}</span>
              <strong>{userName}</strong>
            </div>
          </div>
          <button onClick={handleLogout} className="app-shell__sidebar-logout">
            Logout
          </button>
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

      <button
        type="button"
        className={`back-to-top ${showBackToTop ? "back-to-top--visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
      >
        <span aria-hidden="true">^</span>
        <span>Top</span>
      </button>

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
