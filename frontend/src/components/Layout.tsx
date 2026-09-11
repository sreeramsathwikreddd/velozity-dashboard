import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", padding: 12, borderBottom: "1px solid #ddd" }}>
        <Link to="/" style={{ fontWeight: "bold", textDecoration: "none" }}>Velozity Dashboard</Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span>{user?.name} ({user?.role})</span>
          <NotificationBell />
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
