import "leaflet/dist/leaflet.css";
import { useState } from "react";
import type { OperatorOption } from "../../types/domain";
import { useEffect } from "react";
import { apiRequest } from "../../api";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { MapContainer } from "react-leaflet";
import { TileLayer } from "react-leaflet";
import { LocationPicker } from "./LocationPicker";
import { Check } from "lucide-react";

export function StationModal({
  token,
  onClose,
  onSaved,
}: {
  token: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    capacityKwh: "",
    batteryStorageSlots: "",
    operatingHours: "",
    operatorUserId: "",
  });
  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [createSlot, setCreateSlot] = useState(true);
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [slotCapacity, setSlotCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    apiRequest("/api/users?role=GridOperator&status=Active", token)
      .then((data) => {
        if (Array.isArray(data))
          setOperators(
            data.map((user) => ({ id: user.id, fullName: user.fullName })),
          );
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Unable to load operators."),
      );
  }, [token]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const station = await apiRequest("/api/stations", token, {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          capacityKwh: Number(form.capacityKwh),
          batteryStorageSlots: Number(form.batteryStorageSlots),
          operatingHours: form.operatingHours,
          operatorUserId: form.operatorUserId || null,
        }),
      });
      if (createSlot && station?.id) {
        try {
          await apiRequest("/api/stations/slots", token, {
            method: "POST",
            body: JSON.stringify({
              stationId: station.id,
              startUtc: new Date(slotStart).toISOString(),
              endUtc: new Date(slotEnd).toISOString(),
              totalCapacity: Number(slotCapacity),
            }),
          });
          onSaved(
            `${station.name} is live and its first booking slot is ready.`,
          );
        } catch (slotError) {
          onSaved(
            `${station.name} was created, but the first slot could not be added. ${slotError instanceof Error ? slotError.message : ""}`,
          );
        }
      } else {
        onSaved(`${station?.name ?? "Station"} was added to the network.`);
      }
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Station could not be created.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="form-modal station-form-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <p className="eyebrow">NEW FIELD NODE</p>
        <h2>Add a solar station.</h2>
        <p className="muted">
          Create the node, then open a first bookable slot so prosumers can
          reserve it.
        </p>
        <form onSubmit={submit} className="booking-form">
          <label>
            Station name
            <input
              required
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Station name"
            />
          </label>
          <label>
            Address
            <input
              required
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
              placeholder="Station address"
            />
          </label>
          <div className="location-picker">
            <p className="map-label">Pick station location on the map</p>
            <MapContainer
              center={[6.9271, 79.8612]}
              zoom={12}
              scrollWheelZoom
              className="station-map"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onPick={(lat, lon) =>
                  setForm((current) => ({
                    ...current,
                    latitude: String(lat),
                    longitude: String(lon),
                  }))
                }
              />
            </MapContainer>
            <p className="muted">
              Click the map to set latitude and longitude. You can fine-tune the
              values below.
            </p>
          </div>
          <div className="form-two">
            <label>
              Latitude
              <input
                required
                type="number"
                step="any"
                value={form.latitude}
                onChange={(event) => update("latitude", event.target.value)}
              />
            </label>
            <label>
              Longitude
              <input
                required
                type="number"
                step="any"
                value={form.longitude}
                onChange={(event) => update("longitude", event.target.value)}
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
                value={form.capacityKwh}
                onChange={(event) => update("capacityKwh", event.target.value)}
              />
            </label>
            <label>
              Battery slots
              <input
                required
                type="number"
                min="1"
                value={form.batteryStorageSlots}
                onChange={(event) =>
                  update("batteryStorageSlots", event.target.value)
                }
              />
            </label>
          </div>
          <label>
            Operating hours
            <input
              required
              value={form.operatingHours}
              onChange={(event) => update("operatingHours", event.target.value)}
              placeholder="08:00-18:00"
            />
          </label>
          <label>
            Assigned operator
            <select
              value={form.operatorUserId}
              onChange={(event) => update("operatorUserId", event.target.value)}
            >
              <option value="">Unassigned</option>
              {operators.map((operator) => (
                <option value={operator.id} key={operator.id}>
                  {operator.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="check slot-toggle">
            <input
              type="checkbox"
              checked={createSlot}
              onChange={(event) => setCreateSlot(event.target.checked)}
            />{" "}
            Add a first booking slot now
          </label>
          {createSlot && (
            <>
              <div className="form-two">
                <label>
                  Slot start
                  <input
                    required
                    type="datetime-local"
                    value={slotStart}
                    onChange={(event) => setSlotStart(event.target.value)}
                  />
                </label>
                <label>
                  Slot end
                  <input
                    required
                    type="datetime-local"
                    value={slotEnd}
                    onChange={(event) => setSlotEnd(event.target.value)}
                  />
                </label>
              </div>
              <label>
                Slot capacity
                <input
                  required
                  type="number"
                  min="1"
                  value={slotCapacity}
                  onChange={(event) => setSlotCapacity(event.target.value)}
                />
              </label>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button wide" disabled={busy}>
            {busy ? "Creating…" : "Create station"} <Check size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
