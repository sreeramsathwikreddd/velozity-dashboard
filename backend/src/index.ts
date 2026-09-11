import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import notificationRoutes from "./routes/notifications";
import dashboardRoutes from "./routes/dashboard";
import { errorMiddleware } from "./utils/errors";
import { initSockets } from "./sockets/index";
import { startOverdueJob } from "./jobs/overdueJob";

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(","), credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Must be registered last — Express only routes here when nothing above matched.
app.use(errorMiddleware);

initSockets(server);
startOverdueJob();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
server.listen(PORT, () => console.log(`API listening on :${PORT}`));
