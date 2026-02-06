import { useRef, useCallback, useState, useEffect } from 'react';
// @ts-ignore
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';

interface GoogleLocationPickerMapProps {
  latitude: number;
  longitude: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  radiusKm?: number;
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
    <div className="w-full h-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={15}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
        }}
      >
        <Marker
          position={center}
          draggable={!!onLocationSelect}
          onDragEnd={handleMarkerDragEnd}
        />
        {radiusKm && (
            <Circle
                center={center}
                radius={radiusKm * 1000}
                options={{
                    strokeColor: "#E91E63",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "#E91E63",
                    fillOpacity: 0.2,
                }}
            />
        )}
      </GoogleMap>
    </div>
  );
}
