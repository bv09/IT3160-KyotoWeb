/**
 * Results panel — turn-by-turn instructions and route summary.
 * New component — the old code only showed distance + time.
 */

import { store } from "../core/state";
import { highlightLeg, resetLegHighlights } from "../map/layers/route-layer";
import { t } from "../i18n";
import type { RouteResult, Leg, TransitLeg, WalkLeg } from "../core/types";

export function createResultsPanel(container: HTMLElement): void {
  const panel = document.createElement("div");
  panel.className = "results-panel";
  container.appendChild(panel);

  function render(): void {
    const result = store.routeResult;
    const error = store.routeError;
    const loading = store.loading;

    if (loading && !result) {
      panel.innerHTML = renderLoading();
      panel.classList.remove("hidden");
      return;
    }

    if (error && !result) {
      panel.innerHTML = renderError(error);
      panel.classList.remove("hidden");
      return;
    }

    if (!result) {
      panel.innerHTML = renderEmpty();
      panel.classList.remove("hidden");
      return;
    }

    panel.innerHTML = renderResult(result);
    panel.classList.remove("hidden");
    wireLegHovers(result.legs);
  }

  function renderLoading(): string {
    return `
      <div class="results-loading">
        <div class="result-title">${t("routing", "title")}</div>
        <div class="skeleton-card"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-card"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
      </div>`;
  }

  function renderError(error: string): string {
    return `
      <div class="results-error">
        <div class="result-title">${t("routing", "title")}</div>
        <div class="error-msg">${error}</div>
        <button class="btn btn-ghost" id="btn-retry">${t("actions", "retry")}</button>
      </div>`;
  }

  function renderEmpty(): string {
    return `
      <div class="results-empty">
        <div class="result-title">${t("routing", "title")}</div>
        <p class="hint-text">${t("routing", "selectPointsHint")}</p>
      </div>`;
  }

  function renderResult(result: RouteResult): string {
    const { summary, legs } = result;

    const mins = Math.round(summary.total_time_s / 60);
    const km = (summary.total_distance_m / 1000).toFixed(1);
    const walkM = Math.round(summary.walking_distance_m);

    return `
      <div class="result-summary">
        <div class="result-title">&#128202; ${t("routing", "title")}</div>
        <div class="summary-stats">
          <div class="stat">
            <span class="stat-val">${formatTime(summary.total_time_s)}</span>
            <span class="stat-lbl">Duration</span>
          </div>
          <div class="stat">
            <span class="stat-val">${km} km</span>
            <span class="stat-lbl">Distance</span>
          </div>
          <div class="stat">
            <span class="stat-val">${summary.total_transfers}</span>
            <span class="stat-lbl">Transfers</span>
          </div>
          <div class="stat">
            <span class="stat-val">${walkM} m</span>
            <span class="stat-lbl">Walking</span>
          </div>
        </div>
      </div>
      <div class="leg-list">
        ${legs.map((leg: Leg, i: number) => renderLeg(leg, i)).join("")}
      </div>`;
  }

  function renderLeg(leg: Leg, index: number): string {
    if (leg.type === "transit") {
      return renderTransitLeg(leg, index);
    }
    return renderWalkLeg(leg, index);
  }

  function renderTransitLeg(leg: TransitLeg, index: number): string {
    const mins = Math.round(leg.time_s / 60);
    const colour = leg.route_colour || "#4f46e5";
    const nStops = leg.intermediate_stops.length;

    let stopsHtml = "";
    if (nStops > 0) {
      stopsHtml = `
        <div class="leg-stops collapsed" data-leg="${index}">
          <button class="btn-expand" data-leg="${index}">
            ${nStops} intermediate stop${nStops !== 1 ? "s" : ""} &#9660;
          </button>
          <div class="stop-list hidden" data-leg="${index}">
            ${leg.intermediate_stops.map((s: string) => `<div class="stop-item">&#128647; ${s}</div>`).join("")}
          </div>
        </div>`;
    }

    return `
      <div class="leg-card transit-card" data-leg="${index}">
        <div class="leg-bar" style="background:${colour}"></div>
        <div class="leg-content">
          <div class="leg-header">
            <span class="leg-badge" style="background:${colour}">${leg.route_ref || "?"}</span>
            <span class="leg-title">${leg.route_name || "Transit"}</span>
            <span class="leg-time">${mins} min</span>
          </div>
          <div class="leg-stations">
            <div class="leg-from">&#128647; ${leg.from.name || "Board"}</div>
            <div class="leg-to">&#128647; ${leg.to.name || "Alight"}</div>
          </div>
          <div class="leg-dist">${(leg.distance_m / 1000).toFixed(1)} km</div>
          ${stopsHtml}
        </div>
      </div>`;
  }

  function renderWalkLeg(leg: WalkLeg, index: number): string {
    const mins = Math.round(leg.time_s / 60);
    const icon = "&#128694;";

    return `
      <div class="leg-card walk-card" data-leg="${index}">
        <div class="leg-bar" style="background:#94a3b8"></div>
        <div class="leg-content">
          <div class="leg-header">
            <span class="leg-icon">${icon}</span>
            <span class="leg-title">Walking</span>
            <span class="leg-time">${mins} min</span>
          </div>
          <div class="leg-walk-info">
            ${(leg.distance_m / 1000).toFixed(2)} km
            ${leg.from.name ? `from ${leg.from.name}` : ""}
            ${leg.to.name ? `to ${leg.to.name}` : ""}
          </div>
        </div>
      </div>`;
  }

  function wireLegHovers(legs: Leg[]): void {
    panel.querySelectorAll(".leg-card").forEach((card) => {
      const index = Number(card.getAttribute("data-leg"));
      card.addEventListener("mouseenter", () => highlightLeg(index));
      card.addEventListener("mouseleave", () => resetLegHighlights());
    });

    panel.querySelectorAll(".btn-expand").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = btn.getAttribute("data-leg");
        const list = panel.querySelector(`.stop-list[data-leg="${idx}"]`);
        if (list) {
          list.classList.toggle("hidden");
          btn.innerHTML = list.classList.contains("hidden")
            ? `${legs[Number(idx)].type === "transit" ? (legs[Number(idx)] as TransitLeg).intermediate_stops.length : 0} intermediate stop${legs[Number(idx)].type === "transit" && (legs[Number(idx)] as TransitLeg).intermediate_stops.length !== 1 ? "s" : ""} &#9660;`
            : `&#9650; Hide stops`;
        }
      });
    });

    const retryBtn = panel.querySelector("#btn-retry");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        store.emit("route:retry");
      });
    }
  }

  // ── Subscribe to state changes ─────────────────────────────────

  store.on("route:result", render);
  store.on("route:error", render);
  store.on("loading:changed", render);
  store.on("language:changed", render);
  store.on("route:clear", render);

  // Initial render
  render();
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins} min`;
}