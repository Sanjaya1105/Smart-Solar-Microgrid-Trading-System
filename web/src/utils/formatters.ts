import type { Role } from "../types/domain";

export function normalizeRole(value: unknown): Role | null {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (normalized === "prosumer") return "Prosumer";
  if (normalized === "gridoperator") return "GridOperator";
  if (normalized === "backoffice") return "Backoffice";
  return null;
}

export function formatDate(value: string | undefined) {
  if (!value) return "Scheduled slot";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function transactionLabel(value: unknown) {
  return String(value ?? "").toLowerCase() === "charging"
    ? "Charging"
    : "Drop-off";
}

export function reservationName(stationName: string, type: unknown) {
  return `${stationName} · ${transactionLabel(type)}`;
}

export function shortReservationId(id: string) {
  if (!id) return "—";
  return id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase();
}
