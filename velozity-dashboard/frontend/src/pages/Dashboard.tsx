import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import TaskList from "../components/TaskList";
import ActivityFeed from "../components/ActivityFeed";

interface AdminData {
  totalProjects: number;
  tasksByStatus: { status: string; _count: number }[];
  overdueCount: number;
  onlineNow: number;
}
interface PMData {
  projects: { id: string; name: string }[];
  tasksByPriority: { priority: string; _count: number }[];
  upcomingDueThisWeek: { id: string; title: string; dueDate: string }[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminData | PMData | null>(null);
  const [onlineNow, setOnlineNow] = useState<number | null>(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
  }, []);

  useSocket({ onPresence: setOnlineNow });

  if (!user || !data) return <p style={{ padding: 24 }}>Loading...</p>;

  if (user.role === "ADMIN") {
    const d = data as AdminData;
    return (
      <div style={{ padding: 24 }}>
        <h2>Admin Overview</h2>
        <p>Total projects: {d.totalProjects}</p>
        <p>Overdue tasks: {d.overdueCount}</p>
        <p>Users online now: {onlineNow ?? d.onlineNow}</p>
        <ul>
          {d.tasksByStatus.map((s) => (
            <li key={s.status}>{s.status}: {s._count}</li>
          ))}
        </ul>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, marginTop: 24 }}>
          <div>
            <h3>All Tasks</h3>
            <TaskList />
          </div>
          <ActivityFeed />
        </div>
      </div>
    );
  }

  if (user.role === "PM") {
    const d = data as PMData;
    return (
      <div style={{ padding: 24 }}>
        <h2>Your Projects</h2>
        <ul>
          {d.projects.map((p) => (
            <li key={p.id}><Link to={`/projects/${p.id}`}>{p.name}</Link></li>
          ))}
        </ul>
        <h3>Tasks by priority</h3>
        <ul>
          {d.tasksByPriority.map((p) => (
            <li key={p.priority}>{p.priority}: {p._count}</li>
          ))}
        </ul>
        <h3>Due this week</h3>
        <ul>
          {d.upcomingDueThisWeek.map((t) => (
            <li key={t.id}>{t.title} — {new Date(t.dueDate).toLocaleDateString()}</li>
          ))}
        </ul>
        <ActivityFeed />
      </div>
    );
  }

  // DEVELOPER
  return (
    <div style={{ padding: 24 }}>
      <h2>Your Tasks</h2>
      <TaskList />
      <ActivityFeed />
    </div>
  );
}
