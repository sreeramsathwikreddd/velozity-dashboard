import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { Role, TaskStatus } from "@prisma/client";
import { verifyAccessToken } from "../utils/tokens";
import { prisma } from "../lib/prisma";

let io: Server;

// userId -> count of live sockets (same user can have multiple tabs open).
const onlineUsers = new Map<string, number>();

export function initSockets(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN?.split(",") ?? "*", credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => onConnection(socket));

  return io;
}

async function onConnection(socket: Socket) {
  const { userId, role } = socket.data as { userId: string; role: Role };

  socket.join(`user:${userId}`);
  if (role === "ADMIN") socket.join("global");
  if (role === "PM") {
    const projects = await prisma.project.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    projects.forEach((p) => socket.join(`project:${p.id}`));
  }
  // Developers only ever get their own `user:{id}` room — they never join
  // a project room, so they structurally cannot receive another dev's events.

  onlineUsers.set(userId, (onlineUsers.get(userId) ?? 0) + 1);
  io.to("global").emit("presence:count", onlineUsers.size);

  socket.on("project:join", async (projectId: string) => {
    // Re-validate on every join request — never trust the client's claim
    // that it's allowed into a room. PM must own the project; admin always
    // allowed; developer must have an assigned task in it.
    if (role === "ADMIN") return socket.join(`project:${projectId}`);
    if (role === "PM") {
      const owns = await prisma.project.findFirst({
        where: { id: projectId, managerId: userId },
        select: { id: true },
      });
      if (owns) socket.join(`project:${projectId}`);
      return;
    }
    // Developers don't get project-wide rooms — silently ignore.
  });

  socket.on("disconnect", () => {
    const remaining = (onlineUsers.get(userId) ?? 1) - 1;
    if (remaining <= 0) onlineUsers.delete(userId);
    else onlineUsers.set(userId, remaining);
    io.to("global").emit("presence:count", onlineUsers.size);
  });
}

export function getOnlineCount(): number {
  return onlineUsers.size;
}

export interface ActivityPayload {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  actorName: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  message: string;
  createdAt: string;
}

// Fan-out rule mirrors the access model exactly:
//  - "global"           -> admin sees everything
//  - "project:{id}"      -> PM who owns that project
//  - "user:{assignedTo}" -> the developer the task belongs to
// A developer never sits in a project room, so they can only ever receive
// events for tasks assigned to them.
export function emitActivity(payload: ActivityPayload, assignedToId: string | null) {
  const rooms = ["global", `project:${payload.projectId}`];
  if (assignedToId) rooms.push(`user:${assignedToId}`);
  io.to(rooms).emit("activity", payload);
}

export function emitNotification(userId: string, notification: unknown) {
  io.to(`user:${userId}`).emit("notification", notification);
}
