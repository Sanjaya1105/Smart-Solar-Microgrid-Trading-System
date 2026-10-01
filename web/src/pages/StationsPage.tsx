import type { Station } from "../types/domain";
import type { Role } from "../types/domain";
import { useState } from "react";
import { apiRequest } from "../api";
import { MapPin } from "lucide-react";
import { StationManagement } from "../components/stations/StationManagement";
import { Search } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { SunMedium } from "lucide-react";
import { Grid2X2 } from "lucide-react";

export function Stations({
  stations,
  role,
  token,
  onAdd,
  onChanged,
}: {
  stations: Station[];
  role: Role;
  token: string;
  onAdd: () => void;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [manageId, setManageId] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const canManage = role === "Backoffice";
  const visible = stations.filter((station) =>
    `${station.name} ${station.area}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const toggle = async (station: Station) => {
    if (!station.id) return;
    setWorking(station.id);
    try {
      const inactive = String(station.status).toLowerCase() === "inactive";
      await apiRequest(
        `/api/stations/${station.id}/${inactive ? "activate" : "deactivate"}`,
        token,
        { method: "POST" },
      );
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update station.");
    } finally {
      setWorking("");
    }
  };
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">FIELD NETWORK</p>
          <h1>Solar stations</h1>
          <p className="muted">
            {canManage
              ? "Add nodes, set operating hours and keep the network live."
              : "A living view of every node in your clean energy network."}
          </p>
        </div>
        {canManage && (
          <button className="primary-button" onClick={onAdd}>
            <MapPin size={16} /> Add station
          </button>
        )}
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {manageId && (
        <StationManagement
          stationId={manageId}
          token={token}
          role={role}
          onClose={() => setManageId("")}
          onChanged={onChanged}
        />
      )}
      <div className="station-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stations…"
          />
        </div>
        <button className="filter-button">
          {visible.length} stations <ChevronRight size={15} />
        </button>
      </div>
      <div className="station-grid">
        {visible.length === 0 && (
          <p className="muted">
            {query
              ? "No stations match your search."
              : "No stations available."}
          </p>
        )}
        {visible.map((station) => (
          <article className="station-card" key={station.id ?? station.name}>
            <div className="station-card-top">
              <span
                className={`station-status ${String(station.status).toLowerCase()}`}
              >
                <i /> {station.status}
              </span>
              {canManage && station.id ? (
                <button
                  className="text-button"
                  disabled={working === station.id}
                  onClick={() => toggle(station)}
                >
                  {String(station.status).toLowerCase() === "inactive"
                    ? "Activate"
                    : "Deactivate"}
                </button>
              ) : (
                <button className="icon-button">
                  <ArrowUpRight size={16} />
                </button>
              )}
            </div>
            <div className="station-sun">
              <SunMedium size={28} />
            </div>
            <h2>{station.name}</h2>
            <p>
              <MapPin size={14} /> {station.area}
            </p>
            <div className="load-row">
              <span>Capacity</span>
              <strong>
                {station.capacityKwh == null
                  ? "Unavailable"
                  : `${station.capacityKwh} kWh`}
              </strong>
            </div>
            {role !== "Prosumer" && station.id && (
              <button
                className="reservation-action action-edit"
                onClick={() => setManageId(station.id!)}
              >
                Manage station & slots
              </button>
            )}
            <div className="station-card-foot">
              <span>
                <Grid2X2 size={14} /> {station.slots}
              </span>
              <span>{station.operatingHours || "Hours TBA"}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
