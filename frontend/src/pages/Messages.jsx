import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import {
  fetchMessageUsers,
  fetchMessages,
  markMessageAsRead,
  sendMessage
} from "../services/api";
import { getSocket } from "../services/socket";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("inventory-user-data") || "{}");
  } catch {
    return {};
  }
}

const emptyForm = {
  receiver_id: "",
  subject: "",
  message: ""
};

function Messages() {
  const currentUser = readStoredUser();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeBox, setActiveBox] = useState("all");

  const loadData = useCallback(async () => {
    try {
      const [messageData, userData] = await Promise.all([fetchMessages(), fetchMessageUsers()]);
      setMessages(Array.isArray(messageData) ? messageData : []);
      setUsers(Array.isArray(userData) ? userData : []);
      setError("");
    } catch (loadError) {
      console.error("Failed to load messages", loadError);
      setError(loadError.message || "Failed to load messages");
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const socket = getSocket();

    function handleNewMessage() {
      void loadData();
    }

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [loadData]);

  const filteredMessages = useMemo(() => {
    if (activeBox === "received") {
      return messages.filter((message) => message.message_box === "received");
    }

    if (activeBox === "sent") {
      return messages.filter((message) => message.message_box === "sent");
    }

    return messages;
  }, [activeBox, messages]);

  const unreadCount = useMemo(
    () =>
      messages.filter(
        (message) => message.message_box === "received" && !message.is_read
      ).length,
    [messages]
  );

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.receiver_id || !formData.message.trim()) {
      setError("Receiver and message are required");
      return;
    }

    try {
      setLoading(true);
      await sendMessage({
        receiver_id: Number(formData.receiver_id),
        subject: formData.subject.trim(),
        message: formData.message.trim()
      });
      setFormData(emptyForm);
      await loadData();
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenMessage(message) {
    if (message.message_box !== "received" || message.is_read) {
      return;
    }

    try {
      await markMessageAsRead(message.id);
      setMessages((current) =>
        current.map((entry) =>
          entry.id === message.id ? { ...entry, is_read: true } : entry
        )
      );
    } catch (actionError) {
      console.error(actionError);
      setError(actionError.message || "Failed to mark message as read");
    }
  }

  return (
    <DashboardLayout>
      <div className="inventory-shell space-y-6">
        <section className="inventory-hero">
          <div className="inventory-hero__content">
            <p className="inventory-hero__eyebrow">Messaging</p>
            <h2 className="inventory-hero__title">Internal Messages</h2>
            <p className="inventory-hero__copy">
              Send store-to-store messages and review received updates in descending time order.
            </p>
          </div>
          <div className="inventory-hero__stats">
            <article>
              <p>Unread Inbox</p>
              <strong>{unreadCount}</strong>
            </article>
            <article>
              <p>Total Messages</p>
              <strong>{messages.length}</strong>
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
              <p className="dashboard-card__eyebrow">Compose</p>
              <h3>Send a Message</h3>
            </div>
          </div>
          <form className="inventory-card__body" onSubmit={handleSubmit}>
            <div className="admin-grid admin-grid--reports">
              <label className="field">
                <span>Receiver</span>
                <select
                  name="receiver_id"
                  className="inventory-input"
                  value={formData.receiver_id}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      receiver_id: event.target.value
                    }))
                  }
                >
                  <option value="">Select User</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.role_name})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Subject</span>
                <input
                  name="subject"
                  className="inventory-input"
                  value={formData.subject}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      subject: event.target.value
                    }))
                  }
                  placeholder="Optional subject"
                />
              </label>
            </div>

            <label className="field" style={{ marginTop: "1rem" }}>
              <span>Message</span>
              <textarea
                name="message"
                className="inventory-input inventory-input--textarea"
                value={formData.message}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    message: event.target.value
                  }))
                }
                placeholder="Enter your message"
              />
            </label>

            <div className="inventory-card__actions" style={{ marginTop: "1rem" }}>
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? "Sending..." : "Send Message"}
              </button>
            </div>
          </form>
        </section>

        <section className="inventory-panel">
          <div className="inventory-panel__header">
            <div>
              <p className="dashboard-card__eyebrow">Inbox</p>
              <h3>Messages</h3>
            </div>
            <div className="action-row">
              <button
                type="button"
                className={`secondary-button secondary-button--small ${activeBox === "all" ? "request-center__trigger--active" : ""}`}
                onClick={() => setActiveBox("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`secondary-button secondary-button--small ${activeBox === "received" ? "request-center__trigger--active" : ""}`}
                onClick={() => setActiveBox("received")}
              >
                Received
              </button>
              <button
                type="button"
                className={`secondary-button secondary-button--small ${activeBox === "sent" ? "request-center__trigger--active" : ""}`}
                onClick={() => setActiveBox("sent")}
              >
                Sent
              </button>
            </div>
          </div>

          <div className="stack-list">
            {filteredMessages.length === 0 ? (
              <div className="empty-state">No messages found.</div>
            ) : (
              filteredMessages.map((message) => {
                const isUnread =
                  message.message_box === "received" && !message.is_read;

                return (
                  <button
                    key={message.id}
                    type="button"
                    className="request-notice-card"
                    style={{
                      textAlign: "left",
                      borderColor: isUnread ? "rgba(220, 28, 35, 0.2)" : undefined,
                      background: isUnread ? "rgba(254, 242, 242, 0.82)" : undefined
                    }}
                    onClick={() => handleOpenMessage(message)}
                  >
                    <div className="request-notice-card__header">
                      <div className="request-notice-card__header-main">
                        <span
                          className={`status-chip status-chip--${
                            message.message_box === "sent" ? "approved" : "pending"
                          }`}
                        >
                          {message.message_box === "sent" ? "Sent" : "Received"}
                        </span>
                        {isUnread ? (
                          <span className="status-chip status-chip--rejected">Unread</span>
                        ) : null}
                      </div>
                      <span className="request-notice-card__meta">
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="request-notice-card__copy">
                      <strong>{message.subject || "No subject"}</strong>
                      <p>{message.message}</p>
                    </div>

                    <div className="request-notice-card__meta">
                      {message.message_box === "sent"
                        ? `To: ${message.receiver_name}`
                        : `From: ${message.sender_name}`}
                    </div>
                    {message.message_box === "received" ? (
                      <div className="request-notice-card__meta">
                        Receiver: {currentUser.full_name || currentUser.email || "Current User"}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default Messages;
