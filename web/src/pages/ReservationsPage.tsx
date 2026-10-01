import type { Reservation } from "../types/domain";
import type { Role } from "../types/domain";
import { useState } from "react";
import { apiRequest } from "../api";
import type { FormEvent } from "react";
import { filterReservations } from "../reservationViews";
import { Plus } from "lucide-react";
import { WebQrScanner } from "../components/qr/WebQrScanner";
import { shortReservationId } from "../utils/formatters";
import { QrCode } from "lucide-react";
import { ScanLine } from "lucide-react";
import { Pencil } from "lucide-react";
import { Ban } from "lucide-react";
import { LoaderCircle } from "lucide-react";
import { X } from "lucide-react";

export function Reservations({
  reservations,
  role,
  token,
  onBook,
  onChanged,
  onApproved,
  onEdit,
}: {
  reservations: Reservation[];
  role: Role;
  token: string;
  onQr: () => void;
  onBook: () => void;
  onChanged: () => void;
  onApproved: (value: string) => void;
  onEdit: (reservation: Reservation) => void;
}) {
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [summary, setSummary] = useState<Reservation | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const act = async (item: Reservation, action: string) => {
    if (
      working ||
      (action === "cancel" && !window.confirm("Cancel this reservation?"))
    )
      return;
    setWorking(item.id);
    setError("");
    try {
      const result = await apiRequest(
        `/api/reservations/${item.id}/${action}`,
        token,
        { method: "POST" },
      );
      if (action === "qr") {
        if (!result?.qrToken) throw new Error("No QR token was returned.");
        onApproved(result.qrToken);
      } else {
        onChanged();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update reservation.",
      );
    } finally {
      setWorking("");
    }
  };
  const complete = async (e: FormEvent) => {
    e.preventDefault();
    if (working) return;
    setWorking("scan");
    setError("");
    try {
      await apiRequest("/api/reservations/complete-by-qr", token, {
        method: "POST",
        body: JSON.stringify({ qrToken: qrToken.trim() }),
      });
      setQrToken("");
      onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to complete reservation.",
      );
    } finally {
      setWorking("");
    }
  };
  const visible = filterReservations(reservations, { status, query, from, to });
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">ENERGY MOVEMENT</p>
          <h1>{role === "Prosumer" ? "Your reservations" : "Reservations"}</h1>
          <p className="muted">
            Manage bookings and review scheduled transfers.
          </p>
        </div>
        <button className="primary-button" onClick={onBook}>
          <Plus size={16} /> New reservation
        </button>
      </section>
      <div className="filter-tabs">
        {["All", "Current", "Pending", "Approved", "Completed", "History"].map(
          (value) => (
            <button
              key={value}
              className={status === value ? "selected" : ""}
              onClick={() => setStatus(value)}
            >
              {value}
            </button>
          ),
        )}
      </div>
      <div className="management-filters d-flex flex-wrap gap-3">
        <label>
          Search
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Reservation ID, name, NIC or station"
          />
        </label>
        <label>
          Slot date from
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Slot date to
          <input
            type="date"
            min={from || undefined}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          className="text-button"
          onClick={() => {
            setQuery("");
            setStatus("All");
            setFrom("");
            setTo("");
          }}
        >
          Clear filters
        </button>
      </div>
      {from && to && from > to && (
        <p className="form-error">End date must be on or after start date.</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {scannerOpen && (
        <WebQrScanner
          onClose={() => setScannerOpen(false)}
          onDetected={(value) => {
            setQrToken(value);
            setScannerOpen(false);
          }}
        />
      )}
      <p className="muted">
        {visible.length} matching reservations. Times are shown in your local
        timezone.
      </p>
      <div className="panel table-panel">
        <div className="table-head">
          <span>Reservation</span>
          <span>Station</span>
          <span>Scheduled time</span>
          <span>Energy</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {!visible.length && (
          <p className="empty-state">No matching reservations.</p>
        )}
        {visible.map((item) => (
          <div className="table-row" key={item.id}>
            <div>
              <button
                className="text-button reservation-title"
                onClick={() => setSummary(item)}
              >
                {item.name}
              </button>
              <small>
                ID {shortReservationId(item.id)} ? {item.person}
              </small>
            </div>
            <span>{item.station}</span>
            <span>{item.time}</span>
            <span>{item.amount}</span>
            <span className={`status ${item.status.toLowerCase()}`}>
              {item.status}
            </span>
            <div
              className="row-actions reservation-actions"
              aria-busy={working === item.id}
            >
              {role === "Backoffice" && item.status === "Pending" && (
                <>
                  <button
                    className="reservation-action action-approve"
                    disabled={!!working}
                    onClick={() => act(item, "decision?approve=true")}
                  >
                    Approve
                  </button>
                  <button
                    className="reservation-action action-reject"
                    disabled={!!working}
                    onClick={() => act(item, "decision?approve=false")}
                  >
                    Reject
                  </button>
                </>
              )}
              {role === "Prosumer" && item.status === "Approved" && (
                <button
                  className="reservation-action action-qr"
                  disabled={!!working}
                  onClick={() => act(item, "qr")}
                >
                  <QrCode size={15} /> Get QR
                </button>
              )}
              {role === "GridOperator" && item.status === "Approved" && (
                <>
                  <button
                    className="reservation-action action-qr"
                    disabled={!!working}
                    onClick={() => setScannerOpen(true)}
                  >
                    <ScanLine size={15} /> Scan QR
                  </button>
                  <button
                    className="reservation-action action-approve"
                    disabled={!qrToken.trim() || !!working}
                    onClick={() => {
                      if (qrToken.trim())
                        void complete(
                          new Event("submit") as unknown as FormEvent,
                        );
                    }}
                  >
                    Complete
                  </button>
                </>
              )}
              {role !== "GridOperator" &&
                ["Pending", "Approved"].includes(item.status) && (
                  <>
                    <button
                      className="reservation-action action-edit"
                      disabled={!!working}
                      onClick={() => onEdit(item)}
                    >
                      <Pencil size={15} /> Edit
                    </button>
                    <button
                      className="reservation-action action-cancel"
                      disabled={!!working}
                      onClick={() => act(item, "cancel")}
                    >
                      <Ban size={15} /> Cancel
                    </button>
                  </>
                )}
              {working === item.id && (
                <span className="reservation-working" role="status">
                  <LoaderCircle size={14} /> Working...
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {summary && (
        <div className="modal-backdrop">
          <div
            className="form-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Reservation summary"
          >
            <button
              className="modal-close"
              aria-label="Close summary"
              onClick={() => setSummary(null)}
            >
              <X size={18} />
            </button>
            <h2>Reservation summary</h2>
            <dl>
              <dt>ID</dt>
              <dd>{summary.id}</dd>
              <dt>Station</dt>
              <dd>{summary.station}</dd>
              <dt>Scheduled time</dt>
              <dd>{summary.time}</dd>
              <dt>Transaction</dt>
              <dd>{summary.transactionType}</dd>
              <dt>Energy</dt>
              <dd>{summary.amount}</dd>
              <dt>Status</dt>
              <dd>{summary.status}</dd>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
