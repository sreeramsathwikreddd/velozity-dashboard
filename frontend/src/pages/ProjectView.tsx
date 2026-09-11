import { useParams } from "react-router-dom";
import TaskList from "../components/TaskList";
import ActivityFeed from "../components/ActivityFeed";

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <div className="page-header">
        <h1>Project tasks</h1>
        <h3>Filter, update status, and watch it move live</h3>
      </div>
      <div className="split">
        <TaskList projectId={id} />
        <ActivityFeed projectId={id} />
      </div>
    </div>
  );
}
