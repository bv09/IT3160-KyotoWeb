import { createContext, useContext, useReducer, type Dispatch } from 'react';
import type { LatLng, AppPhase, PathSegment, RouteResult } from '@/types';

// ── State ──
export interface RoutingState {
  phase: AppPhase;
  origin: LatLng | null;
  destination: LatLng | null;
  routeResult: RouteResult | null;
  loading: boolean;
  error: string | null;
  sandboxMode: boolean;
  disabledStationIds: Set<number>;
  showGraph: boolean;
}

const initialState: RoutingState = {
  phase: 'idle',
  origin: null,
  destination: null,
  routeResult: null,
  loading: false,
  error: null,
  sandboxMode: false,
  disabledStationIds: new Set(),
  showGraph: false,
};

// ── Actions ──
export type RoutingAction =
  | { type: 'START_SELECTING' }
  | { type: 'SET_ORIGIN'; payload: LatLng }
  | { type: 'SET_DESTINATION'; payload: LatLng }
  | { type: 'START_LOADING' }
  | { type: 'SET_ROUTE_RESULT'; payload: RouteResult }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR' }
  | { type: 'TOGGLE_SANDBOX' }
  | { type: 'SET_DISABLED_STATIONS'; payload: Set<number> }
  | { type: 'SET_SHOW_GRAPH'; payload: boolean };

function reducer(state: RoutingState, action: RoutingAction): RoutingState {
  switch (action.type) {
    case 'START_SELECTING':
      return { ...state, phase: 'selecting', origin: null, destination: null, routeResult: null, error: null };
    case 'SET_ORIGIN':
      return { ...state, origin: action.payload };
    case 'SET_DESTINATION':
      return { ...state, destination: action.payload };
    case 'START_LOADING':
      return { ...state, phase: 'loading', loading: true, error: null };
    case 'SET_ROUTE_RESULT':
      return { ...state, phase: 'idle', loading: false, routeResult: action.payload };
    case 'SET_ERROR':
      return { ...state, phase: 'idle', loading: false, error: action.payload };
    case 'CLEAR':
      return { ...state, phase: 'idle', origin: null, destination: null, routeResult: null, error: null };
    case 'TOGGLE_SANDBOX':
      return { ...state, sandboxMode: !state.sandboxMode, phase: 'idle', origin: null, destination: null, routeResult: null };
    case 'SET_DISABLED_STATIONS':
      return { ...state, disabledStationIds: action.payload };
    case 'SET_SHOW_GRAPH':
      return { ...state, showGraph: action.payload };
    default:
      return state;
  }
}

// ── Context ──
const RoutingCtx = createContext<RoutingState>(initialState);
const DispatchCtx = createContext<Dispatch<RoutingAction>>(() => {});

export function RoutingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <RoutingCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </RoutingCtx.Provider>
  );
}

export function useRouting() {
  return useContext(RoutingCtx);
}

export function useRoutingDispatch() {
  return useContext(DispatchCtx);
}
