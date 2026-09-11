import { Priority, TaskStatus } from "../types";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: "var(--status-todo)",
  IN_PROGRESS: "var(--status-progress)",
  IN_REVIEW: "var(--status-review)",
  DONE: "var(--status-done)",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: "var(--priority-low)",
  MEDIUM: "var(--priority-medium)",
  HIGH: "var(--priority-high)",
  CRITICAL: "var(--priority-critical)",
};
