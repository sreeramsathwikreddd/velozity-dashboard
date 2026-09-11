import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AppNotification } from "../types";
import { useSocket } from "../hooks/useSocket";

export default function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get("/notifications").then((r) => {
      setItems(r.data.notifications);
      setUnread(r.data.unreadCount);
    });
  }, []);

  useSocket({
    onNotification: (n) => {
      setItems((prev) => [n, ...prev]);
      setUnread((u) => u + 1);
    },
  });

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  }

  async function markAllRead() {
    await api.patch("/notifications/read-all");
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  }

  return (
    <div className="bell-wrap">
      <button className="bell-btn" onClick={() => setOpen((o) => !o)}>
        Notifications
        {unread > 0 && <span className="bell-count">{unread}</span>}
      </button>
      {open && (
        <div className="bell-dropdown">
          <div className="bell-dropdown-header">
            <span>Notifications</span>
            <button onClick={markAllRead}>Mark all read</button>
          </div>
          {items.length === 0 && <p className="empty-state" style={{ padding: "12px" }}>Nothing yet — you'll see task assignments and review requests here.</p>}
          {items.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.read ? "" : "unread"}`}
              onClick={() => !n.read && markRead(n.id)}
            >
              {n.message}
              <div className="notif-time">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
