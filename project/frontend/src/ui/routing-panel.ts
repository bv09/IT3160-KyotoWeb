/**
 * Routing panel — origin/destination inputs, mode selectors, search button.
 * Replaces the old "Select Points" button flow.
 */

import L from "leaflet";
import { store } from "../core/state";
import { findRoute, searchStops } from "../core/api-client";
import { t } from "../i18n";
import { DEFAULT_ALGORITHM, MIN_SEARCH_CHARS, SEARCH_DEBOUNCE_MS } from "../config";
import { toast } from "./components/toast";
import type { StopSummary } from "../core/types";

interface PanelState {
  from: StopSummary | null;
  to: StopSummary | null;
  fromLatLng: [number, number] | null;
  toLatLng: [number, number] | null;
}

export function createRoutingPanel(container: HTMLElement, map: L.Map): void {
  const state: PanelState = { from: null, to: null, fromLatLng: null, toLatLng: null };

  let fromDebounce: ReturnType<typeof setTimeout> | null = null;
  let toDebounce: ReturnType<typeof setTimeout> | null = null;

  // ── Build DOM ──────────────────────────────────────────────────

  const panel = document.createElement("div");
  panel.className = "routing-panel";
  panel.innerHTML = `
    <p class="section-label">${t("routing", "title")}</p>

    <div class="search-input-group">
      <div class="search-field">
        <label for="route-from" class="search-label">${t("routing", "from")}</label>
        <div class="autocomplete-wrapper">
          <input id="route-from" type="text" class="search-input"
                 placeholder="${t("routing", "fromPlaceholder")}" autocomplete="off" />
          <div class="autocomplete-dropdown hidden" id="from-dropdown"></div>
        </div>
        <button id="btn-use-location" class="btn-locate" title="${t("routing", "useLocation")}">
          <span class="locate-dot"></span>
        </button>
      </div>

      <button id="btn-swap" class="btn-swap" title="${t("routing", "swapDirections")}">&#8645;</button>

      <div class="search-field">
        <label for="route-to" class="search-label">${t("routing", "to")}</label>
        <div class="autocomplete-wrapper">
          <input id="route-to" type="text" class="search-input"
                 placeholder="${t("routing", "toPlaceholder")}" autocomplete="off" />
          <div class="autocomplete-dropdown hidden" id="to-dropdown"></div>
        </div>
      </div>
    </div>

    <div class="mode-toggles">
      <button class="mode-btn active" data-mode="subway">&#128647; ${t("routing", "modes.subway")}</button>
      <button class="mode-btn active" data-mode="bus">&#128652; ${t("routing", "modes.bus")}</button>
      <button class="mode-btn active" data-mode="walk">&#128694; ${t("routing", "modes.walk")}</button>
    </div>

    <div class="btn-row">
      <button id="btn-search-route" class="btn btn-primary">
        <span>&#128269;</span> ${t("actions", "search")}
      </button>
      <button id="btn-clear-route" class="btn btn-ghost">
        <span>&#128465;</span> ${t("actions", "clear")}
      </button>
    </div>
  `;

  container.appendChild(panel);

  // ── Element refs ──────────────────────────────────────────────

  const fromInput = panel.querySelector("#route-from") as HTMLInputElement;
  const toInput = panel.querySelector("#route-to") as HTMLInputElement;
  const fromDropdown = panel.querySelector("#from-dropdown")!;
  const toDropdown = panel.querySelector("#to-dropdown")!;
  const btnSearch = panel.querySelector("#btn-search-route")!;
  const btnClear = panel.querySelector("#btn-clear-route") as HTMLElement;
  const btnSwap = panel.querySelector("#btn-swap") as HTMLElement;
  const btnLocation = panel.querySelector("#btn-use-location") as HTMLElement;

  // ── Autocomplete ──────────────────────────────────────────────

  function buildAutocompleteHandler(
    input: HTMLInputElement,
    dropdown: Element,
    onSelect: (stop: StopSummary) => void,
  ) {
    input.addEventListener("input", () => {
      const query = input.value.trim();
      if (query.length < MIN_SEARCH_CHARS) {
        dropdown.classList.add("hidden");
        return;
      }

      const debounceKey = input === fromInput ? "from" : "to";
      const debounceVar = input === fromInput ? fromDebounce : toDebounce;
      if (debounceVar) clearTimeout(debounceVar);

      const timer = setTimeout(async () => {
        try {
          const result = await searchStops({ name: query, limit: 8 });
          if (result.stops.length === 0) {
            dropdown.classList.add("hidden");
            return;
          }
          dropdown.innerHTML = result.stops
            .map(
              (s: StopSummary) =>
                `<div class="autocomplete-item" data-id="${s.id}">
                  <span class="ac-name">${s.name}</span>
                  <span class="ac-type">${s.type}</span>
                </div>`,
            )
            .join("");
          dropdown.classList.remove("hidden");

          dropdown.querySelectorAll(".autocomplete-item").forEach((item) => {
            item.addEventListener("click", () => {
              const stop = result.stops.find(
                (s: StopSummary) => s.id === Number(item.getAttribute("data-id")),
              );
              if (stop) {
                input.value = stop.name;
                dropdown.classList.add("hidden");
                onSelect(stop);
              }
            });
          });
        } catch {
          // silently ignore search errors during typing
        }
      }, SEARCH_DEBOUNCE_MS);

      if (input === fromInput) fromDebounce = timer;
      else toDebounce = timer;
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
      if (!input.parentElement?.contains(e.target as Node)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  buildAutocompleteHandler(fromInput, fromDropdown, (stop) => {
    state.from = stop;
    state.fromLatLng = [stop.lat, stop.lon];
    store.setFromStop({ lat: stop.lat, lon: stop.lon, name: stop.name, id: stop.id });
  });

  buildAutocompleteHandler(toInput, toDropdown, (stop) => {
    state.to = stop;
    state.toLatLng = [stop.lat, stop.lon];
    store.setToStop({ lat: stop.lat, lon: stop.lon, name: stop.name, id: stop.id });
  });

  // ── Geolocation ───────────────────────────────────────────────

  btnLocation.addEventListener("click", () => {
    if (!navigator.geolocation) {
      toast.info("Geolocation not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.fromLatLng = [pos.coords.latitude, pos.coords.longitude];
        fromInput.value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        store.setFromStop({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          name: "Current Location",
          id: 0,
        });
        store.emit("from:location", {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        toast.success("Using your current location as origin.");
      },
      () => toast.error("Could not get your location."),
    );
  });

  // ── Map click for point selection ─────────────────────────────

  store.on("map:click", (latlng: { lat: number; lon: number }) => {
    if (store.role !== "user") return;

    if (!state.fromLatLng) {
      state.fromLatLng = [latlng.lat, latlng.lon];
      fromInput.value = `${latlng.lat.toFixed(5)}, ${latlng.lon.toFixed(5)}`;
      store.setFromStop({
        lat: latlng.lat,
        lon: latlng.lon,
        name: `${latlng.lat.toFixed(5)}, ${latlng.lon.toFixed(5)}`,
        id: 0,
      });
      toast.info("Origin set. Click destination on the map.");
    } else if (!state.toLatLng) {
      state.toLatLng = [latlng.lat, latlng.lon];
      toInput.value = `${latlng.lat.toFixed(5)}, ${latlng.lon.toFixed(5)}`;
      store.setToStop({
        lat: latlng.lat,
        lon: latlng.lon,
        name: `${latlng.lat.toFixed(5)}, ${latlng.lon.toFixed(5)}`,
        id: 0,
      });
    }
  });

  // ── Station click for point selection ─────────────────────────

  store.on("station:click", (data: { lat: number; lon: number; name: string; node_id: number }) => {
    if (store.role !== "user" || store.stopMode) return;

    if (!state.fromLatLng) {
      state.fromLatLng = [data.lat, data.lon];
      fromInput.value = data.name;
      store.setFromStop({ lat: data.lat, lon: data.lon, name: data.name, id: data.node_id });
      toast.info("Origin set. Now select destination.");
    } else if (!state.toLatLng) {
      state.toLatLng = [data.lat, data.lon];
      toInput.value = data.name;
      store.setToStop({ lat: data.lat, lon: data.lon, name: data.name, id: data.node_id });
    }
  });

  // ── Mode toggles ──────────────────────────────────────────────

  panel.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
    });
  });

  function getModes(): string[] {
    const modes: string[] = [];
    panel.querySelectorAll(".mode-btn.active").forEach((btn) => {
      const mode = btn.getAttribute("data-mode");
      if (mode) modes.push(mode);
    });
    return modes.length === 3 ? [] : modes;
  }

  // ── Search ────────────────────────────────────────────────────

  btnSearch.addEventListener("click", async () => {
    if (!state.fromLatLng || !state.toLatLng) {
      toast.error("Please select both an origin and a destination.");
      return;
    }

    try {
      const result = await findRoute({
        start: state.fromLatLng,
        end: state.toLatLng,
        algorithm: DEFAULT_ALGORITHM,
        constraints: { optimize: "time" },
        include_walking: true,
        include_legs: true,
      });
      store.setRouteResult(result);
      toast.success("Route found!");
    } catch (err: any) {
      const msg = err?.message || "Failed to find route.";
      store.setRouteError(msg);
      toast.error(msg);
    }
  });

  // ── Clear ────────────────────────────────────────────────────

  btnClear.addEventListener("click", () => {
    state.from = null;
    state.to = null;
    state.fromLatLng = null;
    state.toLatLng = null;
    fromInput.value = "";
    toInput.value = "";
    store.setFromStop(null);
    store.setToStop(null);
    store.setRouteResult(null);
    store.setRouteError("");
    store.emit("route:clear");
  });

  // ── Swap ─────────────────────────────────────────────────────

  btnSwap.addEventListener("click", () => {
    const tmpFrom = state.from;
    const tmpFromCoord = state.fromLatLng;
    const tmpFromVal = fromInput.value;
    state.from = state.to;
    state.fromLatLng = state.toLatLng;
    state.to = tmpFrom;
    state.toLatLng = tmpFromCoord;
    fromInput.value = toInput.value;
    toInput.value = tmpFromVal;
    store.setFromStop(
      state.from
        ? { lat: state.from.lat, lon: state.from.lon, name: state.from.name, id: state.from.id }
        : null,
    );
    store.setToStop(
      state.to
        ? { lat: state.to.lat, lon: state.to.lon, name: state.to.name, id: state.to.id }
        : null,
    );
  });

  // ── Store subscription for re-render on language change ───────
  store.on("language:changed", () => {
    const label = panel.querySelector(".section-label");
    if (label) label.textContent = t("routing", "title");
    const fl = panel.querySelector("label[for='route-from']");
    if (fl) fl.textContent = t("routing", "from");
    const tl = panel.querySelector("label[for='route-to']");
    if (tl) tl.textContent = t("routing", "to");
    fromInput.placeholder = t("routing", "fromPlaceholder");
    toInput.placeholder = t("routing", "toPlaceholder");
    btnSwap.title = t("routing", "swapDirections");
    btnLocation.title = t("routing", "useLocation");
    const modeBtns = panel.querySelectorAll(".mode-btn");
    if (modeBtns[0]) modeBtns[0].innerHTML = `&#128647; ${t("routing", "modes.subway")}`;
    if (modeBtns[1]) modeBtns[1].innerHTML = `&#128652; ${t("routing", "modes.bus")}`;
    if (modeBtns[2]) modeBtns[2].innerHTML = `&#128694; ${t("routing", "modes.walk")}`;
    btnSearch.innerHTML = `<span>&#128269;</span> ${t("actions", "search")}`;
    btnClear.innerHTML = `<span>&#128465;</span> ${t("actions", "clear")}`;
  });
}