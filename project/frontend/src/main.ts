/**
 * Kyoto Metro — App Bootstrap
 *
 * Initializes i18n, state store, map, UI components, and wires
 * event flow between map layers and UI panels.
 */

import L from "leaflet";
import "./styles/main.css";

import { initI18n } from "./i18n";
import { store } from "./core/state";
import { initMap } from "./map/map-init";
import { loadStationLayer } from "./map/layers/station-layer";
import { renderRoute, clearRoute } from "./map/layers/route-layer";
import { createSidebar } from "./ui/sidebar";
import { createRoutingPanel } from "./ui/routing-panel";
import { createResultsPanel } from "./ui/results-panel";
import { createAdminPanel } from "./ui/admin-panel";
import { initSpinner } from "./ui/components/spinner";
import { toast } from "./ui/components/toast";

async function bootstrap(): Promise<void> {
  // ── 1. i18n ────────────────────────────────────────────────────
  await initI18n();

  // ── 2. Spinner (must be before API calls) ──────────────────────
  initSpinner();

  // ── 3. Map ─────────────────────────────────────────────────────
  const map = initMap("map");

  // ── 4. Sidebar & UI Containers ─────────────────────────────────
  const { userSection, adminSection } = createSidebar(map);

  // ── 5. UI Panels ───────────────────────────────────────────────
  createRoutingPanel(userSection, map);
  createResultsPanel(userSection);
  createAdminPanel(adminSection, map);

  // ── 6. Map click forwarding ────────────────────────────────────
  map.on("click", (e: L.LeafletMouseEvent) => {
    store.emit("map:click", { lat: e.latlng.lat, lon: e.latlng.lng });
  });

  // ── 7. Route rendering subscriber ──────────────────────────────
  store.on("route:result", (result) => {
    if (result) {
      renderRoute(map, result);
    }
  });

  store.on("route:error", () => {
    clearRoute(map);
  });

  store.on("route:clear", () => {
    clearRoute(map);
  });

  // ── 8. Route retry handler ─────────────────────────────────────
  store.on("route:retry", () => {
    // Re-trigger search by emitting an event that routing-panel listens to
    store.emit("search:retry");
  });

  // ── 9. Load initial data ───────────────────────────────────────
  try {
    await loadStationLayer(map);
  } catch (err: any) {
    console.error("Failed to load station data:", err);
    toast.error("Failed to load station data. Please check the backend connection.");
  }

  // ── 10. Dev helper ─────────────────────────────────────────────
  if (import.meta.env.DEV) {
    console.log("[Kyoto Metro] App bootstrapped successfully.");
    console.log("[Kyoto Metro] State store:", store);
    console.log("[Kyoto Metro] Map instance:", map);
  }
}

bootstrap().catch((err) => {
  console.error("[Kyoto Metro] Bootstrap failed:", err);
  // Show a minimal error state
  const app = document.getElementById("app");
  if (app) {
    app.innerHTML =
      '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:#f87171;font-family:sans-serif;"><h2>Failed to load application</h2><p>Check the console for details.</p></div>';
  }
});