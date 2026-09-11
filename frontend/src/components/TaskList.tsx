import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Task, TaskStatus } from "../types";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

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
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={status} onChange={(e) => update("status", e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => update("priority", e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input type="date" value={dueAfter} onChange={(e) => update("dueAfter", e.target.value)} />
        <input type="date" value={dueBefore} onChange={(e) => update("dueBefore", e.target.value)} />
      </div>

      <table width="100%" cellPadding={6}>
        <thead>
          <tr>
            <th align="left">Title</th>
            <th align="left">Assignee</th>
            <th align="left">Priority</th>
            <th align="left">Due</th>
            <th align="left">Status</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} style={{ background: t.isOverdue ? "#ffecec" : "transparent" }}>
              <td>{t.title}{t.isOverdue && <strong style={{ color: "red" }}> · Overdue</strong>}</td>
              <td>{t.assignedTo?.name ?? "Unassigned"}</td>
              <td>{t.priority}</td>
              <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "-"}</td>
              <td>
                <select value={t.status} onChange={(e) => updateStatus(t.id, e.target.value as TaskStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr><td colSpan={5}>No tasks match these filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
