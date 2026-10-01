import type { Role } from "../types/domain";
import type { Station } from "../types/domain";
import type { Page } from "../types/domain";
import type { Reservation } from "../types/domain";
import { Zap } from "lucide-react";
import { Metric } from "../components/dashboard/Metric";
import { CalendarDays } from "lucide-react";
import { Activity } from "lucide-react";
import { Check } from "lucide-react";
import { MapPin } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { shortReservationId } from "../utils/formatters";
import { countApprovedFuture } from "../reservationViews";
import { ScanLine } from "lucide-react";
import { BatteryCharging } from "lucide-react";
import { Users } from "lucide-react";

export function Overview({
  dashboard,
  role,
  fullName,
  stations,
  pendingUsers,
  setPage,
  reservations,
  onQr,
  onBook,
}: {
  dashboard: {
    pendingReservations: number;
    approvedFutureReservations: number;
    completedReservations: number;
    activeStations: number;
  } | null;
  role: Role;
  fullName: string;
  stations: Station[];
  pendingUsers: number;
  setPage: (page: Page) => void;
  reservations: Reservation[];
  onQr: () => void;
  onBook: () => void;
}) {
  const isProsumer = role === "Prosumer";
  const count = (status: string) =>
    reservations.filter((item) => item.status === status).length;
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">
            {new Date().toLocaleDateString([], {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1>{fullName ? `Welcome, ${fullName}.` : "Welcome."}</h1>
          <p className="muted">
            {isProsumer
              ? "Your reservations and available stations."
              : "Your station and reservation overview."}
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => (isProsumer ? onBook() : setPage("stations"))}
        >
          <Zap size={16} />
          {isProsumer ? "Book a slot" : "View stations"}
        </button>
      </section>
      <section className="metric-grid">
        <Metric
          icon={CalendarDays}
          label={isProsumer ? "Your bookings" : "Reservations"}
          value={reservations.length}
          accent="mint"
        />
        <Metric
          icon={Activity}
          label="Pending reservations"
          value={dashboard?.pendingReservations ?? count("Pending")}
          accent="sun"
        />
        <Metric
          icon={Check}
          label="Completed reservations"
          value={dashboard?.completedReservations ?? count("Completed")}
          accent="blue"
        />
        <Metric
          icon={MapPin}
          label="Active stations"
          value={
            dashboard?.activeStations ??
            stations.filter((station) => station.status === "Active").length
          }
          accent="coral"
        />
      </section>
      <section className="dashboard-grid">
        <div className="panel timeline-panel">
          <div className="panel-heading d-flex justify-content-between align-items-center">
            <div>
              <p className="eyebrow">RESERVATIONS</p>
              <h2>Recent bookings</h2>
            </div>
            <button
              className="quiet-button"
              onClick={() => setPage("reservations")}
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="timeline">
            {reservations.length === 0 && (
              <p className="muted">No reservations yet.</p>
            )}
            {reservations.slice(0, 3).map((item, index) => (
              <div className="timeline-item" key={item.id}>
                <div className={`timeline-dot dot-${index}`} />
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    ID {shortReservationId(item.id)} / {item.person} /{" "}
                    {item.time}
                  </p>
                </div>
                <span className={`status ${item.status.toLowerCase()}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
          <div className="panel-footer">
            <span>
              {dashboard?.approvedFutureReservations ??
                countApprovedFuture(reservations)}{" "}
              approved future reservations
            </span>
            {isProsumer && (
              <button
                className="circle-action"
                onClick={onQr}
                title="View reservations to generate a QR code"
              >
                <ScanLine size={17} />
              </button>
            )}
          </div>
        </div>
        <div className="panel station-strip">
          <div className="panel-heading d-flex justify-content-between align-items-center">
            <div>
              <p className="eyebrow">STATIONS</p>
              <h2>Stations at a glance</h2>
            </div>
            <button
              className="quiet-button"
              onClick={() => setPage("stations")}
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          {stations.length === 0 && (
            <p className="muted">No stations available.</p>
          )}
          {stations.slice(0, 3).map((station) => (
            <div className="task" key={station.id}>
              <div className="task-icon">
                <MapPin size={17} />
              </div>
              <div>
                <strong>{station.name}</strong>
                <p>
                  {station.area || "Address unavailable"} / {station.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="lower-grid">
        <div className="panel task-panel">
          <div className="panel-heading d-flex justify-content-between align-items-center">
            <h2>Energy telemetry</h2>
            <BatteryCharging size={20} />
          </div>
          <p className="muted">
            Energy output, battery charge and station load data are not
            available.
          </p>
        </div>
        {role === "Backoffice" && (
          <div className="panel task-panel">
            <div className="panel-heading d-flex justify-content-between align-items-center">
              <h2>Prosumer activation</h2>
              <Users size={20} />
            </div>
            <p className="muted">
              {pendingUsers} accounts waiting for activation.
            </p>
            <button className="quiet-button" onClick={() => setPage("people")}>
              Review accounts <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}
