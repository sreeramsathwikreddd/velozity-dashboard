import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// Access token lives in memory only — never localStorage, never a cookie
// the JS can read. The refresh token is an HttpOnly cookie the browser
// sends automatically; this module never sees its value.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

export const api = axios.create({ baseURL: `${API_URL}/api`, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isRefreshCall = original?.url?.includes("/auth/refresh");

    // A failed refresh call must NOT trigger another refresh — that's the
    // infinite loop. Let it reject straight through; the caller (AuthContext
    // bootstrap) handles this failure quietly, it just means "not logged in".
    if (error.response?.status === 401 && !original._retry && !isRefreshCall) {
      original._retry = true;
      try {
        refreshing =
          refreshing ??
          axios
            .post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true })
            .then((r) => {
              setAccessToken(r.data.accessToken);
              return r.data.accessToken as string;
            })
            .finally(() => {
              refreshing = null;
            });
        const token = await refreshing;
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        setAccessToken(null);
        // Only force-navigate if we're not already on the login page —
        // otherwise this reloads /login over and over.
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);
