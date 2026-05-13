import { useCallback, useEffect, useRef, useState } from 'react';
// @ts-ignore
import { useJsApiLoader } from '@react-google-maps/api';

declare global {
  interface Window {
    gm_authFailure: () => void;
  }
}

interface GoogleMapsAutocompleteProps {
    // ... props
    value: string;
    onChange: (address: string, lat: number, lng: number, placeName: string, components?: { city?: string; state?: string }) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    required?: boolean;
    types?: string[];
}
// Clean address by removing Plus Codes and unwanted identifiers
const cleanAddress = (address: string): string => {
  if (!address) return address;

  const cleaned = address
    .replace(/^[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}([,\s]+)?/i, '')
    .replace(/([,\s]+)?[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}$/i, '')
    .replace(/([,\s]+)[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}([,\s]+)/gi, (_match, before, after) => {
      return before.includes(',') || after.includes(',') ? ', ' : ' ';
    })
    .replace(/\s+[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}\s+/gi, ' ')
    .replace(/\b[A-Z0-9]{2,4}\+[A-Z0-9]{2,4}\b/gi, '')
    .replace(/,\s*,+/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

  return cleaned;
};

const libraries = ['places'];

export default function GoogleMapsAutocomplete({
  value,
  onChange,
  placeholder = 'Search location...',
  className = '',
  disabled = false,
  required = false,
  types = ['establishment', 'geocode'],
}: GoogleMapsAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);

  // Use the same loader to avoid conflicts
  const { isLoaded: apiLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries as any,
  });

  const [isLoaded, setIsLoaded] = useState(false); // Internal loaded state combining apiLoaded + fallback
  const [error, setError] = useState<string>('');
  const [inputValue, setInputValue] = useState(value);

  // Fallback state
  const [useFallback, setUseFallback] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Update local input value when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Sync isLoaded with apiLoaded
  useEffect(() => {
    if (apiLoaded) {
      setIsLoaded(true);
      initializeAutocomplete();
    }
  }, [apiLoaded]);

  // Handle load error by switching to fallback
  useEffect(() => {
    if (loadError) {
      console.warn('Google Maps JS API failed to load:', loadError);
      setUseFallback(true);
      setIsLoaded(true);
    }
  }, [loadError]);

  // Handle global auth failure from Google Maps (standard callback)
  useEffect(() => {
    window.gm_authFailure = () => {
      console.warn('Google Maps Authentication Failed. Switching to OpenStreetMap fallback.');
      setUseFallback(true);
      setError(''); // Clear error since we are handling it
      setIsLoaded(true); // Allow interaction
    };
  }, []);

  // Search Nominatim (OpenStreetMap)
  const searchNominatim = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5&addressdetails=1`
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error('OSM search failed:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Always notify parent of text change (even without coords yet)
    onChange(val, 0, 0, val);

    if (useFallback) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchNominatim(val);
      }, 500);
    }
  };

  const handleSuggestionClick = (place: any) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);
    const rawAddress = place.display_name;
    const address = cleanAddress(rawAddress);
    const placeName = place.name || address.split(',')[0];
    const addr = place.address || {};

    const city = addr.city || addr.town || addr.village || addr.municipality || '';
    const state = addr.state || addr.region || '';

    setInputValue(address);
    setSuggestions([]);
    setShowSuggestions(false);

    onChange(address, lat, lng, placeName, { city, state });
  };


  // Initialize autocomplete using the legacy Autocomplete API
  const initializeAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places || useFallback) return;

    // Clean up any existing autocomplete
    if (autocompleteRef.current) {
        try {
            if (window.google?.maps?.event?.clearInstanceListeners) {
                window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
            }
        } catch (e) {
            // ignore
        }
        autocompleteRef.current = null;
    }

    try {
      const places = window.google.maps.places as any;

      if (!places.Autocomplete) {
        setUseFallback(true);
        return;
      }

      const autocomplete = new places.Autocomplete(inputRef.current, {
        types: types,
        componentRestrictions: { country: 'in' },
        fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id'],
      });

      autocompleteRef.current = autocomplete;

      autocomplete.addListener('place_changed', () => {
         // ... (existing place_changed logic)
        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
          return;
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const rawAddress = place.formatted_address || place.name || inputValue;
        const address = cleanAddress(rawAddress);
        const placeName = place.name || address;

        let city = '';
        let state = '';

        if (place.address_components) {
          for (const component of place.address_components) {
            if (component.types.includes('locality')) {
              city = component.long_name;
            } else if (component.types.includes('administrative_area_level_3') && !city) {
              city = component.long_name;
            } else if (component.types.includes('administrative_area_level_1')) {
              state = component.long_name;
            }
          }
        }

        setInputValue(address);
        onChange(address, lat, lng, placeName, { city, state });
        setError('');
      });
    } catch (err) {
      console.warn('Google Autocomplete init failed, using fallback', err);
      setUseFallback(true);
    }
  }, [onChange, inputValue, useFallback, types]);

  // Removed manual script loading useEffect


  return (
    <div className="w-full relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => useFallback && inputValue.length > 2 && setShowSuggestions(true)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-neutral-300 rounded-lg placeholder:text-neutral-400 focus:outline-none focus:border-[var(--customer-primary)] bg-white ${className}`}
        disabled={disabled || (!isLoaded && !useFallback)}
        required={required}
        autoComplete="off"
      />

      {/* Suggestions Dropdown for Fallback Mode */}
      {useFallback && showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-neutral-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
           {suggestions.map((place, index) => (
             <li
               key={index}
               onClick={() => handleSuggestionClick(place)}
               className="px-4 py-2 hover:bg-neutral-50 cursor-pointer text-sm text-neutral-700 border-b border-neutral-100 last:border-0"
             >
               <div className="font-medium">{place.name || place.display_name.split(',')[0]}</div>
               <div className="text-xs text-neutral-500 truncate">{place.display_name}</div>
             </li>
           ))}
        </ul>
      )}

      {error && !useFallback && (
        <p className="mt-1 text-xs text-[var(--customer-primary-dark)]">{error}</p>
      )}
      {!isLoaded && !useFallback && !error && (
        <p className="mt-1 text-xs text-neutral-500">Loading location services...</p>
      )}
    </div>
  );
}
