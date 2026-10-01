import type { Role } from "../../types/domain";
import type { Reservation } from "../../types/domain";
import type { Station } from "../../types/domain";
import { useState } from "react";
import { useEffect } from "react";
import { apiRequest } from "../../api";
import type { Slot } from "../../types/domain";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { shortReservationId } from "../../utils/formatters";
import { formatDate } from "../../utils/formatters";
import { ArrowUpRight } from "lucide-react";

export function BookingModal({
  stations,
  token,
  onClose,
  onCreated,
  reservation,
  role = "Prosumer",
}: {
  role?: Role;
  reservation?: Reservation;
  stations: Station[];
  token: string;
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [prosumers, setProsumers] = useState<
    Array<{
      id: string;
      fullName: string;
      nic: string;
    }>
  >([]);
  const [prosumerId, setProsumerId] = useState("");
  const [prosumerError, setProsumerError] = useState("");
  const [prosumerRetry, setProsumerRetry] = useState(0);
  useEffect(() => {
    if (role === "Prosumer" || reservation) return;
    let cancelled = false;
    apiRequest("/api/reservations/prosumers", token)
      .then((data) => {
        if (!cancelled) setProsumers(data);
      })
      .catch((e) => {
        if (!cancelled)
          setProsumerError(
            e instanceof Error ? e.message : "Unable to load prosumers.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [role, token, reservation, prosumerRetry]);
  const activeStations = stations.filter(
    (station) =>
      (station.status === "Active" || station.id === reservation?.stationId) &&
      station.id,
  );
  const [stationId, setStationId] = useState(reservation?.stationId ?? "");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState(reservation?.slotId ?? "");
  const [loadingSlots, setLoadingSlots] = useState(!!reservation?.stationId);
  const [transactionType, setTransactionType] = useState(
    reservation?.transactionType ?? "DropOff",
  );
  const [energyKwh, setEnergyKwh] = useState(
    reservation?.amount.replace(" kWh", "") ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slotError, setSlotError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  useEffect(() => {
    if (!stationId) return;
    let cancelled = false;
    apiRequest(
      `/api/stations/slots?stationId=${encodeURIComponent(stationId)}&availableOnly=${reservation ? "false" : "true"}`,
      token,
    )
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Unable to load slots.");
        if (!cancelled)
          setSlots(
            data.filter(
              (slot: Slot) =>
                slot.stationId === stationId &&
                (slot.id === reservation?.slotId ||
                  (slot.status === "Available" &&
                    slot.reservedCapacity < slot.totalCapacity &&
                    new Date(slot.startUtc).getTime() > Date.now())),
            ),
          );
      })
      .catch((error) => {
        if (!cancelled)
          setSlotError(
            error instanceof Error ? error.message : "Unable to load slots.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stationId, token, retryVersion, reservation]);
  const selectStation = (id: string) => {
    setStationId(id);
    setSlotId("");
    setSlots([]);
    setError("");
    setSlotError("");
    setLoadingSlots(!!id);
  };
  const selectedSlot = slots.find(
    (slot) => slot.id === slotId && slot.stationId === stationId,
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || loadingSlots || !selectedSlot) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(
        reservation
          ? `/api/reservations/${encodeURIComponent(reservation.id)}${role === "Prosumer" ? "" : "/staff"}`
          : role === "Prosumer"
            ? "/api/reservations"
            : "/api/reservations/staff",
        token,
        {
          method: reservation ? "PUT" : "POST",
          body: JSON.stringify({
            slotId: selectedSlot.id,
            transactionType,
            energyKwh: Number(energyKwh),
            ...(role !== "Prosumer" && !reservation
              ? { prosumerUserId: prosumerId }
              : {}),
          }),
        },
      );
      onCreated(
        reservation
          ? "Reservation updated. It is now waiting for approval."
          : "Reservation created successfully. It is now waiting for approval.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Reservation could not be created.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="form-modal" onClick={(event) => event.stopPropagation()}>
        <button
          className="modal-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <p className="eyebrow">
          {reservation ? "UPDATE RESERVATION" : "NEW ENERGY RESERVATION"}
        </p>
        <h2>{reservation ? "Update your booking." : "Choose your moment."}</h2>
        <p className="muted">
          Select a solar station, then an available slot within the next 7 days.
        </p>
        {reservation && (
          <p className="muted">
            ID {shortReservationId(reservation.id)}. Changes require at least 12
            hours before the current slot. Saving requires approval again and
            invalidates any previous QR code.
          </p>
        )}
        <form onSubmit={submit} className="booking-form">
          {role !== "Prosumer" && !reservation && (
            <label>
              Prosumer
              <select
                required
                value={prosumerId}
                onChange={(e) => setProsumerId(e.target.value)}
              >
                <option value="">Select an active prosumer</option>
                {prosumers.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.fullName} / {p.nic}
                  </option>
                ))}
              </select>
              {prosumerError && (
                <span role="alert">
                  {prosumerError}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setProsumerError("");
                      setProsumerRetry((v) => v + 1);
                    }}
                  >
                    Retry
                  </button>
                </span>
              )}
            </label>
          )}
          <label>
            Solar station
            <select
              required
              disabled={busy || (!activeStations.length && !reservation)}
              value={stationId}
              onChange={(event) => selectStation(event.target.value)}
            >
              <option value="">
                {activeStations.length
                  ? "Select a solar station"
                  : "No active stations available"}
              </option>
              {reservation &&
                !activeStations.some(
                  (station) => station.id === reservation.stationId,
                ) && (
                  <option value={reservation.stationId}>
                    {reservation.station} (current station)
                  </option>
                )}
              {activeStations.map((station) => (
                <option value={station.id} key={station.id}>
                  {station.name}
                  {station.area ? ` / ${station.area}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Available slot
            <select
              required
              disabled={busy || loadingSlots || !slots.length}
              value={slotId}
              onChange={(event) => setSlotId(event.target.value)}
            >
              <option value="">
                {!stationId
                  ? "Select a station first"
                  : loadingSlots
                    ? "Loading slots..."
                    : slotError
                      ? "Unable to load slots"
                      : slots.length
                        ? "Select an available slot"
                        : "No available slots for this station"}
              </option>
              {slots.map((slot) => (
                <option value={slot.id} key={slot.id}>
                  {slot.id === reservation?.slotId ? "Current booking / " : ""}
                  {formatDate(slot.startUtc)} - {formatDate(slot.endUtc)} /{" "}
                  {slot.reservedCapacity}/{slot.totalCapacity} reserved
                </option>
              ))}
            </select>
          </label>
          {slotError && (
            <div role="alert">
              <p className="form-error">{slotError}</p>
              <button
                type="button"
                className="text-button"
                disabled={loadingSlots}
                onClick={() => {
                  setSlotError("");
                  setLoadingSlots(true);
                  setRetryVersion((value) => value + 1);
                }}
              >
                Retry loading slots
              </button>
            </div>
          )}
          <label>
            Transaction type
            <select
              disabled={busy}
              value={transactionType}
              onChange={(event) => setTransactionType(event.target.value)}
            >
              <option value="DropOff">Drop-off</option>
              <option value="Charging">Charging</option>
            </select>
          </label>
          <label>
            Energy amount (kWh)
            <input
              required
              disabled={busy}
              type="number"
              min="0.01"
              step="any"
              value={energyKwh}
              onChange={(event) => setEnergyKwh(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button wide"
            disabled={busy || loadingSlots || !selectedSlot || !energyKwh}
          >
            {busy
              ? reservation
                ? "Saving..."
                : "Creating..."
              : reservation
                ? "Save changes"
                : "Create reservation"}{" "}
            <ArrowUpRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
