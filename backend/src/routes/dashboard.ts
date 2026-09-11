import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/errors";
import { getOnlineCount } from "../sockets/index";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    const userId = req.user!.id;

    if (role === "ADMIN") {
      const [totalProjects, byStatus, overdueCount] = await Promise.all([
        prisma.project.count(),
        prisma.task.groupBy({ by: ["status"], _count: true }),
        prisma.task.count({ where: { isOverdue: true } }),
      ]);
      return res.json({
        totalProjects,
        tasksByStatus: byStatus,
        overdueCount,
        onlineNow: getOnlineCount(),
      });
    }

    if (role === "PM") {
      const projects = await prisma.project.findMany({ where: { managerId: userId } });
      const projectIds = projects.map((p) => p.id);
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const [byPriority, upcoming] = await Promise.all([
        prisma.task.groupBy({
          by: ["priority"],
          where: { projectId: { in: projectIds } },
          _count: true,
        }),
        prisma.task.findMany({
          where: { projectId: { in: projectIds }, dueDate: { lte: weekFromNow, gte: new Date() } },
          orderBy: { dueDate: "asc" },
        }),
      ]);
      return res.json({ projects, tasksByPriority: byPriority, upcomingDueThisWeek: upcoming });
    }

    // DEVELOPER
    const tasks = await prisma.task.findMany({
      where: { assignedToId: userId },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    });
    res.json({ tasks });
  })
);

export default router;
