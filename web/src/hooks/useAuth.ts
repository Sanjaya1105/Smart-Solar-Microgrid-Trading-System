import { useState } from "react";
import { apiRequest } from "../api";
import type { Role } from "../types/domain";
import { normalizeRole } from "../utils/formatters";

type Session = { token: string; role: Role; fullName: string };

function readSession(): Session | null {
  const token = localStorage.getItem("solargrid.token");
  const role = normalizeRole(localStorage.getItem("solargrid.role"));
  if (!token || !role) return null;
  return {
    token,
    role,
    fullName: localStorage.getItem("solargrid.fullName") ?? "",
  };
}

// Session persistence and login belong here; page navigation stays in App.
export function useAuth() {
  const [session, setSession] = useState<Session | null>(readSession);

  const login = async (nicOrEmail: string, password: string) => {
    const data = await apiRequest("/api/auth/login", "", {
      method: "POST",
      body: JSON.stringify({ nicOrEmail, password }),
    });
    const role = normalizeRole(data.role);
    if (!role || !data.token) throw new Error("Invalid login response.");
    const next: Session = {
      token: data.token,
      role,
      fullName: data.fullName ?? "",
    };
    localStorage.setItem("solargrid.token", next.token);
    localStorage.setItem("solargrid.role", next.role);
    localStorage.setItem("solargrid.fullName", next.fullName);
    setSession(next);
  };

  const logout = () => {
    localStorage.removeItem("solargrid.token");
    localStorage.removeItem("solargrid.role");
    localStorage.removeItem("solargrid.fullName");
    setSession(null);
  };

  return {
    token: session?.token ?? "",
    role: session?.role ?? "Backoffice",
    fullName: session?.fullName ?? "",
    loggedIn: session !== null,
    login,
    logout,
  };
}
