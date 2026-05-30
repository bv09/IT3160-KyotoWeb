import { memo, useCallback } from 'react';
import { CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '@/context/AppContext';
import type { StationListItem } from '@/types';
import StationCallout from './StationCallout';

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

const StationMarker = memo(function StationMarker({ station, zoom }: StationMarkerProps) {
  const { toggleStation, setContextMenu } = useApp();

  const isBlocked = station.isDisabled;

  const handleClick = useCallback(
    async (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      await toggleStation(station.id);
    },
    [toggleStation, station.id]
  );

  const handleContextMenu = useCallback(
    (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      L.DomEvent.preventDefault(e);
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

  const popupContent = isBlocked
    ? `<b>${station.name}</b><br/><span style="font-size:0.75rem;color:#9ca3af">${station.japaneseName}</span><br/><span style="color:#ef4444;font-size:0.75rem">Station disabled</span>`
    : `<b>${station.name}</b><br/><span style="font-size:0.75rem;color:#6b7280">${station.japaneseName}</span>`;

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
    >
      <Popup>{popupContent}</Popup>
      <StationCallout station={station} zoom={zoom} />
    </CircleMarker>
  );
}, areStationMarkersEqual);

export default StationMarker;
