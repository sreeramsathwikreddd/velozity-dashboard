import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Task, TaskStatus } from "../types";
import { STATUS_LABEL, STATUS_COLOR, PRIORITY_LABEL, PRIORITY_COLOR } from "../utils/statusMeta";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export default function TaskList({ projectId }: { projectId?: string }) {
  const [params, setParams] = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>([]);

  const status = params.get("status") ?? "";
  const priority = params.get("priority") ?? "";
  const dueBefore = params.get("dueBefore") ?? "";
  const dueAfter = params.get("dueAfter") ?? "";

  useEffect(() => {
    const query: Record<string, string> = {};
    if (projectId) query.projectId = projectId;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (dueBefore) query.dueBefore = dueBefore;
    if (dueAfter) query.dueAfter = dueAfter;

    api.get("/tasks", { params: query }).then((r) => setTasks(r.data));
  }, [projectId, status, priority, dueBefore, dueAfter]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  async function updateStatus(taskId: string, newStatus: TaskStatus) {
    await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
  }

  return (
    <div>
      <div className="filter-bar">
        <select value={status} onChange={(e) => update("status", e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => update("priority", e.target.value)} aria-label="Filter by priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
        <input type="date" value={dueAfter} onChange={(e) => update("dueAfter", e.target.value)} aria-label="Due after" />
        <input type="date" value={dueBefore} onChange={(e) => update("dueBefore", e.target.value)} aria-label="Due before" />
      </div>

      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Due</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className={t.isOverdue ? "row-overdue" : ""}>
              <td>
                {t.title}
                {t.isOverdue && (
                  <span className="status-pill" style={{ marginLeft: 8, color: "var(--status-overdue)" }}>
                    <span className="status-dot" style={{ background: "var(--status-overdue)" }} />
                    Overdue
                  </span>
                )}
              </td>
              <td>{t.assignedTo?.name ?? "Unassigned"}</td>
              <td>
                <span className="priority-text" style={{ color: PRIORITY_COLOR[t.priority] }}>
                  {PRIORITY_LABEL[t.priority]}
                </span>
              </td>
              <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
              <td>
                <select
                  value={t.status}
                  onChange={(e) => updateStatus(t.id, e.target.value as TaskStatus)}
                  aria-label={`Status for ${t.title}`}
                  style={{ borderColor: STATUS_COLOR[t.status] }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr><td colSpan={5} className="empty-state">No tasks match these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
