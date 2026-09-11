import cron from "node-cron";
import { prisma } from "../lib/prisma";

// Runs every 5 minutes. node-cron chosen over a Bull/Redis queue because this
// job has no payload, no retries, and no need for distributed workers — it's
// a single scheduled sweep over one table. Bull earns its keep when jobs
// carry data and need retry/backoff semantics; this doesn't.
export function startOverdueJob() {
  cron.schedule("*/5 * * * *", async () => {
    const result = await prisma.task.updateMany({
      where: {
        dueDate: { lt: new Date() },
        status: { not: "DONE" },
        isOverdue: false,
      },
      data: { isOverdue: true },
    });
    if (result.count > 0) {
      console.log(`[overdue-job] flagged ${result.count} task(s) as overdue`);
    }
  });
}
