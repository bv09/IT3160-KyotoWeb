import { useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { MapPin, Navigation } from 'lucide-react';
import type { Location } from '@/types';

export default function MapContextMenu() {
  const { contextMenu, closeContextMenu, setOrigin, setDestination } = useApp();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') closeContextMenu();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeContextMenu]);

  if (!contextMenu.visible) return null;

  const { x, y, latlng, station } = contextMenu;

  // Position the menu so it doesn't overflow the viewport
  const style: React.CSSProperties = {
    left: x,
    top: y,
  };

  const handleSetOrigin = () => {
    const loc: Location = station
      ? {
          type: 'station',
          station,
          coordinates: latlng,
          displayName: station.japaneseName
            ? `${station.name} (${station.japaneseName})`
            : station.name,
        }
      : {
          type: 'coordinate',
          coordinates: latlng,
          displayName: `${latlng[0].toFixed(5)}, ${latlng[1].toFixed(5)}`,
        };
    setOrigin(loc);
    closeContextMenu();
  };

  const handleSetDestination = () => {
    const loc: Location = station
      ? {
          type: 'station',
          station,
          coordinates: latlng,
          displayName: station.japaneseName
            ? `${station.name} (${station.japaneseName})`
            : station.name,
        }
      : {
          type: 'coordinate',
          coordinates: latlng,
          displayName: `${latlng[0].toFixed(5)}, ${latlng[1].toFixed(5)}`,
        };
    setDestination(loc);
    closeContextMenu();
  };

  const locationName = station
    ? station.name
    : `${latlng[0].toFixed(5)}, ${latlng[1].toFixed(5)}`;

  const locationCoords = `${latlng[0].toFixed(5)}, ${latlng[1].toFixed(5)}`;

  return (
    <div className="map-context-menu animate-fade-in" style={style} ref={menuRef}>
      <div className="menu-header">
        <div className="location-name">{locationName}</div>
        {station && <div className="location-coords">{locationCoords}</div>}
      </div>

      <button className="context-menu-item" onClick={handleSetOrigin}>
        <MapPin className="icon" />
        <span>Set as From Here</span>
      </button>

      <button className="context-menu-item" onClick={handleSetDestination}>
        <Navigation className="icon" />
        <span>Set as To Here</span>
      </button>
    </div>
  );
}
