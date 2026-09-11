import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ActivityEvent } from "../types";
import { timeAgo } from "../utils/time";
import { STATUS_LABEL } from "../utils/statusMeta";
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

export default function ActivityFeed({ projectId }: { projectId?: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [freshId, setFreshId] = useState<string | null>(null);

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
      setFreshId(event.id);
    },
  });

  useEffect(() => {
    if (projectId) joinProject(projectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Live activity</h2>
      </div>
      <div className="panel-body">
        <ul className="activity-list">
          {events.map((e) => (
            <li key={e.id} className={`activity-item ${e.id === freshId ? "flash" : ""}`}>
              <span className="who">{e.actorName}</span> moved {e.taskTitle}
              {e.fromStatus && e.toStatus
                ? ` from ${STATUS_LABEL[e.fromStatus]} to ${STATUS_LABEL[e.toStatus]}`
                : ""}
              <span className="when">{timeAgo(e.createdAt)}</span>
            </li>
          ))}
          {events.length === 0 && (
            <li className="empty-state">No activity yet on this view.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
