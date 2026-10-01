import { useState } from "react";
import type { Station } from "../../types/management";
import type { Slot } from "../../types/domain";
import type { User } from "../../types/management";
import { useEffect } from "react";
import { apiRequest } from "../../api";
import { message } from "../../utils/management";
import { Dialog } from "../common/Dialog";
import { SlotEditor } from "./SlotEditor";

export function StationManagement({
  stationId,
  token,
  role,
  onClose,
  onChanged,
}: {
  stationId: string;
  token: string;
  role: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [station, setStation] = useState<Station | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [operators, setOperators] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Slot | "new" | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiRequest(`/api/stations/${stationId}`, token),
      apiRequest(
        `/api/stations/slots?stationId=${stationId}&availableOnly=false`,
        token,
      ),
      role === "Backoffice"
        ? apiRequest("/api/users?role=GridOperator&status=Active", token)
        : Promise.resolve([]),
    ])
      .then(([node, data, people]) => {
        if (!cancelled) {
          setStation(node);
          setSlots(data);
          setOperators(people);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      });
    return () => {
      cancelled = true;
    };
  }, [stationId, token, role, version]);
  const run = async (path: string, method: string, body?: object) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(path, token, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setNotice("Saved successfully.");
      setVersion((v) => v + 1);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const field = (key: keyof Station, value: string | number | null) =>
    setStation((s) => (s ? { ...s, [key]: value } : s));
  return (
    <Dialog
      title="Station & schedule"
      busy={busy}
      onClose={() => {
        onClose();
        onChanged();
      }}
    >
      {error && (
        <p role="alert" className="form-error">
          {error}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setError("");
              setVersion((v) => v + 1);
            }}
          >
            Retry
          </button>
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {!station ? (
        <p>Loading station...</p>
      ) : (
        <>
          <form
            className="booking-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(`/api/stations/${stationId}`, "PUT", station);
            }}
          >
            <label>
              Name
              <input
                required
                value={station.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </label>
            <label>
              Address
              <input
                required
                value={station.address}
                onChange={(e) => field("address", e.target.value)}
              />
            </label>
            <div className="form-two">
              <label>
                Latitude
                <input
                  required
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  value={station.latitude}
                  onChange={(e) => field("latitude", e.target.valueAsNumber)}
                />
              </label>
              <label>
                Longitude
                <input
                  required
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  value={station.longitude}
                  onChange={(e) => field("longitude", e.target.valueAsNumber)}
                />
              </label>
            </div>
            <div className="form-two">
              <label>
                Capacity (kWh)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="any"
                  value={station.capacityKwh}
                  onChange={(e) => field("capacityKwh", e.target.valueAsNumber)}
                />
              </label>
              <label>
                Battery slots
                <input
                  required
                  type="number"
                  min={1}
                  value={station.batteryStorageSlots}
                  onChange={(e) =>
                    field("batteryStorageSlots", e.target.valueAsNumber)
                  }
                />
              </label>
            </div>
            <label>
              Operating hours
              <input
                required
                value={station.operatingHours}
                onChange={(e) => field("operatingHours", e.target.value)}
              />
            </label>
            {role === "Backoffice" && (
              <label>
                Operator
                <select
                  value={station.operatorUserId ?? ""}
                  onChange={(e) =>
                    field("operatorUserId", e.target.value || null)
                  }
                >
                  <option value="">Unassigned</option>
                  {station.operatorUserId &&
                    !operators.some((u) => u.id === station.operatorUserId) && (
                      <option value={station.operatorUserId}>
                        Current operator ({station.operatorUserId})
                      </option>
                    )}
                  {operators.map((u) => (
                    <option value={u.id} key={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="primary-button" disabled={busy}>
              Save station
            </button>
          </form>
          <hr />
          <div className="panel-heading d-flex justify-content-between align-items-center">
            <h3>Booking slots</h3>
            <button
              type="button"
              className="reservation-action action-approve"
              disabled={busy}
              onClick={() => setEditing("new")}
            >
              Add slot
            </button>
          </div>
          {!slots.length && <p className="muted">No slots created.</p>}
          {slots.map((slot) => (
            <article className="slot-entry" key={slot.id}>
              <strong>
                {new Date(slot.startUtc).toLocaleString()} –{" "}
                {new Date(slot.endUtc).toLocaleString()}
              </strong>
              <p>
                {slot.reservedCapacity}/{slot.totalCapacity} reserved ·{" "}
                {slot.status}
              </p>
              <div className="row-actions d-flex flex-wrap gap-2 align-items-center">
                <button
                  className="reservation-action action-edit"
                  disabled={busy}
                  onClick={() => setEditing(slot)}
                >
                  Edit
                </button>
                <button
                  className="reservation-action action-approve"
                  disabled={
                    busy ||
                    (slot.status !== "Unavailable" &&
                      slot.reservedCapacity >= slot.totalCapacity)
                  }
                  onClick={() =>
                    void run(`/api/stations/slots/${slot.id}/status`, "PATCH", {
                      status:
                        slot.status === "Unavailable"
                          ? "Available"
                          : "Unavailable",
                    })
                  }
                >
                  {slot.status === "Unavailable"
                    ? "Make available"
                    : "Mark unavailable"}
                </button>
                <button
                  className="reservation-action action-cancel"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Delete this slot? The server will reject slots with reservation history.",
                      )
                    )
                      void run(`/api/stations/slots/${slot.id}`, "DELETE");
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </>
      )}
      {editing && (
        <SlotEditor
          key={editing === "new" ? "new" : editing.id}
          token={token}
          stationId={stationId}
          slot={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setVersion((v) => v + 1);
            setNotice("Slot saved successfully.");
          }}
        />
      )}
    </Dialog>
  );
}
