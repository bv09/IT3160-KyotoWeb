import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { ArrowUpDown, X, MapPin, Navigation, AlertCircle } from 'lucide-react';
import type { Location, StationListItem } from '@/types';
import RouteCard from './RouteCard';

export default function RouteSearch() {
  const {
    origin,
    destination,
    setOrigin,
    setDestination,
    shortestDistanceRoute,
    fastestTravelTimeRoute,
    stations,
    loading,
    error,
  } = useApp();

  return (
    <div className="route-search">
      <LocationInputGroup
        origin={origin}
        destination={destination}
        setOrigin={setOrigin}
        setDestination={setDestination}
        stations={stations}
      />

      {loading && (
        <div className="route-loading">
          <div className="spinner" />
          <span>Calculating routes...</span>
        </div>
      )}

      {error && (
        <div className="route-error">
          <AlertCircle />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && !shortestDistanceRoute && !fastestTravelTimeRoute && (
        <NoRouteHint hasOrigin={!!origin} hasDestination={!!destination} />
      )}

      {(shortestDistanceRoute || fastestTravelTimeRoute) && !loading && (
        <div className="route-cards">
          {shortestDistanceRoute && (
            <RouteCard route={shortestDistanceRoute} type="shortest" />
          )}
          {fastestTravelTimeRoute && (
            <RouteCard route={fastestTravelTimeRoute} type="fastest" />
          )}
        </div>
      )}
    </div>
  );
}

// ── Location Input Group ──
function LocationInputGroup({
  origin,
  destination,
  setOrigin,
  setDestination,
  stations,
}: {
  origin: Location | null;
  destination: Location | null;
  setOrigin: (loc: Location | null) => void;
  setDestination: (loc: Location | null) => void;
  stations: StationListItem[];
}) {
  const handleSwap = () => {
    const oldOrigin = origin;
    const oldDest = destination;
    setOrigin(oldDest);
    setDestination(oldOrigin);
  };

  return (
    <div className="location-input-group">
      <LocationInput
        type="origin"
        value={origin}
        onChange={setOrigin}
        stations={stations}
        placeholder="Origin — search station or enter coordinates"
      />
      <LocationInput
        type="destination"
        value={destination}
        onChange={setDestination}
        stations={stations}
        placeholder="Destination — search station or enter coordinates"
      />
      <button className="swap-btn" onClick={handleSwap} title="Swap origin and destination">
        <ArrowUpDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Individual Location Input ──
function LocationInput({
  type,
  value,
  onChange,
  stations,
  placeholder,
}: {
  type: 'origin' | 'destination';
  value: Location | null;
  onChange: (loc: Location | null) => void;
  stations: StationListItem[];
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredStations, setFilteredStations] = useState<StationListItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter stations based on query
  useEffect(() => {
    if (!query.trim()) {
      setFilteredStations(stations.slice(0, 20));
      return;
    }

    const lowerQuery = query.toLowerCase();

    // Check if input looks like coordinates (e.g., "35.01, 135.76")
    const coordMatch = query.match(/^\s*(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)\s*$/);
    if (coordMatch) {
      setFilteredStations([]);
      return;
    }

    const filtered = stations.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.japaneseName.includes(query)
    );
    setFilteredStations(filtered.slice(0, 20));
  }, [query, stations]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowDropdown(true);
  };

  const handleSelectStation = (station: StationListItem) => {
    const loc: Location = {
      type: 'station',
      station: {
        id: station.id,
        name: station.name,
        japaneseName: station.japaneseName,
        lat: station.lat,
        lng: station.lng,
      },
      coordinates: [station.lat, station.lng],
      displayName: `${station.name} (${station.japaneseName})`,
    };
    onChange(loc);
    setQuery(loc.displayName);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setShowDropdown(false);

      // Check if it's coordinates
      const coordMatch = query.match(/^\s*(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)\s*$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          const loc: Location = {
            type: 'coordinate',
            coordinates: [lat, lng],
            displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          };
          onChange(loc);
          setQuery(loc.displayName);
        }
        return;
      }

      // Select first match if available
      if (filteredStations.length > 0) {
        handleSelectStation(filteredStations[0]);
      }
    }
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    inputRef.current?.focus();
  };

  // Sync query with external value changes (from map click)
  useEffect(() => {
    if (value) {
      setQuery(value.displayName);
    } else {
      setQuery('');
    }
  }, [value]);

  const handleFocus = useCallback(() => {
    setShowDropdown(true);
    // Select all text for easy replacement
    inputRef.current?.select();
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="location-input-wrapper">
        <div className={`dot ${type}`} />
        <input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
        />
        {value && (
          <button className="clear-btn" onClick={handleClear}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && filteredStations.length > 0 && !value && (
        <div className="autocomplete-dropdown">
          {filteredStations.map((station) => (
            <div
              key={station.id}
              className="autocomplete-item"
              onClick={() => handleSelectStation(station)}
            >
              <div className="station-icon">
                <Train className="w-4 h-4" />
              </div>
              <div className="station-info">
                <div className="station-name">{station.name}</div>
                {station.japaneseName && (
                  <div className="station-japanese">{station.japaneseName}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Train icon import for autocomplete ──
function Train(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 15.5V5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10.5" />
      <path d="m4 15.5 4 4" />
      <path d="m20 15.5-4 4" />
      <path d="M4 11h16" />
      <path d="M4 7h16" />
      <circle cx="9" cy="15" r="1" />
      <circle cx="15" cy="15" r="1" />
    </svg>
  );
}

// ── No route hint ──
function NoRouteHint({ hasOrigin, hasDestination }: { hasOrigin: boolean; hasDestination: boolean }) {
  return (
    <div className="no-route-hint">
      {!hasOrigin ? (
        <>
          <MapPin className="hint-icon" />
          <div className="hint-text">Set your starting point</div>
          <div className="hint-subtext">
            Search for a station, enter coordinates, or right-click on the map
          </div>
        </>
      ) : !hasDestination ? (
        <>
          <Navigation className="hint-icon" />
          <div className="hint-text">Set your destination</div>
          <div className="hint-subtext">
            Search for a station, enter coordinates, or right-click on the map
          </div>
        </>
      ) : null}
    </div>
  );
}
