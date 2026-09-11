import { PrismaClient } from "@prisma/client";

// Single instance across the app (and across ts-node-dev hot reloads).
export const prisma = new PrismaClient();
