import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import TaskList from "../components/TaskList";
import ActivityFeed from "../components/ActivityFeed";
import { STATUS_LABEL, PRIORITY_LABEL } from "../utils/statusMeta";

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

  if (!user || !data) return <p className="empty-state">Loading…</p>;

  if (user.role === "ADMIN") {
    const d = data as AdminData;
    return (
      <div>
        <div className="page-header">
          <h1>Admin overview</h1>
          <h3>Everything across every client project</h3>
        </div>
        <div className="stat-row">
          <div className="stat">
            <div className="value">{d.totalProjects}</div>
            <div className="label">Total projects</div>
          </div>
          <div className="stat">
            <div className="value" style={{ color: "var(--status-overdue)" }}>{d.overdueCount}</div>
            <div className="label">Overdue tasks</div>
          </div>
          <div className="stat">
            <div className="value">{onlineNow ?? d.onlineNow}</div>
            <div className="label">Online right now</div>
          </div>
          {d.tasksByStatus.map((s) => (
            <div className="stat" key={s.status}>
              <div className="value">{s._count}</div>
              <div className="label">{STATUS_LABEL[s.status as keyof typeof STATUS_LABEL] ?? s.status}</div>
            </div>
          ))}
        </div>
        <div className="split">
          <div>
            <h2>All tasks</h2>
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
      <div>
        <div className="page-header">
          <h1>Your projects</h1>
          <h3>Everything you manage, in one place</h3>
        </div>
        <div className="split">
          <div>
            <h2>Projects</h2>
            <ul className="project-link-list">
              {d.projects.map((p) => (
                <li key={p.id}><Link to={`/projects/${p.id}`}>{p.name}</Link></li>
              ))}
              {d.projects.length === 0 && <li className="empty-state">No projects yet.</li>}
            </ul>

            <div className="stat-row" style={{ marginTop: 24 }}>
              {d.tasksByPriority.map((p) => (
                <div className="stat" key={p.priority}>
                  <div className="value">{p._count}</div>
                  <div className="label">{PRIORITY_LABEL[p.priority as keyof typeof PRIORITY_LABEL] ?? p.priority}</div>
                </div>
              ))}
            </div>

            <h2>Due this week</h2>
            <ul className="project-link-list">
              {d.upcomingDueThisWeek.map((t) => (
                <li key={t.id} style={{ padding: "8px 0" }}>
                  {t.title} — due {new Date(t.dueDate).toLocaleDateString()}
                </li>
              ))}
              {d.upcomingDueThisWeek.length === 0 && (
                <li className="empty-state">Nothing due in the next 7 days.</li>
              )}
            </ul>
          </div>
          <ActivityFeed />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Your tasks</h1>
        <h3>Everything assigned to you</h3>
      </div>
      <div className="split">
        <div>
          <TaskList />
        </div>
        <ActivityFeed />
      </div>
    </div>
  );
}
