import { useEffect, useRef, useCallback } from 'react';
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
import { getMapData, getGraphEdges } from '@/lib/api';
import type { LatLng, OSMNode, GraphEdgesResponse, Location } from '@/types';
import MapContextMenu from './MapContextMenu';
import MapLegend from './MapLegend';

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
  const { setContextMenu, mode } = useApp();

  useMapEvents({
    contextmenu(e) {
      // Prevent default browser context menu
      L.DomEvent.preventDefault(e.originalEvent);

      const coord: LatLng = [e.latlng.lat, e.latlng.lng];
      setContextMenu({
        visible: true,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        latlng: coord,
      });
    },
    click() {
      // Close context menu on regular click
      // (handled by AppContext's closeContextMenu)
    },
  });

  return null;
}

// ── Major station names for priority labeling ──
const MAJOR_STATIONS = new Set([
  'Kyoto', 'Kyōto', 'Kyoto Station',
  'Nijo', 'Nijō', 'Nijo Station',
  'Arashiyama', 'Arashiyama Station',
  'Gion-Shijo', 'Gion-Shijō', 'Gion-Shijo Station',
  'Karasuma', 'Karasuma Oike', 'Karasuma Station',
  'Sanjo', 'Sanjō', 'Sanjo Keihan',
  'Fushimi Inari', 'Fushimi-Inari',
  'Uzumasa Tenjingawa', 'Uzumasa-Tenjingawa',
  'Takeda', 'Kitaoji', 'Kitaōji',
  'Rokujizo', 'Rokujizō',
  'Ono', 'Daigo',
  'Yamashina',
  'Kuinabashi',
  'Toji', 'Tōji',
  'Shijo', 'Shijō',
  'Karasuma Oike',
  'Imadegawa',
  'Marutamachi',
  'Kokusaikaikan',
]);

function isMajorStation(name: string): boolean {
  if (MAJOR_STATIONS.has(name)) return true;
  // Partial match for compound names
  for (const major of MAJOR_STATIONS) {
    if (name.includes(major) || major.includes(name)) return true;
  }
  return false;
}

// ── Generate tooltip HTML based on zoom level ──
type CalloutLevel = 'full' | 'compact' | 'minimal' | 'hidden';

function getCalloutLevel(zoom: number, isMajor: boolean): CalloutLevel {
  if (zoom >= 15) return 'full';
  if (zoom >= 14) return isMajor ? 'full' : 'compact';
  if (zoom >= 13) return isMajor ? 'compact' : 'minimal';
  if (zoom >= 12) return isMajor ? 'minimal' : 'hidden';
  return 'hidden';
}

function buildCalloutHTML(
  nameEn: string,
  nameJa: string,
  isBlocked: boolean,
  level: CalloutLevel
): string {
  const statusClass = isBlocked ? 'disabled' : 'enabled';
  const statusText = isBlocked ? 'Disabled' : 'Enabled';

  if (level === 'full') {
    return `<div class="callout-inner">
      <div class="callout-name-en">${nameEn}</div>
      ${nameJa ? `<div class="callout-name-ja">${nameJa}</div>` : ''}
      <div class="callout-status ${statusClass}">
        <span class="status-indicator"></span>
        <span>${statusText}</span>
      </div>
    </div>`;
  }

  if (level === 'compact') {
    return `<div class="callout-inner">
      <div class="callout-name-en">${nameEn}</div>
      <div class="callout-status ${statusClass}">
        <span class="status-indicator"></span>
        <span>${statusText}</span>
      </div>
    </div>`;
  }

  // minimal
  // Shorten name if too long
  const shortName = nameEn.length > 12 ? nameEn.split(/[\s\-]/)[0] : nameEn;
  return `<div class="callout-inner">
    <div class="callout-name-en">${shortName}</div>
  </div>`;
}

function getCalloutClassName(
  level: CalloutLevel,
  isBlocked: boolean,
  isMajor: boolean
): string {
  const classes = ['station-callout'];
  if (level === 'compact') classes.push('callout-compact');
  if (level === 'minimal') classes.push('callout-minimal');
  if (isBlocked) classes.push('callout-disabled');
  if (isMajor) classes.push('callout-major');
  return classes.join(' ');
}

// ── Station info stored for zoom updates ──
interface StationMarkerInfo {
  marker: L.CircleMarker;
  nameEn: string;
  nameJa: string;
  isBlocked: boolean;
  isMajor: boolean;
}

// ── Station layer ──
function StationLayer() {
  const {
    disabledStations,
    mode,
    toggleStation,
    setContextMenu,
    setOrigin,
    setDestination,
    origin,
    stations,
  } = useApp();
  const map = useMap();
  const layerRef = useRef<L.FeatureGroup | null>(null);
  const stationInfosRef = useRef<StationMarkerInfo[]>([]);
  const currentZoomRef = useRef(map.getZoom());

  // Keep refs to current state for click handlers
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const originRef = useRef(origin);
  originRef.current = origin;

  // Update tooltips based on current zoom
  const updateTooltipsForZoom = useCallback((zoom: number) => {
    const infos = stationInfosRef.current;
    for (const info of infos) {
      const level = getCalloutLevel(zoom, info.isMajor);

      if (level === 'hidden') {
        // Unbind tooltip if hidden
        if (info.marker.getTooltip()) {
          info.marker.unbindTooltip();
        }
      } else {
        const html = buildCalloutHTML(info.nameEn, info.nameJa, info.isBlocked, level);
        const className = getCalloutClassName(level, info.isBlocked, info.isMajor);

        if (info.marker.getTooltip()) {
          // Update existing tooltip
          info.marker.setTooltipContent(html);
          const tooltipEl = info.marker.getTooltip()?.getElement();
          if (tooltipEl) {
            // Update CSS classes
            tooltipEl.className = tooltipEl.className
              .replace(/station-callout\S*/g, '')
              .replace(/callout-\S*/g, '')
              .trim() + ' ' + className;
          }
        } else {
          // Bind new tooltip
          info.marker.bindTooltip(html, {
            permanent: true,
            direction: 'top',
            offset: [0, -12],
            className,
            interactive: false,
          });
        }
      }
    }
  }, []);

  // Listen for zoom changes
  useMapEvents({
    zoomend() {
      const newZoom = map.getZoom();
      if (newZoom !== currentZoomRef.current) {
        currentZoomRef.current = newZoom;
        updateTooltipsForZoom(newZoom);
      }
    },
  });

  const loadStations = useCallback(async () => {
    try {
      const data = await getMapData();
      if (layerRef.current) map.removeLayer(layerRef.current);
      const group = L.featureGroup();
      const newInfos: StationMarkerInfo[] = [];
      const zoom = map.getZoom();

      data.elements.forEach((el) => {
        const node = el as OSMNode;
        if (node.type !== 'node' || !node.tags?.railway || node.tags.railway !== 'stop')
          return;

        const nameEn = node.tags['name:en'] || node.tags['name'] || `Station ${node.id}`;
        const nameJa = node.tags['name:ja'] || node.tags['name'] || '';
        const isBlocked = disabledStations.has(node.id);
        const isMajor = isMajorStation(nameEn);

        const marker = L.circleMarker([node.lat, node.lon], {
          radius: 7,
          weight: 2,
          color: isBlocked ? '#9ca3af' : '#3b82f6',
          fillColor: isBlocked ? '#d1d5db' : '#ffffff',
          fillOpacity: isBlocked ? 0.5 : 1,
          opacity: isBlocked ? 0.5 : 1,
        });

        // Bind permanent tooltip (callout)
        const level = getCalloutLevel(zoom, isMajor);
        if (level !== 'hidden') {
          const html = buildCalloutHTML(nameEn, nameJa, isBlocked, level);
          const className = getCalloutClassName(level, isBlocked, isMajor);
          marker.bindTooltip(html, {
            permanent: true,
            direction: 'top',
            offset: [0, -12],
            className,
            interactive: false,
          });
        }

        // Popup (for click)
        const popupContent = isBlocked
          ? `<b>${nameEn}</b><br/><span style="font-size:0.75rem;color:#9ca3af">${nameJa}</span><br/><span style="color:#ef4444;font-size:0.75rem">Station disabled</span>`
          : `<b>${nameEn}</b><br/><span style="font-size:0.75rem;color:#6b7280">${nameJa}</span>`;
        marker.bindPopup(popupContent);

        // Right-click on station
        marker.on('contextmenu', (e) => {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);

          setContextMenu({
            visible: true,
            x: (e.originalEvent as MouseEvent).clientX,
            y: (e.originalEvent as MouseEvent).clientY,
            latlng: [node.lat, node.lon],
            station: {
              id: node.id,
              name: nameEn,
              japaneseName: nameJa,
              lat: node.lat,
              lng: node.lon,
            },
          });
        });

        // Left-click on station
        marker.on('click', async (e) => {
          L.DomEvent.stopPropagation(e);

          if (modeRef.current === 'station-management') {
            // Toggle station in admin mode
            await toggleStation(node.id);
          }
        });

        marker.addTo(group);
        newInfos.push({ marker, nameEn, nameJa, isBlocked, isMajor });
      });

      group.addTo(map);
      layerRef.current = group;
      stationInfosRef.current = newInfos;
    } catch (err) {
      console.error('Failed to load stations:', err);
      toast.error('Failed to load station data');
    }
  }, [map, disabledStations, toggleStation, setContextMenu, setOrigin, setDestination, updateTooltipsForZoom]);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  return null;
}

// ── Route polylines ──
function RouteOverlay() {
  const { shortestDistanceRoute, fastestTravelTimeRoute } = useApp();

  const shortestCoords = shortestDistanceRoute?.path
    .filter((s) => s.coord)
    .map((s) => s.coord) || [];

  const fastestCoords = fastestTravelTimeRoute?.path
    .filter((s) => s.coord)
    .map((s) => s.coord) || [];

  // Get waypoint stations for each route
  const shortestStops = shortestDistanceRoute?.path.filter(
    (s) => s.type === 'stop' && s.name
  ) || [];
  const fastestStops = fastestTravelTimeRoute?.path.filter(
    (s) => s.type === 'stop' && s.name
  ) || [];

  return (
    <>
      {/* Shortest distance route — blue */}
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

      {/* Fastest travel time route — green */}
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

      {/* Waypoint markers for shortest route */}
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

      {/* Waypoint markers for fastest route */}
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
        const blockedTrackSet = new Set(
          (data.blocked_track_nodes || []).map(String)
        );

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

      {/* Map context menu */}
      {contextMenu.visible && <MapContextMenu />}

      {/* Map legend */}
      <MapLegend />
    </div>
  );
}
