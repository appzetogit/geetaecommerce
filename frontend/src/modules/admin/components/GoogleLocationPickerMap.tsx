import { useRef, useCallback, useState, useEffect } from 'react';
// @ts-ignore
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';

interface GoogleLocationPickerMapProps {
  latitude: number;
  longitude: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  radiusKm?: number;
  // When true, renders a fixed red drop-pin overlay at the visual center of the
  // map. Use together with `selectOnDragEnd` for the "pan-the-map-to-position-
  // the-pin" UX. The pin is purely visual (pointer-events: none) so it never
  // blocks clicks on the underlying map.
  showCenterPin?: boolean;
  // When true, releasing a map drag commits the new viewport center via
  // onLocationSelect. The existing `<Marker>` continues to show the seller's
  // committed pin and animates over to the new spot once props update.
  selectOnDragEnd?: boolean;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 28.6139,
  lng: 77.2090,
};

const libraries = ['places'];

export default function GoogleLocationPickerMap({
  latitude,
  longitude,
  onLocationSelect,
  radiusKm,
  showCenterPin = false,
  selectOnDragEnd = false,
}: GoogleLocationPickerMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [map, setMap] = useState<any>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey || '',
    libraries: libraries as any,
  });

  // Default to New Delhi, but will try to fetch current location
  const [center, setCenter] = useState({
    lat: latitude || 28.6139,
    lng: longitude || 77.2090,
  });

  // Fetch current user location on mount if no lat/lng provided
  useEffect(() => {
    if (!latitude && !longitude && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          // Also verify if we should trigger onLocationSelect here?
          // Usually better to let user explicitly click/confirm, so we just pan there.
          if (onLocationSelect) {
             onLocationSelect(position.coords.latitude, position.coords.longitude);
          }
        },
        (error) => {
          console.log("Error getting location", error);
        }
      );
    }
  }, []); // Run only once on mount

  // Sync center with props if they change (e.g. from Autocomplete)
  useEffect(() => {
    if (latitude && longitude) {
        setCenter({ lat: latitude, lng: longitude });
    }
  }, [latitude, longitude]);

  const onLoad = useCallback(function callback(mapInstance: any) {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(function callback(map: any) {
    setMap(null);
  }, []);

  const handleMapClick = (event: any) => {
    if (event.latLng && onLocationSelect) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      onLocationSelect(lat, lng);
    }
  };

  const handleMarkerDragEnd = (event: any) => {
    if (event.latLng && onLocationSelect) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      onLocationSelect(lat, lng);
    }
  };

  // When `selectOnDragEnd` is on, releasing the map pan commits the new
  // viewport center as the selected location. Combined with `showCenterPin`,
  // this gives the classic "drag the map under a fixed pin" UX.
  const handleMapDragEnd = () => {
    if (!map || !onLocationSelect || !selectOnDragEnd) return;
    const c = map.getCenter?.();
    if (!c) return;
    onLocationSelect(c.lat(), c.lng());
  };

  // Update map center when props change, but only if map is loaded and the change is significant or it's the first load
  // We don't want to jitter the map if the user is dragging.
  useEffect(() => {
    if (map && latitude && longitude) {
        // panTo
        map.panTo({ lat: latitude, lng: longitude });
    }
  }, [latitude, longitude, map]);


  if (loadError) {
    return <div className="h-full w-full flex items-center justify-center bg-gray-100 text-red-500">Error loading Google Maps</div>;
  }

  if (!isLoaded) {
    return <div className="h-full w-full flex items-center justify-center bg-gray-100">Loading Map...</div>;
  }

  return (
    <div className="w-full h-full relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={15}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        onDragEnd={handleMapDragEnd}
        options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
        }}
      >
        <Marker
          position={center}
          draggable={!!onLocationSelect && !selectOnDragEnd}
          onDragEnd={handleMarkerDragEnd}
        />
        {radiusKm && (
            <Circle
                center={center}
                radius={radiusKm * 1000}
                options={{
                    strokeColor: "var(--primary-color)",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "var(--primary-color)",
                    fillOpacity: 0.2,
                }}
            />
        )}
      </GoogleMap>

      {/* Fixed red drop-pin overlay anchored at the visual center of the map.
          Its tip points exactly at the map center so the seller can pan the
          map under it to fine-tune the location. `pointer-events: none` lets
          all clicks and drags pass through to the underlying Google Map. */}
      {showCenterPin && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 5 }}
        >
          <div className="relative" style={{ transform: 'translateY(-50%)' }}>
            <svg
              width="36"
              height="48"
              viewBox="0 0 24 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}
            >
              <path
                d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <circle cx="12" cy="12" r="4" fill="#ffffff" />
            </svg>
            {/* Tiny shadow ellipse beneath the tip to anchor the pin visually. */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                bottom: -3,
                width: 12,
                height: 4,
                background: 'rgba(0,0,0,0.28)',
                borderRadius: '50%',
                filter: 'blur(2px)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
