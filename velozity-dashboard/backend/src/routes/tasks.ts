import { Router } from "express";
import { z } from "zod";
import { Priority, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler, badRequest, notFound, forbidden } from "../utils/errors";
import { emitActivity, emitNotification } from "../sockets/index";

const router = Router();
router.use(authenticate);

const statusEnum = z.nativeEnum(TaskStatus);
const priorityEnum = z.nativeEnum(Priority);

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().uuid(),
  assignedToId: z.string().uuid().optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().datetime().optional(),
});

// A PM may only create tasks in a project they manage. Checked against the
// DB, not against anything the client sent about itself.
router.post(
  "/",
  requireRole("ADMIN", "PM"),
  asyncHandler(async (req, res, next) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return next(badRequest(parsed.error.message));

    const project = await prisma.project.findUnique({ where: { id: parsed.data.projectId } });
    if (!project) return next(notFound("Project not found"));
    if (req.user!.role === "PM" && project.managerId !== req.user!.id) {
      return next(forbidden("You can only add tasks to projects you manage"));
    }

    const task = await prisma.task.create({
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      },
    });

    if (task.assignedToId) {
      const notification = await prisma.notification.create({
        data: {
          userId: task.assignedToId,
          taskId: task.id,
          message: `You were assigned to "${task.title}"`,
        },
      });
      emitNotification(task.assignedToId, notification);
    }

    res.status(201).json(task);
  })
);

// Query-param filters (status/priority/due range/project) so lists are
// shareable URLs. Role scoping is AND-ed into the same where clause —
// a developer cannot widen results by adding ?projectId=<someone else's>.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, priority, dueBefore, dueAfter, projectId } = req.query as Record<
      string,
      string | undefined
    >;

    const filters: Record<string, unknown> = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (projectId) filters.projectId = projectId;
    if (dueBefore || dueAfter) {
      filters.dueDate = {
        ...(dueAfter ? { gte: new Date(dueAfter) } : {}),
        ...(dueBefore ? { lte: new Date(dueBefore) } : {}),
      };
    }

    const role = req.user!.role;
    const userId = req.user!.id;
    const scope =
      role === "ADMIN"
        ? {}
        : role === "PM"
        ? { project: { managerId: userId } }
        : { assignedToId: userId };

    const tasks = await prisma.task.findMany({
      where: { ...filters, ...scope },
      include: { assignedTo: { select: { id: true, name: true } }, project: true },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    });
    res.json(tasks);
  })
);

async function loadScopedTask(userId: string, role: string, taskId: string) {
  const where =
    role === "ADMIN"
      ? { id: taskId }
      : role === "PM"
      ? { id: taskId, project: { managerId: userId } }
      : { id: taskId, assignedToId: userId };
  return prisma.task.findFirst({ where, include: { project: true } });
}

router.get(
  "/:id",
  asyncHandler(async (req, res, next) => {
    const task = await loadScopedTask(req.user!.id, req.user!.role, req.params.id);
    if (!task) return next(notFound("Task not found")); // also covers "not yours"
    res.json(task);
  })
);

const statusUpdateSchema = z.object({ status: statusEnum });

router.patch(
  "/:id/status",
  asyncHandler(async (req, res, next) => {
    const parsed = statusUpdateSchema.safeParse(req.body);
    if (!parsed.success) return next(badRequest(parsed.error.message));

    // Developers may only move tasks assigned to them; PM/Admin scoped by
    // project ownership. Same scoped lookup used everywhere else — a
    // forged/modified JWT for another role still can't escape this.
    const task = await loadScopedTask(req.user!.id, req.user!.role, req.params.id);
    if (!task) return next(notFound("Task not found"));

    const actor = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const fromStatus = task.status;
    const toStatus = parsed.data.status;

    const [updated, activity] = await prisma.$transaction([
      prisma.task.update({ where: { id: task.id }, data: { status: toStatus } }),
      prisma.taskActivity.create({
        data: {
          taskId: task.id,
          projectId: task.projectId,
          actorId: req.user!.id,
          fromStatus,
          toStatus,
          message: `${actor?.name} moved "${task.title}" from ${fromStatus} \u2192 ${toStatus}`,
        },
      }),
    ]);

    emitActivity(
      {
        id: activity.id,
        taskId: task.id,
        taskTitle: task.title,
        projectId: task.projectId,
        actorName: actor?.name ?? "Someone",
        fromStatus,
        toStatus,
        message: activity.message,
        createdAt: activity.createdAt.toISOString(),
      },
      task.assignedToId
    );

    // PM gets notified when their task moves to IN_REVIEW.
    if (toStatus === "IN_REVIEW") {
      const project = await prisma.project.findUnique({ where: { id: task.projectId } });
      if (project) {
        const notification = await prisma.notification.create({
          data: {
            userId: project.managerId,
            taskId: task.id,
            message: `"${task.title}" was moved to In Review`,
          },
        });
        emitNotification(project.managerId, notification);
      }
    }

    res.json(updated);
  })
);

// Catch-up: last 20 activity events a user missed while offline, scoped
// the same way as the live feed and read from the DB, never from memory.
router.get(
  "/activity/catchup",
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    const userId = req.user!.id;

    const where =
      role === "ADMIN"
        ? {}
        : role === "PM"
        ? { project: { managerId: userId } }
        : { task: { assignedToId: userId } };

    const events = await prisma.taskActivity.findMany({
      where,
      include: { actor: { select: { name: true } }, task: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    res.json(events);
  })
);

export default router;
