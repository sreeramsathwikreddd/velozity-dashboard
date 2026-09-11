import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import { asyncHandler, notFound } from "../utils/errors";

const router = Router();
router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, read: false },
    });
    res.json({ notifications, unreadCount });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res, next) => {
    // Scoped to the caller so one user can't mark another's notification read.
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { read: true },
    });
    if (result.count === 0) return next(notFound());
    res.status(204).send();
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    });
    res.status(204).send();
  })
);

export default router;
