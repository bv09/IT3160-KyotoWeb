import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppMode,
  Location,
  RouteResult,
  StationListItem,
  GraphEdgesResponse,
  ContextMenuState,
  LatLng,
  OSMNode,
} from '@/types';
import { pathfind, getGraphEdges, getMapData, toggleNode, unblockAll } from '@/lib/api';
import { toast } from 'sonner';

// ── State shape ──
interface AppState {
  mode: AppMode;
  origin: Location | null;
  destination: Location | null;
  disabledStations: Set<number>;
  shortestDistanceRoute: RouteResult | null;
  fastestTravelTimeRoute: RouteResult | null;
  stations: StationListItem[];
  graphData: GraphEdgesResponse | null;
  loading: boolean;
  error: string | null;
  contextMenu: ContextMenuState;
  showShortestDetails: boolean;
  showFastestDetails: boolean;
  showGraph: boolean;
}

// ── Context value (state + actions) ──
interface AppContextValue extends AppState {
  setMode: (mode: AppMode) => void;
  setOrigin: (loc: Location | null) => void;
  setDestination: (loc: Location | null) => void;
  swapOriginDestination: () => void;
  toggleStation: (nodeId: number) => Promise<void>;
  resetAllStations: () => Promise<void>;
  setContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  setShowShortestDetails: (v: boolean) => void;
  setShowFastestDetails: (v: boolean) => void;
  setShowGraph: (v: boolean) => void;
  refreshGraphData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

// ── Provider ──
export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AppMode>('route-search');
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [disabledStations, setDisabledStations] = useState<Set<number>>(new Set());
  const [shortestDistanceRoute, setShortestDistanceRoute] = useState<RouteResult | null>(null);
  const [fastestTravelTimeRoute, setFastestTravelTimeRoute] = useState<RouteResult | null>(null);
  const [stations, setStations] = useState<StationListItem[]>([]);
  const [graphData, setGraphData] = useState<GraphEdgesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    latlng: [0, 0],
  });
  const [showShortestDetails, setShowShortestDetails] = useState(false);
  const [showFastestDetails, setShowFastestDetails] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  // Track recalculation trigger version to debounce
  const recalcVersion = useRef(0);

  // ── Close context menu ──
  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  // ── Swap origin/destination ──
  const swapOriginDestination = useCallback(() => {
    const prevOrigin = origin;
    const prevDest = destination;
    setOrigin(prevDest);
    setDestination(prevOrigin);
  }, [origin, destination]);

  // ── Load initial data ──
  const refreshGraphData = useCallback(async () => {
    try {
      const data = await getGraphEdges();
      setGraphData(data);
      const blockedSet = new Set((data.blocked_nodes || []).map(Number));
      setDisabledStations(blockedSet);
    } catch (err) {
      console.error('Failed to load graph data:', err);
    }
  }, []);

  // Load stations from map data
  useEffect(() => {
    async function loadStations() {
      try {
        const [mapData, graphEdgesData] = await Promise.all([getMapData(), getGraphEdges()]);
        setGraphData(graphEdgesData);

        const blockedSet = new Set((graphEdgesData.blocked_nodes || []).map(Number));
        setDisabledStations(blockedSet);

        // Extract station nodes from OSM data
        const stationList: StationListItem[] = [];
        for (const el of mapData.elements) {
          const node = el as OSMNode;
          if (node.type !== 'node' || !node.tags?.railway || node.tags.railway !== 'stop') continue;

          const nameEn = node.tags['name:en'] || node.tags['name'] || `Station ${node.id}`;
          const nameJa = node.tags['name:ja'] || node.tags['name'] || '';

          stationList.push({
            id: node.id,
            name: nameEn,
            japaneseName: nameJa,
            lat: node.lat,
            lng: node.lon,
            isDisabled: blockedSet.has(node.id),
          });
        }

        // Sort alphabetically
        stationList.sort((a, b) => a.name.localeCompare(b.name));
        setStations(stationList);
      } catch (err) {
        console.error('Failed to load station data:', err);
        toast.error('Failed to load station data');
      }
    }
    loadStations();
  }, []);

  // ── Toggle station ──
  const handleToggleStation = useCallback(
    async (nodeId: number) => {
      try {
        const result = await toggleNode(nodeId);
        const newDisabled = new Set(disabledStations);
        if (result.blocked) {
          newDisabled.add(nodeId);
        } else {
          newDisabled.delete(nodeId);
        }
        setDisabledStations(newDisabled);

        // Update station list
        setStations((prev) =>
          prev.map((s) => (s.id === nodeId ? { ...s, isDisabled: result.blocked } : s))
        );

        // Refresh graph data for blocked_track_nodes
        const freshGraph = await getGraphEdges();
        setGraphData(freshGraph);
      } catch (err) {
        console.error('Toggle station error:', err);
        toast.error('Failed to toggle station');
      }
    },
    [disabledStations]
  );

  // ── Reset all stations ──
  const handleResetAll = useCallback(async () => {
    try {
      await unblockAll();
      setDisabledStations(new Set());
      setStations((prev) => prev.map((s) => ({ ...s, isDisabled: false })));
      const freshGraph = await getGraphEdges();
      setGraphData(freshGraph);
      toast.success('All stations re-enabled');
    } catch (err) {
      console.error('Reset all error:', err);
      toast.error('Failed to reset stations');
    }
  }, []);

  // ── Auto-recalculate routes when origin/destination/disabledStations change ──
  useEffect(() => {
    if (!origin || !destination) {
      setShortestDistanceRoute(null);
      setFastestTravelTimeRoute(null);
      return;
    }

    const version = ++recalcVersion.current;

    const timer = setTimeout(async () => {
      if (version !== recalcVersion.current) return; // debounce

      setLoading(true);
      setError(null);

      try {
        const start: LatLng = origin.coordinates;
        const end: LatLng = destination.coordinates;

        if (start[0] === end[0] && start[1] === end[1]) {
          setError('Origin and destination must be different');
          setLoading(false);
          return;
        }

        const result = await pathfind(start, end);

        if (version !== recalcVersion.current) return;

        if (!result.shortest && !result.fastest) {
          setError('No route found between the selected points');
          setShortestDistanceRoute(null);
          setFastestTravelTimeRoute(null);
        } else {
          setShortestDistanceRoute(result.shortest);
          setFastestTravelTimeRoute(result.fastest);
          setError(null);
        }
      } catch (err) {
        if (version !== recalcVersion.current) return;
        const msg = err instanceof Error ? err.message : 'Route calculation failed';
        setError(msg);
        setShortestDistanceRoute(null);
        setFastestTravelTimeRoute(null);
      } finally {
        if (version === recalcVersion.current) {
          setLoading(false);
        }
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [origin, destination, disabledStations]);

  // ── Context value ──
  const value: AppContextValue = {
    mode,
    origin,
    destination,
    disabledStations,
    shortestDistanceRoute,
    fastestTravelTimeRoute,
    stations,
    graphData,
    loading,
    error,
    contextMenu,
    showShortestDetails,
    showFastestDetails,
    showGraph,
    setMode,
    setOrigin,
    setDestination,
    swapOriginDestination,
    toggleStation: handleToggleStation,
    resetAllStations: handleResetAll,
    setContextMenu,
    closeContextMenu,
    setShowShortestDetails,
    setShowFastestDetails,
    setShowGraph,
    refreshGraphData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
