/**
 * Admin panel — graph toggle, stop mode, blocked stops list.
 * Refactored from inline code in the old index.html.
 */

import L from "leaflet";
import { store } from "../core/state";
import { toggleBlockNode, unblockAll, getGraphData } from "../core/api-client";
import { showGraph, hideGraph, isGraphVisible, renderGraph } from "../map/layers/graph-layer";
import { updateStationBlockedStatus } from "../map/layers/station-layer";
import { toast } from "./components/toast";
import { t } from "../i18n";
import type { GraphData, StationData } from "../core/types";

let stationDataCache: StationData[] | null = null;

export function createAdminPanel(container: HTMLElement, map: L.Map): void {
  // ── Build DOM ──────────────────────────────────────────────────

  const panel = document.createElement("div");
  panel.className = "admin-panel";
  panel.innerHTML = `
    <p class="section-label admin-section-title">${t("admin", "title")}</p>

    <div class="btn-row">
      <button id="btn-toggle-graph" class="btn btn-primary">
        <span>&#128268;</span> ${t("admin", "showGraph")}
      </button>
    </div>

    <div class="divider"></div>

    <p class="section-label">${t("admin", "stops")}</p>
    <div class="btn-row">
      <button id="btn-stop-mode" class="btn btn-warning">
        &#128683; ${t("admin", "enableStopMode")}
      </button>
    </div>
    <div id="stop-mode-hint" class="hint-box hidden">
      &#9889; ${t("admin", "stopModeHint")}
    </div>

    <div id="blocked-list-box" class="blocked-list-box hidden">
      <div class="result-title">&#128683; ${t("admin", "blockedStops")}</div>
      <ul id="blocked-list" class="blocked-list"></ul>
      <button id="btn-clear-blocked" class="btn btn-ghost btn-full">
        ${t("admin", "restoreAll")}
      </button>
    </div>
  `;

  container.appendChild(panel);

  // ── Element refs ──────────────────────────────────────────────

  const btnGraph = panel.querySelector("#btn-toggle-graph")!;
  const btnStopMode = panel.querySelector("#btn-stop-mode")!;
  const stopModeHint = panel.querySelector("#stop-mode-hint")!;
  const blockedListBox = panel.querySelector("#blocked-list-box")!;
  const blockedList = panel.querySelector("#blocked-list")!;
  const btnClearBlocked = panel.querySelector("#btn-clear-blocked")!;

  // ── Graph toggle ──────────────────────────────────────────────

  btnGraph.addEventListener("click", async () => {
    if (isGraphVisible()) {
      hideGraph(map);
      btnGraph.innerHTML = `<span>&#128268;</span> ${t("admin", "showGraph")}`;
      btnGraph.classList.remove("active");
    } else {
      try {
        await showGraph(map);
        btnGraph.innerHTML = `<span>&#128268;</span> ${t("admin", "hideGraph")}`;
        btnGraph.classList.add("active");
      } catch {
        toast.error("Failed to load graph data.");
      }
    }
  });

  // ── Stop mode ─────────────────────────────────────────────────

  function updateStopModeUI(): void {
    const active = store.stopMode;
    if (active) {
      btnStopMode.textContent = `&#9989; ${t("admin", "disableStopMode")}`;
      btnStopMode.classList.add("active");
      stopModeHint.classList.remove("hidden");
      map.getContainer().style.cursor = "crosshair";
    } else {
      btnStopMode.innerHTML = `&#128683; ${t("admin", "enableStopMode")}`;
      btnStopMode.classList.remove("active");
      stopModeHint.classList.add("hidden");
      map.getContainer().style.cursor = "";
    }
  }

  btnStopMode.addEventListener("click", () => store.toggleStopMode());
  store.on("stopmode:changed", updateStopModeUI);

  // ── Blocked list ──────────────────────────────────────────────

  function renderBlockedList(): void {
    const blocked = [...store.blockedNodes];
    if (blocked.length === 0) {
      blockedListBox.classList.add("hidden");
      blockedList.innerHTML = "";
      return;
    }

    blockedListBox.classList.remove("hidden");
    blockedList.innerHTML = blocked
      .map((id) => {
        const name = resolveNodeName(id);
        return `<li class="blocked-item">
          <span class="blocked-name">${name}</span>
          <button class="btn-restore" data-node-id="${id}" title="Restore this stop">&#x2715;</button>
        </li>`;
      })
      .join("");

    blockedList.querySelectorAll(".btn-restore").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const nodeId = Number(btn.getAttribute("data-node-id"));
        try {
          await toggleBlockNode(nodeId);
          await refreshAdminState(map);
        } catch {
          toast.error("Failed to toggle stop.");
        }
      });
    });
  }

  btnClearBlocked.addEventListener("click", async () => {
    try {
      const result = await unblockAll();
      toast.success(`${result.unblocked_count} stop(s) restored.`);
      await refreshAdminState(map);
    } catch {
      toast.error("Failed to restore stops.");
    }
  });

  // ── Station click in admin mode ────────────────────────────────

  store.on("station:click", async (data: { lat: number; lon: number; name: string; node_id: number }) => {
    if (store.role !== "admin" || !store.stopMode) return;

    try {
      const response = await toggleBlockNode(data.node_id);
      const action = response.blocked ? "blocked" : "unblocked";
      toast.info(`"${data.name}" ${action}.`);
      await refreshAdminState(map);
    } catch {
      toast.error("Failed to toggle stop.");
    }
  });

  store.on("blockednodes:changed", renderBlockedList);

  // ── Role change handler ────────────────────────────────────────

  store.on("role:changed", async (role: string) => {
    if (role === "admin") {
      hideGraph(map);
      btnGraph.innerHTML = `<span>&#128268;</span> ${t("admin", "showGraph")}`;
      btnGraph.classList.remove("active");
      await refreshAdminState(map);
    }
  });

  // ── Graph visibility sync ──────────────────────────────────────

  store.on("graphvisible:changed", (visible: boolean) => {
    if (visible) {
      btnGraph.innerHTML = `<span>&#128268;</span> ${t("admin", "hideGraph")}`;
      btnGraph.classList.add("active");
    } else {
      btnGraph.innerHTML = `<span>&#128268;</span> ${t("admin", "showGraph")}`;
      btnGraph.classList.remove("active");
    }
  });

  // ── Language change re-render ──────────────────────────────────

  store.on("language:changed", () => {
    const titleEl = panel.querySelector(".admin-section-title");
    if (titleEl) titleEl.textContent = t("admin", "title");
    updateStopModeUI();
    const stopsTitle = panel.querySelectorAll(".section-label")[1];
    if (stopsTitle) stopsTitle.textContent = t("admin", "stops");
    const blockedTitle = panel.querySelector(".result-title");
    if (blockedTitle) blockedTitle.innerHTML = `&#128683; ${t("admin", "blockedStops")}`;
    const restoreBtn = panel.querySelector(".btn-full");
    if (restoreBtn) restoreBtn.textContent = t("admin", "restoreAll");
  });
}

// ── Helpers ──────────────────────────────────────────────────────

async function refreshAdminState(map: L.Map): Promise<void> {
  // Re-fetch graph data to get updated blocked nodes
  try {
    const data: GraphData = await getGraphData();
    const blockedSet = new Set<number>((data.blocked_nodes || []).map(Number));
    store.setBlockedNodes(blockedSet);
    store.setGraphData(data);

    updateStationBlockedStatus(map);

    if (isGraphVisible()) {
      renderGraph(map, data);
    }
  } catch {
    // silently fail — state remains
  }
}

function resolveNodeName(nodeId: number): string {
  // Try to resolve from station data cache
  if (stationDataCache) {
    const found = stationDataCache.find((s) => s.id === nodeId);
    if (found) return found.name;
  }
  return `Node #${nodeId}`;
}