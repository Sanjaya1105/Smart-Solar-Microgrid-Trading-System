import type { Slot } from "../../types/domain";
import { useState } from "react";
import { localDate } from "../../utils/management";
import type { FormEvent } from "react";
import { apiRequest } from "../../api";
import { message } from "../../utils/management";
import { Dialog } from "../common/Dialog";

export function SlotEditor({
  token,
  stationId,
  slot,
  onClose,
  onSaved,
}: {
  token: string;
  stationId: string;
  slot?: Slot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [start, setStart] = useState(slot ? localDate(slot.startUtc) : "");
  const [end, setEnd] = useState(slot ? localDate(slot.endUtc) : "");
  const [capacity, setCapacity] = useState(
    slot?.totalCapacity.toString() ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(
        `/api/stations/slots${slot ? `/${slot.id}` : ""}`,
        token,
        {
          method: slot ? "PUT" : "POST",
          body: JSON.stringify({
            stationId,
            startUtc: new Date(start).toISOString(),
            endUtc: new Date(end).toISOString(),
            totalCapacity: Number(capacity),
          }),
        },
      );
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={slot ? "Edit slot" : "Create slot"}
      busy={busy}
      onClose={onClose}
    >
      <form className="booking-form" onSubmit={submit}>
        <label>
          Start (local time)
          <input
            required
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          End (local time)
          <input
            required
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label>
          Capacity
          <input
            required
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? "Saving..." : "Save slot"}
        </button>
      </form>
    </Dialog>
  );
}
