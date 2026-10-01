import { useEffect, useState } from "react";
import { apiRequest } from "../api";
import { formatDate, reservationName } from "../utils/formatters";
import type { Role, Station, Reservation, Slot } from "../types/domain";

export function useWorkspaceData(
  loggedIn: boolean,
  token: string,
  role: Role,
  setNotice: (message: string) => void,
) {
  const [stations, setStations] = useState<Station[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dataState, setDataState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [pendingUsers, setPendingUsers] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [dashboard, setDashboard] = useState<{
    pendingReservations: number;
    approvedFutureReservations: number;
    completedReservations: number;
    activeStations: number;
  } | null>(null);
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    Promise.all([
      apiRequest(
        role === "Backoffice"
          ? "/api/stations?activeOnly=false"
          : "/api/stations?activeOnly=true",
        token,
      ),
      apiRequest(
        role === "Prosumer"
          ? "/api/reservations/mine"
          : "/api/reservations/operations",
        token,
      ),
      role === "Backoffice"
        ? apiRequest("/api/users", token)
        : Promise.resolve([]),
      apiRequest("/api/stations/slots?availableOnly=false", token),
      role === "Prosumer"
        ? Promise.resolve(null)
        : apiRequest("/api/reservations/dashboard", token),
    ])
      .then(
        ([stationData, reservationData, users, slotData, dashboardData]) => {
          if (cancelled) return;
          if (
            !Array.isArray(stationData) ||
            !Array.isArray(reservationData) ||
            !Array.isArray(users)
          )
            throw new Error("Unable to load workspace data.");
          if (Array.isArray(stationData))
            setStations(
              stationData.map((station) => ({
                id: station.id,
                name: station.name,
                area: station.address,
                status: station.status,
                slots:
                  station.batteryStorageSlots == null
                    ? "Slots unavailable"
                    : `${station.batteryStorageSlots} slots`,
                capacityKwh: station.capacityKwh,
                operatingHours: station.operatingHours,
              })),
            );
          const names = Array.isArray(users)
            ? Object.fromEntries(users.map((user) => [user.nic, user.fullName]))
            : {};
          setDashboard(dashboardData);
          setPendingUsers(
            users.filter(
              (user) => user.role === "Prosumer" && user.status === "Pending",
            ).length,
          );
          if (Array.isArray(reservationData))
            setReservations(
              reservationData.map((reservation) => {
                const stationName = Array.isArray(stationData)
                  ? (stationData.find(
                      (station: { id: string; name: string }) =>
                        station.id === reservation.stationId,
                    )?.name ?? reservation.stationId)
                  : reservation.stationId;
                const person =
                  role === "Prosumer"
                    ? "You"
                    : names[reservation.prosumerNic]
                      ? `${names[reservation.prosumerNic]} / ${reservation.prosumerNic}`
                      : reservation.prosumerNic;
                const slot = (slotData as Slot[]).find(
                  (item) => item.id === reservation.slotId,
                );
                return {
                  id: reservation.id,
                  name: reservationName(
                    stationName,
                    reservation.transactionType,
                  ),
                  person,
                  station: stationName,
                  stationId: reservation.stationId,
                  slotId: reservation.slotId,
                  transactionType: reservation.transactionType,
                  startUtc: slot?.startUtc,
                  endUtc: slot?.endUtc,
                  time: slot
                    ? `${formatDate(slot.startUtc)} - ${formatDate(slot.endUtc)}`
                    : "Slot unavailable",
                  amount: `${reservation.energyKwh} kWh`,
                  status: reservation.status,
                };
              }),
            );
          setDataState("ready");
        },
      )
      .catch((error) => {
        if (!cancelled) {
          setDataState("error");
          setNotice(
            error instanceof Error
              ? error.message
              : "Unable to load workspace data. Please try again.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn, token, role, reloadVersion, setNotice]);
  const reload = () => {
    setDataState("loading");
    setReloadVersion((value) => value + 1);
  };
  const reset = () => {
    setStations([]);
    setReservations([]);
    setPendingUsers(0);
    setDashboard(null);
    setDataState("loading");
  };
  return {
    stations,
    reservations,
    dataState,
    pendingUsers,
    dashboard,
    reload,
    reset,
  };
}
