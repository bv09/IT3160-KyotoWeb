1. Repository Understanding & Product Analysis
Based on the provided codebase, here is my analysis of the system's current state and product goals.
Product & User Goals
Primary Purpose: A web application for finding the shortest path between two locations using the Kyoto railway and subway network.

User Journeys: * Standard Users: Select a starting point and a destination to view the optimal route, total distance, and estimated travel time.  

Admin/Testers: Toggle the "blocked" status of specific stations to simulate real-world transit disruptions and observe how the AI reroutes traffic.  

Key Workflows: Users input coordinates (likely via map clicks or search), the backend snaps these to the nearest valid graph nodes using a KD-Tree spatial index , and returns the path geometry alongside walking vs. subway time estimates.  
Technical Architecture

Backend: A Python Flask application serving both REST API endpoints and static files.  

Graph Engine: A custom SubwayGraph class that manages an adjacency list of nodes, stops, and entrances, alongside logic for identifying blocked nodes.  

Data Pipeline: Uses Overpass API to fetch Kyoto's OSM (OpenStreetMap) data, parses relations (like stop_area), and builds a navigable graph.  

Caching: The system smartly caches static map data and graph edges on startup to optimize API response times.  
2. Current Frontend Review
The provided directory structure reveals a traditional, static frontend approach:  

Structure: Standard index.html linked to a single style.css and multiple vanilla JavaScript modules (config.js, graph-display.js, map.js, pathfinder.js, stations.js).  
Evaluation & Problem Areas
State Management: Vanilla JS modules often rely on manual DOM manipulation and global variables to share state (e.g., passing selected coordinates from map.js to pathfinder.js). This becomes brittle as features scale.
UI/UX: Native browser alerts or raw HTML forms likely handle interactions, which breaks immersion. The lack of a component library means UI elements (buttons, inputs, sidebars) might lack visual consistency and accessibility features.
Responsiveness: Managing a full-screen map alongside sidebars and floating panels is notoriously difficult in pure CSS/JS without a structured layout system.
3. Competitive UX Analysis
To modernize this application, we should look to industry leaders like Google Maps, Apple Maps, and Citymapper, adapting their patterns for an academic scope.
What Works & Should Be Adapted
The "Map as Canvas" Paradigm: The map should take up 100% of the viewport (Google Maps style). All UI elements (search, routing details, admin toggles) should float above the map as cards or sidebars.
Floating Action Panels: A floating left-aligned panel (desktop) or bottom sheet (mobile) for route inputs. It keeps the user grounded in the geography while inputting data.
Step-by-Step Visual Hierarchy: Highlighting the chosen route with a thick, high-contrast polyline while dimming the rest of the transit network (Citymapper style). The backend already supports identifying blocked track nodes to visually dim them, which perfectly supports this UX.  
What to Avoid (Too Complex for Scope)
Over-saturated POIs: Do not clutter the map with restaurants, businesses, or non-transit landmarks. Keep the focus strictly on the AI routing and subway stations.

Complex Mode Switchers: Since the engine primarily calculates subway and walking, avoid building complex UI tabs for bikes, cars, or rideshares.  
4. Phase 3: Design Discovery Questions
To finalize the exact visual aesthetics and feature prioritization, I would normally conduct a discovery phase. Before writing a line of frontend code, these are the questions we must answer:
Audience: Is this UI primarily for the professor/graders to evaluate the AI algorithm, or is it meant to simulate a real tourist-facing application?

Admin Exposure: Should the "block station" feature  be exposed to all users as a fun interactive sandbox, or hidden behind an "Admin Mode" toggle?  
Input Method: Do we require users to click on the map to set Start/End points, or do we want a text-based search input (e.g., typing "Kyoto Station")? (Text search requires geocoding, which might exceed the current backend scope).
(For the sake of this blueprint, I will assume a tourist-facing simulation where "Admin Mode" is a visible sandbox feature, and map-clicks are the primary input method).
5. Frontend Redesign Blueprint
Core Philosophy
We will move to a Single Page Application (SPA) model. The UI will feature a clean, borderless map dominating the screen, layered with minimalist floating UI panels constructed from shadcn/ui.
Why this improves usability:
Spatial Context: Users never leave the map context to fill out forms.

Feedback Loop: As the user clicks stations, the floating panel instantly updates with estimated times, creating a satisfying, interactive learning environment.  
6. Page Architecture
The application will consist of a single, highly interactive view.
Layout Details
Background Layer: Full-bleed Leaflet (or Mapbox) map container.
Primary Floating Panel (Left Sidebar on Desktop / Bottom Sheet on Mobile):
Header: App Title ("Kyoto Rail AI").
Input Section: Two distinct fields for "Origin" and "Destination".
Action Area: "Find Route" button and a "Clear" button.

Results Area: Conditionally rendered upon successful routing. Displays "Total Time" and "Distance" prominently, followed by a chronological timeline list of stations/walks.  
Floating Admin Controls (Top Right):
A small gear icon or "Sandbox Mode" toggle. When active, clicking stations on the map toggles their blocked state via the /api/v1/toggle-node endpoint.  
A "Reset Network" button hooked to /api/v1/unblock-all.  
7. shadcn/ui Component Mapping
Assuming you have a standard setup of shadcn/ui in your reference/ folder, prioritize these existing components over writing custom CSS:
UI Elementshadcn/ui ComponentJustificationMain Routing PanelCardProvides a clean, slightly shadowed container to float over the map.Origin/Dest InputsInput (Read-only)Styled inputs that populate when the user clicks the map.Actions (Route/Clear)ButtonUse a prominent primary variant for routing, and a ghost variant for clearing.Routing InstructionsScrollAreaFor scrolling through the path nodes if the route is long, keeping the card height constrained.Mobile LayoutSheet (Bottom)Translates the desktop side-panel into an intuitive pull-up sheet for mobile users.Admin Sandbox ModeSwitchA simple toggle to switch between "Routing Mode" and "Disruption Setup Mode".Error HandlingToastNon-intrusive alerts for when the AI cannot find a path or points are identical.  
8. Frontend Technology Recommendation
To achieve a modern architecture while remaining simple enough for an Intro to AI university project, I recommend migrating to:
Framework: React
Build Tool: Vite
Styling: Tailwind CSS (required for shadcn/ui)
Map Library: React-Leaflet (wraps standard Leaflet to play nicely with React's component lifecycle).
Why this stack?It avoids the enterprise overhead of Next.js (no need for Server-Side Rendering here, as the Flask backend handles all data ). React + Vite is the modern standard for fast, client-side SPAs. It allows your team to componentize the messy vanilla JS logic (map.js, pathfinder.js ) into manageable pieces like <MapDisplay /> and <RoutingPanel />.  
9. Design System
Visual Language
Vibe: "Kyoto Modern." Clean tech aesthetic mixed with subtle, culturally resonant colors.
Colors:
Primary (Brand/Buttons): A deep Indigo or "Kikyo-iro" (a traditional Japanese dark violet-blue), signifying rail transport.
Surface (Panels): Pure White (#FFFFFF) with a subtle border and shadow for elevation.
Map Polyline (Active Route): A highly visible, vibrant Blue or Green (Google Maps uses a standard #4285F4).

Map Polyline (Blocked/Inactive): Dimmed Gray or Muted Red to clearly indicate a blocked path.  
Typography:
Use Inter or the system sans-serif stack.
Keep font weights distinct: Bold for station names, Medium for time estimates, Regular for distances.
10. Responsive Strategy
Desktop ( > 768px): * Map takes up 100% width/height.
Routing <Card> floats absolutely on the top-left (width ~350px).
Admin controls float absolutely on the top-right.
Mobile ( < 768px):
Map takes up 100% width/height.
Routing panel transforms into a <Sheet> anchored to the bottom of the screen. Users can swipe it down to see the map, and swipe it up to view route details.
Admin controls hide behind a simple floating FAB (Floating Action Button) menu.
11. Migration Roadmap
To ensure your student team isn't overwhelmed, follow this phased approach:
Phase 1: Foundation (Days 1-2)
Initialize Vite + React project.
Install Tailwind CSS and configure shadcn/ui.
Set up a basic full-screen React-Leaflet map.
Phase 2: API Wiring (Days 3-4)
Create a generic API service to communicate with your Flask endpoints (e.g., fetching /api/v1/graph-edges ).  
Render the static graph lines on the map.
Phase 3: Core UI & Routing (Days 5-7)
Build the Floating Panel using shadcn/ui components.
Implement map-click logic to set Start/End coordinates.
Call /api/v1/pathfind  and draw the returned path on the map.  
Phase 4: Admin Features (Day 8)
Add the Sandbox toggle.
Implement click handlers to call /api/v1/toggle-node  and update the map visual state.  

CRITICAL RULE FOR AI DEVELOPER:
Do not attempt to build UI components from scratch using raw HTML and Tailwind classes if a shadcn/ui equivalent exists.

Standard Operating Procedure for UI:

Check the component mapping table in Section 7.

ALWAYS execute the CLI command (e.g., npx shadcn-ui@latest add [component-name]) to install the required component into the project FIRST.

Only after the component is successfully added to the codebase should you import and use it.

Custom UI development is strictly restricted to layouts and combining shadcn/ui components.