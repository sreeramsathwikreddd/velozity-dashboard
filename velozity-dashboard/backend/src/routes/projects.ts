import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { asyncHandler, badRequest, notFound, forbidden } from "../utils/errors";

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().uuid(),
  managerId: z.string().uuid().optional(), // admin may assign a PM; PM defaults to self
});

router.post(
  "/",
  requireRole("ADMIN", "PM"),
  asyncHandler(async (req, res, next) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return next(badRequest(parsed.error.message));

    const managerId =
      req.user!.role === "ADMIN" ? parsed.data.managerId ?? req.user!.id : req.user!.id;

    const project = await prisma.project.create({
      data: { ...parsed.data, managerId },
    });
    res.status(201).json(project);
  })
);

// List: every role gets a different WHERE clause, not a different filter
// applied after the fact. A developer's query is scoped through their tasks.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const role = req.user!.role;
    const userId = req.user!.id;

    if (role === "ADMIN") {
      return res.json(await prisma.project.findMany({ include: { client: true } }));
    }
    if (role === "PM") {
      return res.json(
        await prisma.project.findMany({
          where: { managerId: userId },
          include: { client: true },
        })
      );
    }
    // DEVELOPER: only projects containing a task assigned to them.
    return res.json(
      await prisma.project.findMany({
        where: { tasks: { some: { assignedToId: userId } } },
        include: { client: true },
      })
    );
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const role = req.user!.role;
    const userId = req.user!.id;

    const where =
      role === "ADMIN"
        ? { id }
        : role === "PM"
        ? { id, managerId: userId }
        : { id, tasks: { some: { assignedToId: userId } } };

    const project = await prisma.project.findFirst({ where, include: { client: true } });
    if (!project) return next(notFound("Project not found"));
    res.json(project);
  })
);

router.patch(
  "/:id",
  requireRole("ADMIN", "PM"),
  asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return next(notFound());
    if (req.user!.role === "PM" && existing.managerId !== req.user!.id) {
      return next(forbidden("You can only edit projects you manage"));
    }
    const parsed = createSchema.partial().safeParse(req.body);
    if (!parsed.success) return next(badRequest(parsed.error.message));

    const updated = await prisma.project.update({ where: { id }, data: parsed.data });
    res.json(updated);
  })
);

export default router;
