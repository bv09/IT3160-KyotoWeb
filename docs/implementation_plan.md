# Kyoto Transit Routing — Frontend Redesign
Complete redesign of the frontend-v2 application to match the detailed specification for a map-first transit planner with dual-route display, station management, and synchronized map/sidebar interaction.
## Current State Assessment
The `frontend-v2` directory has an existing Vite + React + TypeScript + Tailwind + shadcn/ui project with:
- ✅ Project scaffolding (Vite, Tailwind, shadcn/ui configured)
- ✅ Basic component structure (layout, map, route, ui)
- ✅ React Context (but no auto-recalculation logic)
- ✅ API service layer
- ✅ Type definitions
- ✅ React-Leaflet map with station markers and polylines
- ✅ shadcn/ui components installed (badge, button, card, input, etc.)
### Issues to Address
1. **No Framer Motion** — must install for animations
2. **No automatic route recalculation** — Context is pure state, no useEffect hooks
3. **Backend returns ONE route** — spec requires TWO (shortest distance + fastest time). Frontend must simulate or derive the second route since backend only has Dijkstra on distance
4. **Route data mismatch** — frontend types expect `travelTimeMinutes`, `transfers`, `mainLine`, `segments` which backend doesn't provide
5. **Map uses React-Leaflet** — spec requests React Map GL + Mapbox, but the existing setup uses React-Leaflet with OpenStreetMap. **I will keep React-Leaflet** since it works, is free (no Mapbox token), and is already integrated
6. **UI needs polish** — must match the premium Kyoto-inspired design spec with glassmorphism, micro-animations, and proper layout
> [!IMPORTANT]
> **Map Library Decision**: The spec requests React Map GL + Mapbox GL JS, but the project already uses React-Leaflet with free OpenStreetMap tiles. Switching to Mapbox would require a paid API token. **I will keep React-Leaflet** and enhance the visual design significantly. If you want Mapbox, please provide a Mapbox access token.
> [!IMPORTANT]
> **Backend Route Limitation**: The backend only computes ONE shortest-distance route via Dijkstra. The spec requires TWO results (shortest distance + fastest travel time). Since the backend doesn't have a travel-time-based pathfinding algorithm, I will:
> 1. Call the pathfind endpoint once for the shortest distance route
> 2. Derive an estimated "fastest time" result by computing travel time from distance (using average train speed ~40km/h) and presenting both cards
> 3. The two route cards will show the same path but with different emphasis (distance vs time)
> 
> A true "fastest travel time" route would require backend modifications to weight edges by time instead of distance.
## Proposed Changes
### 1. Package Installation
#### [MODIFY] [package.json](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/package.json)
Install new dependencies:
- `framer-motion` — for animations (spec requirement)
- `@radix-ui/react-accordion` — for route details expansion
- `@radix-ui/react-context-menu` — for right-click context menu
---
### 2. Types & Data Layer
#### [MODIFY] [index.ts](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/types/index.ts)
- Refine `RouteResult` to include both distance and time emphasis
- Add `RouteType` enum: `'shortest-distance' | 'fastest-time'`
- Add `ContextMenuState` type for right-click menu positioning
- Add `MapData` interface matching backend response
#### [MODIFY] [api.ts](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/lib/api.ts)
- Add helper to transform backend response into `RouteResult` with computed travel time and segments
- Add route derivation logic to produce two route variants from single backend response
---
### 3. State Management — Complete Rewrite
#### [MODIFY] [RoutingContext.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/context/RoutingContext.tsx)
Complete rewrite to include:
- Full state shape matching spec: `mode`, `origin`, `destination`, `disabledStations`, `shortestDistanceRoute`, `fastestTravelTimeRoute`, `selectedLocation`, `loading`, `error`
- `stations` list derived from map data
- `mapData` for edges/nodes
- **Auto-recalculation via useEffect** — watches `origin`, `destination`, `disabledStations` and triggers route computation
- Context menu state management
- Station search/filter state
- All setter functions and actions
---
### 4. Layout Components
#### [MODIFY] [AppHeader.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/components/layout/AppHeader.tsx)
- Remove from floating header to integrated sidebar header
- Mode switcher as segmented control tabs at top of sidebar
#### [NEW] [Sidebar.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/components/layout/Sidebar.tsx)
- Single left sidebar component (20-25% width)
- Contains: App branding, mode switcher, conditional content based on mode
- Glassmorphism background with Kyoto-inspired design
- Smooth mode transition animations via Framer Motion
#### [MODIFY] [MobileSheet.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/components/layout/MobileSheet.tsx)
- Update to work with new sidebar content structure
---
### 5. Route Search Components
#### [MODIFY] [RoutingPanel.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/components/route/RoutingPanel.tsx)
Complete rewrite:
- Origin input with station autocomplete + coordinate entry
- Destination input with same capabilities
- Display station names as "English Name (日本語名)"
- No search button — automatic recalculation
- Two route summary cards displayed simultaneously
#### [NEW] [RouteCard.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/components/route/RouteCard.tsx)
Individual route summary card:
- Route type label (Shortest Distance / Fastest Travel Time)
- Primary metric (distance or time)
- Secondary metric
- Main transit line
- Transfer count
- Expandable details accordion
- Framer Motion expand/collapse animation
#### [MODIFY] [JourneyDetails.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/components/route/JourneyDetails.tsx)
Rewrite as route timeline component:
- Visual timeline with connecting lines
- Start/end points
- Walking segments
- Train boarding with line names
- Transfer stations with wait times
- Intermediate stations
- Framer Motion staggered entrance
---
### 6. Station Management Components
#### [MODIFY] [AdminPanel.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/components/route/AdminPanel.tsx)
Rename and rewrite as `StationManager.tsx`:
- Description text
- Search field for filtering stations
- Scrollable station list
- Each row: status dot, English name, Japanese name, status label, toggle switch
- Toggle triggers `toggle-node` API + auto-recalculates routes
---
### 7. Map Components
#### [MODIFY] [MapCanvas.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/components/map/MapCanvas.tsx)
Major enhancements:
- Station markers with 3 visual states (enabled/disabled/selected)
- Route polylines: Blue for shortest distance, Green for fastest time
- Both routes visible simultaneously with map legend
- Right-click context menu on stations AND arbitrary map points
- Click-to-select station in admin mode
- Synchronized with sidebar state
#### [NEW] [MapContextMenu.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/components/map/MapContextMenu.tsx)
Floating context menu component:
- "Set as From Here" option
- "Set as To Here" option
- Positioned at click coordinates
- Works for both stations and arbitrary map points
#### [NEW] [MapLegend.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/components/map/MapLegend.tsx)
Map legend showing:
- Shortest Distance Route (blue line)
- Fastest Travel Time Route (green line)
- Station markers (enabled/disabled/selected)
---
### 8. Styling
#### [MODIFY] [index.css](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/index.css)
- Update CSS variables for Kyoto-inspired color palette
- Dark mode support
#### [MODIFY] [App.css](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/App.css)
Complete redesign:
- Kyoto-inspired glassmorphism sidebar
- Premium typography with Inter
- Micro-animations for hover states
- Station marker styles
- Route polyline styles
- Context menu styles
- Responsive breakpoints
#### [MODIFY] [tailwind.config.js](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/tailwind.config.js)
- Add Kyoto color palette tokens
- Add animation utilities
---
### 9. Main App Assembly
#### [MODIFY] [App.tsx](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/src/App.tsx)
- New layout: Sidebar (left) + Map (right)
- Never two sidebars
- Remove separate AppHeader (integrated into Sidebar)
- SEO meta tags
#### [MODIFY] [index.html](file:///d:/Workspace/hust_academic/year2/IT3060-KyotoWeb/IT3160-KyotoWeb/project/frontend-v2/index.html)
- Update title and meta tags
- Add meta description for SEO
---
## Component Hierarchy
```
App
├── RoutingProvider (Context)
│   ├── Sidebar (left, 20-25% width)
│   │   ├── AppBranding (title + subtitle)
│   │   ├── ModeSwitcher (segmented tabs)
│   │   ├── [Mode: route-search]
│   │   │   ├── OriginInput (autocomplete + coordinates)
│   │   │   ├── DestinationInput (autocomplete + coordinates)
│   │   │   ├── RouteCard (Shortest Distance)
│   │   │   │   └── JourneyTimeline (accordion)
│   │   │   └── RouteCard (Fastest Travel Time)
│   │   │       └── JourneyTimeline (accordion)
│   │   └── [Mode: station-management]
│   │       ├── Description text
│   │       ├── StationSearch
│   │       └── StationList
│   │           └── StationRow (×N)
│   ├── MapCanvas (right, 75-80% width)
│   │   ├── StationMarkers
│   │   ├── RoutePolylines
│   │   ├── GraphEdges
│   │   └── MapLegend
│   ├── MapContextMenu (floating, on right-click)
│   ├── MobileSheet (responsive)
│   └── Toaster (notifications)
```
## Verification Plan
### Automated Tests
```bash
cd d:\Workspace\hust_academic\year2\IT3060-KyotoWeb\IT3160-KyotoWeb\project\frontend-v2
npm run build
```
Build must succeed with no TypeScript errors.
### Manual Verification
1. Run `npm run dev` and verify in browser
2. Check sidebar layout (20-25% width)
3. Test mode switching animation
4. Verify station autocomplete search
5. Test right-click context menu on map
6. Verify dual route cards display
7. Test accordion expand/collapse
8. Test station disable/enable from sidebar
9. Test station disable/enable from map
10. Verify map-sidebar synchronization
11. Test responsive mobile layout
