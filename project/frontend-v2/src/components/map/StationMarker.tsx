import { memo, useCallback } from 'react';
import { CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';
import type { StationListItem } from '@/types';

interface StationMarkerProps {
  station: StationListItem;
  zoom: number;
}

function areStationMarkersEqual(
  prev: StationMarkerProps,
  next: StationMarkerProps
): boolean {
  return (
    prev.station.id === next.station.id &&
    prev.station.isDisabled === next.station.isDisabled &&
    prev.station.name === next.station.name &&
    prev.station.japaneseName === next.station.japaneseName &&
    prev.station.lat === next.station.lat &&
    prev.station.lng === next.station.lng &&
    prev.zoom === next.zoom
  );
}

const StationMarker = memo(function StationMarker({
  station,
  zoom: _zoom,
}: StationMarkerProps) {
  const { mode, toggleStation, setContextMenu } = useApp();

  const isBlocked = station.isDisabled;

  const handleClick = useCallback(
    async (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      if (mode !== 'station-management') return;
      try {
        await toggleStation(station.id);
        const label = station.japaneseName
          ? `${station.name} (${station.japaneseName})`
          : station.name;
        toast.success(
          isBlocked
            ? `${label} boarding point enabled`
            : `${label} boarding point disabled`,
          { duration: 2500 }
        );
      } catch {
        // error already handled by AppContext
      }
    },
    [mode, toggleStation, station.id, station.name, station.japaneseName, isBlocked]
  );

  const handleContextMenu = useCallback(
    (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      e.originalEvent.preventDefault();
      setContextMenu({
        visible: true,
        x: (e.originalEvent as MouseEvent).clientX,
        y: (e.originalEvent as MouseEvent).clientY,
        latlng: [station.lat, station.lng],
        station: {
          id: station.id,
          name: station.name,
          japaneseName: station.japaneseName,
          lat: station.lat,
          lng: station.lng,
        },
      });
    },
    [setContextMenu, station]
  );

  return (
    <CircleMarker
      center={[station.lat, station.lng]}
      radius={7}
      pathOptions={{
        color: isBlocked ? '#9ca3af' : '#3b82f6',
        fillColor: isBlocked ? '#d1d5db' : '#ffffff',
        fillOpacity: isBlocked ? 0.5 : 1,
        opacity: isBlocked ? 0.5 : 1,
      }}
      eventHandlers={{
        click: handleClick,
        contextmenu: handleContextMenu,
      }}
    />
  );
}, areStationMarkersEqual);

export default StationMarker;