import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "~/hooks/useTheme";

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  onClick?: () => void;
}

export interface MapPath {
  positions: [number, number][];
  color?: string;
}

interface MapViewProps {
  pins?: MapPin[];
  paths?: MapPath[];
  center?: [number, number];
  zoom?: number;
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

function createCustomIcon(color = "#1A4D3E", label?: string): L.DivIcon {
  return L.divIcon({
    className: "custom-map-pin",
    html: `
      <span style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${color};
        color: white;
        font-size: 12px;
        font-weight: 700;
        font-family: 'Plus Jakarta Sans', sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 2px solid white;
      ">${label ?? ""}</span>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function FitBounds({ pins }: { pins: MapPin[] }) {
  const map = useMap();

  useEffect(() => {
    if (pins.length === 0) return;

    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [pins, map]);

  return null;
}

function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [map]);

  return null;
}

export function MapView({
  pins = [],
  paths = [],
  center = [48.8566, 2.3522],
  zoom = 4,
  className = "",
}: MapViewProps) {
  const tileUrl = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  return (
    <figure
      className={`relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        scrollWheelZoom
        zoomControl={false}
        maxBounds={[[-90, -180], [90, 180]]}
        minZoom={2}
        bounceAtZoomLimits={true}
        maxBoundsViscosity={1.0}
      >
        <ResizeMap />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={tileUrl}
          noWrap={true}
        />

        {pins.length > 0 && <FitBounds pins={pins} />}

        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={createCustomIcon(pin.color, pin.label)}
            eventHandlers={{
              click: () => pin.onClick?.(),
            }}
          >
            {pin.label && (
              <Popup>
                <span className="text-label-md font-semibold">{pin.label}</span>
              </Popup>
            )}
          </Marker>
        ))}

        {paths.map((path, i) => (
          <Polyline
            key={`path-${i}`}
            positions={path.positions}
            pathOptions={{
              color: path.color ?? "#1A4D3E",
              weight: 3,
              opacity: 0.7,
              dashArray: "8 6",
            }}
          />
        ))}
      </MapContainer>
    </figure>
  );
}
