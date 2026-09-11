import { useParams } from "react-router-dom";
import TaskList from "../components/TaskList";
import ActivityFeed from "../components/ActivityFeed";

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, padding: 24 }}>
      <div>
        <h2>Project Tasks</h2>
        <TaskList projectId={id} />
      </div>
      <ActivityFeed projectId={id} />
    </div>
  );
}
