import L from "leaflet";
import { useMapEvents } from "react-leaflet";
import { Marker } from "react-leaflet";

const stationMarker = L.divIcon({
  className: "station-map-marker",
  html: "<span>☀</span>",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

export function LocationPicker({
  latitude,
  longitude,
  onPick,
}: {
  latitude: string;
  longitude: string;
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(event) {
      onPick(
        Number(event.latlng.lat.toFixed(6)),
        Number(event.latlng.lng.toFixed(6)),
      );
    },
  });
  return latitude && longitude ? (
    <Marker
      position={[Number(latitude), Number(longitude)]}
      icon={stationMarker}
    />
  ) : null;
}
