import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ActivityEvent } from "../types";
import { timeAgo } from "../utils/time";
import { useSocket } from "../hooks/useSocket";

interface RawActivity {
  id: string;
  taskId: string;
  task: { title: string };
  projectId: string;
  actor: { name: string };
  fromStatus: string | null;
  toStatus: string | null;
  message: string;
  createdAt: string;
}

// The API already scopes /tasks/activity/catchup and the socket rooms by
// role (admin: global, PM: their projects, dev: their tasks) — this
// component just renders whatever it's handed, it does no filtering itself.
export default function ActivityFeed({ projectId }: { projectId?: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    api.get("/tasks/activity/catchup").then((r) => {
      const mapped: ActivityEvent[] = (r.data as RawActivity[]).map((e) => ({
        id: e.id,
        taskId: e.taskId,
        taskTitle: e.task?.title ?? "task",
        projectId: e.projectId,
        actorName: e.actor?.name ?? "Someone",
        fromStatus: e.fromStatus as ActivityEvent["fromStatus"],
        toStatus: e.toStatus as ActivityEvent["toStatus"],
        message: e.message,
        createdAt: e.createdAt,
      }));
      setEvents(mapped.filter((e) => !projectId || e.projectId === projectId));
    });
  }, [projectId]);

  const { joinProject } = useSocket({
    onActivity: (event) => {
      if (projectId && event.projectId !== projectId) return;
      setEvents((prev) => [event, ...prev].slice(0, 50));
    },
  });

  useEffect(() => {
    if (projectId) joinProject(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div>
      <h3>Live Activity</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {events.map((e) => (
          <li key={e.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
            {e.actorName} moved {e.taskTitle}
            {e.fromStatus && e.toStatus ? ` from ${e.fromStatus} \u2192 ${e.toStatus}` : ""}
            {" \u00b7 "}
            {timeAgo(e.createdAt)}
          </li>
        ))}
        {events.length === 0 && <li>No activity yet.</li>}
      </ul>
    </div>
  );
}
