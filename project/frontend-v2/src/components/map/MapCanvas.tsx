import { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Polyline,
  CircleMarker,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';
import { getGraphEdges } from '@/lib/api';
import type { LatLng, GraphEdgesResponse } from '@/types';
import MapContextMenu from './MapContextMenu';
import MapLegend from './MapLegend';
import StationMarker from './StationMarker';

const MAP_CENTER: LatLng = [35.0116, 135.7681];
const MAP_ZOOM = 13;
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

// ── Error toast listener ──
function ErrorListener() {
  const { error } = useApp();
  const prevError = useRef<string | null>(null);
  useEffect(() => {
    if (error && error !== prevError.current) {
      toast.error(error, { duration: 5000 });
    }
    prevError.current = error;
  }, [error]);
  return null;
}

// ── Map right-click handler ──
function MapContextMenuHandler() {
  const { setContextMenu } = useApp();

  useMapEvents({
    contextmenu(e) {
      L.DomEvent.preventDefault(e.originalEvent);
      const coord: LatLng = [e.latlng.lat, e.latlng.lng];
      setContextMenu({
        visible: true,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        latlng: coord,
      });
    },
  });

  return null;
}

// ── Zoom tracker — lifts current zoom into React state ──
function useZoomState(): number {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvents({
    zoomend() {
      setZoom(map.getZoom());
    },
  });

  return zoom;
}

// ── Station layer (declarative, one StationMarker per station) ──
function StationLayer() {
  const { stations } = useApp();
  const zoom = useZoomState();

  return (
    <>
      {stations.map((station) => (
        <StationMarker key={station.id} station={station} zoom={zoom} />
      ))}
    </>
  );
}

// ── Route polylines ──
function RouteOverlay() {
  const { shortestDistanceRoute, fastestTravelTimeRoute } = useApp();

  const shortestCoords =
    shortestDistanceRoute?.path
      .filter((s) => s.coord)
      .map((s) => s.coord) || [];

  const fastestCoords =
    fastestTravelTimeRoute?.path
      .filter((s) => s.coord)
      .map((s) => s.coord) || [];

  const shortestStops =
    shortestDistanceRoute?.path.filter((s) => s.type === 'stop' && s.name) || [];
  const fastestStops =
    fastestTravelTimeRoute?.path.filter((s) => s.type === 'stop' && s.name) || [];

  return (
    <>
      {shortestCoords.length > 1 && (
        <>
          <Polyline
            positions={shortestCoords}
            pathOptions={{ color: '#3b82f6', weight: 6, opacity: 0.3 }}
          />
          <Polyline
            positions={shortestCoords}
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
          />
        </>
      )}

      {fastestCoords.length > 1 && (
        <>
          <Polyline
            positions={fastestCoords}
            pathOptions={{ color: '#10b981', weight: 6, opacity: 0.3 }}
          />
          <Polyline
            positions={fastestCoords}
            pathOptions={{ color: '#10b981', weight: 4, opacity: 0.8, dashArray: '8 6' }}
          />
        </>
      )}

      {shortestStops.map((s, i) =>
        s.coord ? (
          <CircleMarker
            key={`short-${i}`}
            center={s.coord}
            radius={5}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#ffffff',
              fillOpacity: 1,
              weight: 2,
            }}
          />
        ) : null
      )}

      {fastestStops.map((s, i) =>
        s.coord ? (
          <CircleMarker
            key={`fast-${i}`}
            center={s.coord}
            radius={5}
            pathOptions={{
              color: '#10b981',
              fillColor: '#ffffff',
              fillOpacity: 1,
              weight: 2,
            }}
          />
        ) : null
      )}
    </>
  );
}

// ── Origin/Destination markers ──
function LocationMarkers() {
  const { origin, destination } = useApp();

  return (
    <>
      {origin && (
        <CircleMarker
          center={origin.coordinates}
          radius={8}
          pathOptions={{
            color: '#059669',
            fillColor: '#059669',
            fillOpacity: 1,
            weight: 3,
          }}
        />
      )}
      {destination && (
        <CircleMarker
          center={destination.coordinates}
          radius={8}
          pathOptions={{
            color: '#dc2626',
            fillColor: '#dc2626',
            fillOpacity: 1,
            weight: 3,
          }}
        />
      )}
    </>
  );
}

// ── Graph overlay ──
function GraphOverlay() {
  const { showGraph, disabledStations } = useApp();
  const map = useMap();
  const layerRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!showGraph) {
      if (layerRef.current) map.removeLayer(layerRef.current);
      layerRef.current = null;
      return;
    }

    getGraphEdges()
      .then((data: GraphEdgesResponse) => {
        if (layerRef.current) map.removeLayer(layerRef.current);
        const group = L.featureGroup();
        const blockedTrackSet = new Set((data.blocked_track_nodes || []).map(String));

        (data.edges || []).forEach((edge) => {
          const fromC = data.nodes[String(edge.from)];
          const toC = data.nodes[String(edge.to)];
          if (!fromC || !toC) return;

          const isBlocked =
            blockedTrackSet.size > 0 &&
            (blockedTrackSet.has(String(edge.from)) ||
              blockedTrackSet.has(String(edge.to)));

          L.polyline([fromC, toC], {
            color: isBlocked ? '#6b7280' : '#6366f1',
            weight: isBlocked ? 2 : 3,
            opacity: isBlocked ? 0.25 : 0.35,
            interactive: false,
          }).addTo(group);
        });

        group.addTo(map);
        layerRef.current = group;
      })
      .catch((err) => {
        console.error('Failed to load graph:', err);
        toast.error('Failed to load graph data');
      });

    return () => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    };
  }, [showGraph, map, disabledStations]);

  return null;
}

// ── Main MapCanvas ──
export default function MapCanvas() {
  const { contextMenu } = useApp();

  return (
    <div className="flex-1 relative">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        <ZoomControl position="topright" />
        <ErrorListener />
        <MapContextMenuHandler />
        <StationLayer />
        <GraphOverlay />
        <RouteOverlay />
        <LocationMarkers />
      </MapContainer>

      {contextMenu.visible && <MapContextMenu />}
      <MapLegend />
    </div>
  );
}
