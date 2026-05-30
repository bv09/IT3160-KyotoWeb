import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Polyline, CircleMarker, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import { useRouting, useRoutingDispatch } from '@/context/RoutingContext';
import { pathfind, getMapData, getGraphEdges, toggleNode } from '@/lib/api';
import type { LatLng, OSMNode, GraphEdgesResponse } from '@/types';

const MAP_CENTER: LatLng = [35.0116, 135.7681];
const MAP_ZOOM = 13;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; OpenStreetMap contributors';

function ErrorListener() {
  const { error } = useRouting();
  useEffect(() => {
    if (error) {
      toast.error(error, { duration: 5000 });
    }
  }, [error]);
  return null;
}

function MapEvents() {
  const { phase, origin, destination, sandboxMode } = useRouting();
  const dispatch = useRoutingDispatch();

  useMapEvents({
    click(e) {
      if (sandboxMode) return;
      if (phase !== 'selecting') return;
      const coord: LatLng = [e.latlng.lat, e.latlng.lng];

      if (!origin) {
        dispatch({ type: 'SET_ORIGIN', payload: coord });
      } else if (!destination) {
        dispatch({ type: 'SET_DESTINATION', payload: coord });
        dispatch({ type: 'START_LOADING' });

        const orig = origin;
        const dest = coord;
        if (orig[0] === dest[0] && orig[1] === dest[1]) {
          dispatch({ type: 'SET_ERROR', payload: 'Origin and destination must be different.' });
          return;
        }

        pathfind(orig, dest)
          .then(({ fastest }) => {
            if (!fastest) {
              dispatch({ type: 'SET_ERROR', payload: 'No path found between selected points.' });
              return;
            }
            dispatch({
              type: 'SET_ROUTE_RESULT',
              payload: fastest,
            });
          })
          .catch((err) => {
            dispatch({ type: 'SET_ERROR', payload: err.message });
          });
      }
    },
  });

  return null;
}

function StationLayer() {
  const { disabledStationIds, sandboxMode, phase, origin } = useRouting();
  const dispatch = useRoutingDispatch();
  const map = useMap();
  const layerRef = useRef<L.FeatureGroup | null>(null);
  const originRef = useRef(origin);
  originRef.current = origin;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const sandboxRef = useRef(sandboxMode);
  sandboxRef.current = sandboxMode;

  const loadStations = useCallback(async () => {
    try {
      const data = await getMapData();
      if (layerRef.current) map.removeLayer(layerRef.current);
      const group = L.featureGroup();

      data.elements.forEach((el: OSMNode) => {
        if (el.type !== 'node' || !el.tags?.railway || el.tags.railway !== 'stop') return;
        const name = el.tags['name:en'] || `Stop_${el.id}`;
        const isBlocked = disabledStationIds.has(el.id);

        const marker = L.circleMarker([el.lat, el.lon], {
          radius: 8,
          color: 'white',
          fillColor: isBlocked ? '#555' : '#dc2626',
          fillOpacity: isBlocked ? 0.5 : 1,
          opacity: isBlocked ? 0.5 : 1,
        });

        marker.bindPopup(
          isBlocked
            ? `<b>${name}</b><br><span style="color:#ef4444">Station disabled</span>`
            : `<b>${name}</b><br><small>Lat: ${el.lat.toFixed(5)}, Lon: ${el.lon.toFixed(5)}</small>`
        );

        marker.on('click', async (e) => {
          L.DomEvent.stopPropagation(e);
          if (sandboxRef.current) {
            try {
              await toggleNode(el.id);
              const graphData = await getGraphEdges();
              dispatch({
                type: 'SET_DISABLED_STATIONS',
                payload: new Set((graphData.blocked_nodes || []).map(Number)),
              });
            } catch (err) {
              console.error('Toggle node error:', err);
              toast.error('Failed to toggle station.');
            }
          } else if (phaseRef.current === 'selecting') {
            const coord: LatLng = [el.lat, el.lon];
            if (!originRef.current) {
              dispatch({ type: 'SET_ORIGIN', payload: coord });
            } else {
              const orig = originRef.current;
              const dest = coord;
              dispatch({ type: 'SET_DESTINATION', payload: dest });
              dispatch({ type: 'START_LOADING' });

              if (orig[0] === dest[0] && orig[1] === dest[1]) {
                dispatch({ type: 'SET_ERROR', payload: 'Origin and destination must be different.' });
                return;
              }

              try {
                const { fastest } = await pathfind(orig, dest);
                if (!fastest) {
                  dispatch({ type: 'SET_ERROR', payload: 'No path found between selected points.' });
                  return;
                }
                dispatch({ type: 'SET_ROUTE_RESULT', payload: fastest });
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                dispatch({ type: 'SET_ERROR', payload: msg });
              }
            }
          }
        });

        marker.addTo(group);
      });

      group.addTo(map);
      layerRef.current = group;
    } catch (err) {
      console.error('Failed to load stations:', err);
      toast.error('Failed to load station data.');
    }
  }, [map, disabledStationIds, dispatch]);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  return null;
}

function RouteOverlay() {
  const { routeResult } = useRouting();
  if (!routeResult || routeResult.path.length === 0) return null;

  const coords = routeResult.path
    .filter((s) => s.coord)
    .map((s) => s.coord as [number, number]);

  const stops = routeResult.path.filter(
    (s) => s.type === 'stop' || s.type === 'entrance'
  );

  return (
    <>
      <Polyline positions={coords} color="#4f46e5" weight={5} opacity={0.8} />
      <Polyline positions={coords} color="#818cf8" weight={3} opacity={0.6} />
      {stops.map((s, i) =>
        s.coord ? (
          <CircleMarker
            key={i}
            center={s.coord}
            radius={6}
            pathOptions={{
              color: 'white',
              fillColor: s.type === 'stop' ? '#059669' : '#7c3aed',
              fillOpacity: 1,
            }}
          />
        ) : null
      )}
    </>
  );
}

function GraphOverlay() {
  const { showGraph } = useRouting();
  const map = useMap();
  const layerRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!showGraph) {
      if (layerRef.current) map.removeLayer(layerRef.current);
      layerRef.current = null;
      return;
    }

    getGraphEdges().then((data: GraphEdgesResponse) => {
      if (layerRef.current) map.removeLayer(layerRef.current);
      const group = L.featureGroup();
      const blockedTrackSet = new Set(
        (data.blocked_track_nodes || []).map(String)
      );

      (data.edges || []).forEach((edge) => {
        const fromC = data.nodes[String(edge.from)];
        const toC = data.nodes[String(edge.to)];
        if (!fromC || !toC) return;

        const isBlocked =
          blockedTrackSet.size > 0 &&
          (blockedTrackSet.has(String(edge.from)) || blockedTrackSet.has(String(edge.to)));

        L.polyline([fromC, toC], {
          color: isBlocked ? '#444' : '#3b82f6',
          weight: isBlocked ? 3 : 4,
          opacity: isBlocked ? 0.35 : 0.5,
          interactive: false,
        }).addTo(group);
      });

      group.addTo(map);
      layerRef.current = group;
    }).catch((err) => {
      console.error('Failed to load graph:', err);
      toast.error('Failed to load graph data.');
    });
  }, [showGraph, map]);

  return null;
}

export default function MapCanvas() {
  return (
    <div className="absolute inset-0 top-12 z-0">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_ZOOM}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={19} />
        <ZoomControl position="topright" />
        <ErrorListener />
        <MapEvents />
        <StationLayer />
        <RouteOverlay />
        <GraphOverlay />
      </MapContainer>
    </div>
  );
}
