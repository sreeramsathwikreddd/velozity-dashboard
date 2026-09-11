import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setAccessToken } from "../api/client";
import { User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load there's no access token in memory yet (page refresh wipes
  // it). Try the refresh cookie silently; if it's valid we're logged back in.
  useEffect(() => {
    api
      .post("/auth/refresh")
      .then((r) => {
        setAccessToken(r.data.accessToken);
        return api.get("/auth/me");
      })
      .then((r) => setUser(r.data))
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const r = await api.post("/auth/login", { email, password });
    setAccessToken(r.data.accessToken);
    setUser(r.data.user);
  }

  async function logout() {
    await api.post("/auth/logout");
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
