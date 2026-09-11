import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../api/client";
import { ActivityEvent, AppNotification } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface Handlers {
  onActivity?: (event: ActivityEvent) => void;
  onNotification?: (n: AppNotification) => void;
  onPresence?: (count: number) => void;
}

// One socket per mounted dashboard. Reconnects with a fresh access token if
// it changes (e.g. after a refresh-cookie rotation).
export function useSocket(handlers: Handlers) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    if (handlers.onActivity) socket.on("activity", handlers.onActivity);
    if (handlers.onNotification) socket.on("notification", handlers.onNotification);
    if (handlers.onPresence) socket.on("presence:count", handlers.onPresence);

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAccessToken()]);

  function joinProject(projectId: string) {
    socketRef.current?.emit("project:join", projectId);
  }

  return { joinProject };
}
