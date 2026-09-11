import { PrismaClient, TaskStatus, Priority } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  const passwordHash = await hash("Password123!");

  const admin = await prisma.user.create({
    data: { name: "Aisha Khan", email: "admin@velozity.dev", passwordHash, role: "ADMIN" },
  });
  const pm1 = await prisma.user.create({
    data: { name: "Marcus Chen", email: "pm1@velozity.dev", passwordHash, role: "PM" },
  });
  const pm2 = await prisma.user.create({
    data: { name: "Priya Nair", email: "pm2@velozity.dev", passwordHash, role: "PM" },
  });
  const devs = await Promise.all(
    ["Ravi Kumar", "Sofia Alvarez", "Tom Becker", "Lena Fischer"].map((name, i) =>
      prisma.user.create({
        data: {
          name,
          email: `dev${i + 1}@velozity.dev`,
          passwordHash,
          role: "DEVELOPER",
        },
      })
    )
  );

  const clientA = await prisma.client.create({ data: { name: "Northwind Retail" } });
  const clientB = await prisma.client.create({ data: { name: "Solstice Health" } });
  const clientC = await prisma.client.create({ data: { name: "Rivet Logistics" } });

  const projectA = await prisma.project.create({
    data: {
      name: "Northwind E-commerce Revamp",
      description: "Rebuild checkout flow and storefront",
      clientId: clientA.id,
      managerId: pm1.id,
    },
  });
  const projectB = await prisma.project.create({
    data: {
      name: "Solstice Patient Portal",
      description: "New patient-facing scheduling portal",
      clientId: clientB.id,
      managerId: pm2.id,
    },
  });
  const projectC = await prisma.project.create({
    data: {
      name: "Rivet Fleet Tracker",
      description: "Real-time fleet location dashboard",
      clientId: clientC.id,
      managerId: pm1.id,
    },
  });

  const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
  const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

  const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  type TaskSeed = { title: string; project: typeof projectA; assignee: (typeof devs)[number]; status: TaskStatus; priority: Priority; dueDate: Date };

  const taskSeeds: TaskSeed[] = [
    { title: "Build checkout API", project: projectA, assignee: devs[0], status: "IN_PROGRESS", priority: "HIGH", dueDate: daysFromNow(5) },
    { title: "Design cart drawer UI", project: projectA, assignee: devs[1], status: "TODO", priority: "MEDIUM", dueDate: daysFromNow(7) },
    { title: "Fix inventory sync bug", project: projectA, assignee: devs[0], status: "IN_REVIEW", priority: "CRITICAL", dueDate: daysFromNow(2) },
    { title: "Migrate payment gateway", project: projectA, assignee: devs[1], status: "TODO", priority: "HIGH", dueDate: daysFromNow(-2) }, // overdue
    { title: "Add order history page", project: projectA, assignee: devs[0], status: "DONE", priority: "LOW", dueDate: daysFromNow(-10) },
    { title: "Write checkout e2e tests", project: projectA, assignee: devs[1], status: "TODO", priority: "MEDIUM", dueDate: daysFromNow(10) },

    { title: "Scheduling calendar component", project: projectB, assignee: devs[2], status: "IN_PROGRESS", priority: "HIGH", dueDate: daysFromNow(4) },
    { title: "Patient auth flow (HIPAA review)", project: projectB, assignee: devs[3], status: "TODO", priority: "CRITICAL", dueDate: daysFromNow(-1) }, // overdue
    { title: "Appointment reminders", project: projectB, assignee: devs[2], status: "IN_REVIEW", priority: "MEDIUM", dueDate: daysFromNow(3) },
    { title: "Clinician dashboard", project: projectB, assignee: devs[3], status: "TODO", priority: "HIGH", dueDate: daysFromNow(9) },
    { title: "Accessibility audit", project: projectB, assignee: devs[2], status: "DONE", priority: "LOW", dueDate: daysFromNow(-14) },

    { title: "Live map socket layer", project: projectC, assignee: devs[0], status: "IN_PROGRESS", priority: "CRITICAL", dueDate: daysFromNow(6) },
    { title: "Vehicle status polling replace", project: projectC, assignee: devs[1], status: "TODO", priority: "MEDIUM", dueDate: daysFromNow(8) },
    { title: "Geofence alerts", project: projectC, assignee: devs[0], status: "IN_REVIEW", priority: "HIGH", dueDate: daysFromNow(1) },
    { title: "Driver mobile handoff", project: projectC, assignee: devs[1], status: "TODO", priority: "LOW", dueDate: daysFromNow(12) },
    { title: "Fleet report export", project: projectC, assignee: devs[0], status: "DONE", priority: "MEDIUM", dueDate: daysFromNow(-5) },
  ];

  for (const t of taskSeeds) {
    const isOverdue = t.dueDate < new Date() && t.status !== "DONE";
    const task = await prisma.task.create({
      data: {
        title: t.title,
        projectId: t.project.id,
        assignedToId: t.assignee.id,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        isOverdue,
      },
    });

    // One creation-activity entry per task so feeds aren't empty on first load.
    await prisma.taskActivity.create({
      data: {
        taskId: task.id,
        projectId: t.project.id,
        actorId: t.project.managerId,
        toStatus: "TODO",
        message: `Task "${task.title}" created and assigned to ${t.assignee.name}`,
      },
    });

    if (t.status !== "TODO") {
      await prisma.taskActivity.create({
        data: {
          taskId: task.id,
          projectId: t.project.id,
          actorId: t.assignee.id,
          fromStatus: "TODO",
          toStatus: t.status,
          message: `${t.assignee.name} moved "${task.title}" from TODO \u2192 ${t.status}`,
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log("Login: admin@velozity.dev / pm1@velozity.dev / dev1@velozity.dev ... password: Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
