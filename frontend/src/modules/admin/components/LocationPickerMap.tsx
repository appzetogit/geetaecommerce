import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const storeIcon = new L.DivIcon({
  html: `<div style="font-size: 24px; text-align: center;">📍</div>`,
  className: 'store-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  onLocationSelect: (lat: number, lng: number) => void;
}

// India Center Coordinates
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const INDIA_ZOOM = 4;

function LocationMarker({ position, zoom, onLocationSelect, isLocationSelected }: { position: [number, number], zoom: number, onLocationSelect: (lat: number, lng: number) => void, isLocationSelected: boolean }) {
  const map = useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
      // When user clicks, zoom in to street level if not already
      map.flyTo(e.latlng, Math.max(map.getZoom(), 15));
    },
  });

  useEffect(() => {
    // Only fly to position if it's a selected location or valid initial location
    // Don't fly on mount if it's just the default India center unless explicitly requested
    map.flyTo(position, zoom);
  }, [position, zoom, map]);

  return isLocationSelected ? (
    <Marker position={position} icon={storeIcon}>
      <Popup>Selected Location</Popup>
    </Marker>
  ) : null;
}

export default function LocationPickerMap({ latitude, longitude, onLocationSelect }: LocationPickerMapProps) {
  const isLatValid = isValidCoordinate(latitude, 'lat');
  const isLngValid = isValidCoordinate(longitude, 'lng');
  const isLocationSelected = isLatValid && isLngValid;

  const center: [number, number] = isLocationSelected
    ? [latitude, longitude]
    : INDIA_CENTER;

  const zoom = isLocationSelected ? 15 : INDIA_ZOOM;

  return (
    <div className="w-full h-full min-h-[300px] rounded-lg overflow-hidden border border-neutral-200 shadow-sm z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker
          position={center}
          zoom={zoom}
          onLocationSelect={onLocationSelect}
          isLocationSelected={isLocationSelected}
        />
      </MapContainer>
    </div>
  );
}

function isValidCoordinate(val: number, type: 'lat' | 'lng'): boolean {
    if (isNaN(val) || val === 0) return false; // Treat 0 as invalid/unassigned for this case
    if (type === 'lat') return val >= -90 && val <= 90;
    if (type === 'lng') return val >= -180 && val <= 180;
    return false;
}
