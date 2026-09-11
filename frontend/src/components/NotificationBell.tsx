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
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)}>
        Notifications{unread > 0 ? ` (${unread})` : ""}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, background: "#fff", border: "1px solid #ccc", width: 320, maxHeight: 400, overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 8 }}>
            <strong>Notifications</strong>
            <button onClick={markAllRead}>Mark all read</button>
          </div>
          {items.length === 0 && <p style={{ padding: 8 }}>No notifications</p>}
          {items.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && markRead(n.id)}
              style={{ padding: 8, borderTop: "1px solid #eee", fontWeight: n.read ? "normal" : "bold", cursor: "pointer" }}
            >
              {n.message}
              <div style={{ fontSize: 11, color: "#888" }}>
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
