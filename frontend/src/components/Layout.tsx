import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <nav className="nav-rail">
        <Link to="/" className="nav-brand">Velozity</Link>
        <div className="nav-user">
          <strong>{user?.name}</strong>
          {user?.role === "ADMIN" ? "Admin" : user?.role === "PM" ? "Project Manager" : "Developer"}
        </div>
        <NotificationBell />
        <button onClick={logout} style={{ marginTop: "auto" }}>Log out</button>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
