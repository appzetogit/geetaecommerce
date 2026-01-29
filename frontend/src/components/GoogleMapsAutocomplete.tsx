import { useCallback, useEffect, useRef, useState } from 'react';

// Extend the Window interface to include gm_authFailure
declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

interface GoogleMapsAutocompleteProps {
  value: string;
  onChange: (address: string, lat: number, lng: number, placeName: string, components?: { city?: string; state?: string }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
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

export default function GoogleMapsAutocomplete({
  value,
  onChange,
  placeholder = 'Search location...',
  className = '',
  disabled = false,
  required = false,
}: GoogleMapsAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autocompleteRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
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
        window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current);
      } catch {
        // Ignore cleanup errors
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
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'in' },
        fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id'],
      });

      autocompleteRef.current = autocomplete;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
          // If no details, might be user pressed enter on text.
          // Check if we should fallback to search logic?
          // For now, keep as is or trigger error.
          // setError('No location details found for this place');
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
  }, [onChange, inputValue, useFallback]);

  // Load Google Maps API script with async loading
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.warn('No Google Maps API Key found, using fallback.');
      setUseFallback(true);
      setIsLoaded(true);
      return;
    }

    // Check if API is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      setIsLoaded(true);
      initializeAutocomplete();
      return;
    }

    // Check if script is already loading
    if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          clearInterval(checkInterval);
          setIsLoaded(true);
          initializeAutocomplete();
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // Load the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setIsLoaded(true);
      initializeAutocomplete();
    };
    script.onerror = () => {
      console.warn('Google Maps Script failed to load, switching to fallback.');
      setUseFallback(true);
      setIsLoaded(true);
    };
    document.head.appendChild(script);

  }, [initializeAutocomplete]);

  return (
    <div className="w-full relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => useFallback && inputValue.length > 2 && setShowSuggestions(true)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-neutral-300 rounded-lg placeholder:text-neutral-400 focus:outline-none focus:border-orange-500 bg-white ${className}`}
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
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
      {!isLoaded && !useFallback && !error && (
        <p className="mt-1 text-xs text-neutral-500">Loading location services...</p>
      )}
    </div>
  );
}



